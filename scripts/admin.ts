/**
 * Manages /admin accounts. Admins are separate from player accounts and
 * every sign-in takes the password plus a code from an authenticator app
 * (Authy, 1Password, Google Authenticator, Bitwarden...).
 *
 *   npm run admin -- create <username>   new admin: password, then authenticator
 *   npm run admin -- reset <username>    new password and authenticator; ends every session
 *   npm run admin -- disable <username>  blocks sign-in and ends every session
 *   npm run admin -- enable <username>   allows sign-in again
 *   npm run admin -- unlock <username>   clears a lockout after failed attempts
 *   npm run admin -- revoke <username>   ends every session
 *   npm run admin -- list                shows every admin
 *
 * Runs against DATABASE_URL, read like Next reads it (.env.local over .env);
 * in the deploy image: docker compose run --rm app admin <command>.
 */
import { config } from "dotenv";
import readline from "readline";
import QRCode from "qrcode";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  ADMIN_USERNAME_PATTERN,
  TOTP_ISSUER,
  adminPasswordProblem,
  hashAdminPassword,
  normalizeAdminUsername,
} from "../src/server/admin/credentials";
import {
  generateTotpSecret,
  sealTotpSecret,
  totpUri,
  verifyTotp,
} from "../src/server/admin/totp";

const USAGE = `Usage: npm run admin -- <command> [username]

  create <username>   Create an admin (password, then authenticator setup)
  reset <username>    New password and authenticator; ends every session
  disable <username>  Block sign-in and end every session
  enable <username>   Allow sign-in again
  unlock <username>   Clear a lockout after failed attempts
  revoke <username>   End every session
  list                Show every admin`;

config({ path: ".env.local" });
config();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    let muted = false;
    // readline echoes typed characters through this; swallow them for secrets.
    (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput =
      (text) => {
        if (!muted) process.stdout.write(text);
      };
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
    muted = hidden;
  });
}

async function askNewPassword(): Promise<string> {
  for (;;) {
    const password = await ask("New password (min 12 characters): ", true);
    const problem = adminPasswordProblem(password);
    if (problem) {
      console.log(`  ${problem}`);
      continue;
    }
    if ((await ask("Repeat the password: ", true)) !== password) {
      console.log("  The passwords don't match.");
      continue;
    }
    return password;
  }
}

/** Shows the authenticator key and only returns once a code checks out. */
async function enrollAuthenticator(username: string): Promise<string> {
  const secret = generateTotpSecret();
  const uri = totpUri({ secret, account: username, issuer: TOTP_ISSUER });

  console.log("\nScan this with your authenticator app (Authy: tap +, then Scan QR Code):\n");
  console.log(await QRCode.toString(uri, { type: "terminal", small: true }));
  console.log("Or enter the key by hand (Authy: + , then Enter key manually):");
  console.log(`\n  ${secret.match(/.{1,4}/g)?.join(" ")}\n`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const code = await ask("Enter the 6-digit code the app shows: ");
    if (verifyTotp(secret, code) !== null) return secret;
    console.log("  That code doesn't match. Check the phone's clock and try the next code.");
  }
  throw new Error("Authenticator setup failed; nothing was changed.");
}

async function findAdmin(username: string) {
  const admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin) throw new Error(`No admin named "${username}".`);
  return admin;
}

async function endSessions(adminId: string) {
  const { count } = await prisma.adminSession.updateMany({
    where: { adminId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}

async function audit(admin: { id: string; username: string }, action: string) {
  await prisma.adminAuditLog.create({
    data: { adminId: admin.id, username: admin.username, action, ip: "cli" },
  });
}

async function main() {
  const [command, rawUsername] = process.argv.slice(2);
  if (!command) {
    console.log(USAGE);
    return;
  }

  if (command === "list") {
    const admins = await prisma.adminUser.findMany({
      orderBy: { username: "asc" },
      include: {
        _count: {
          select: {
            sessions: {
              where: { revokedAt: null, expiresAt: { gt: new Date() } },
            },
          },
        },
      },
    });
    if (admins.length === 0) console.log("No admins yet. Create one with: npm run admin -- create <username>");
    for (const admin of admins) {
      const state = admin.disabled
        ? "disabled"
        : admin.lockedUntil && admin.lockedUntil > new Date()
          ? `locked until ${admin.lockedUntil.toLocaleTimeString()}`
          : "active";
      console.log(
        `${admin.username.padEnd(24)} ${state.padEnd(24)} sessions: ${admin._count.sessions}   last sign-in: ${admin.lastLoginAt?.toLocaleString() ?? "never"}`,
      );
    }
    return;
  }

  if (!rawUsername) throw new Error(`Missing username.\n\n${USAGE}`);
  const username = normalizeAdminUsername(rawUsername);

  switch (command) {
    case "create": {
      if (!ADMIN_USERNAME_PATTERN.test(username)) {
        throw new Error(
          "Usernames are 3-32 characters: a-z, 0-9, dot, dash, underscore; starting and ending with a letter or digit.",
        );
      }
      if (await prisma.adminUser.findUnique({ where: { username } })) {
        throw new Error(`"${username}" already exists. Use reset to change its password.`);
      }
      if (!process.stdin.isTTY) throw new Error("Run this in an interactive terminal.");
      const password = await askNewPassword();
      const secret = await enrollAuthenticator(username);
      const admin = await prisma.adminUser.create({
        data: {
          username,
          passwordHash: await hashAdminPassword(password),
          totpSecret: await sealTotpSecret(secret, password),
        },
      });
      await audit(admin, "cli.create");
      console.log(`\nCreated "${username}". Sign in at /admin/login.`);
      break;
    }
    case "reset": {
      const admin = await findAdmin(username);
      if (!process.stdin.isTTY) throw new Error("Run this in an interactive terminal.");
      console.log("The old authenticator entry stops working; remove it from the app afterwards.");
      const password = await askNewPassword();
      const secret = await enrollAuthenticator(username);
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: {
          passwordHash: await hashAdminPassword(password),
          totpSecret: await sealTotpSecret(secret, password),
          totpLastCounter: null,
          failedLogins: 0,
          lockedUntil: null,
        },
      });
      const ended = await endSessions(admin.id);
      await audit(admin, "cli.reset");
      console.log(`\nReset "${username}" and ended ${ended} session(s).`);
      break;
    }
    case "disable": {
      const admin = await findAdmin(username);
      await prisma.adminUser.update({ where: { id: admin.id }, data: { disabled: true } });
      const ended = await endSessions(admin.id);
      await audit(admin, "cli.disable");
      console.log(`Disabled "${username}" and ended ${ended} session(s).`);
      break;
    }
    case "enable": {
      const admin = await findAdmin(username);
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { disabled: false, failedLogins: 0, lockedUntil: null },
      });
      await audit(admin, "cli.enable");
      console.log(`Enabled "${username}".`);
      break;
    }
    case "unlock": {
      const admin = await findAdmin(username);
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
      await audit(admin, "cli.unlock");
      console.log(`Unlocked "${username}".`);
      break;
    }
    case "revoke": {
      const admin = await findAdmin(username);
      const ended = await endSessions(admin.id);
      await audit(admin, "cli.revoke");
      console.log(`Ended ${ended} session(s) for "${username}".`);
      break;
    }
    default:
      throw new Error(`Unknown command "${command}".\n\n${USAGE}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
