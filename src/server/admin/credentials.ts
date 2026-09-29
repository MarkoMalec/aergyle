import crypto from "crypto";
// bcryptjs is CommonJS: the default import works both in Next and in plain
// Node (the admin CLI), where named imports from it fail.
import bcrypt from "bcryptjs";

/**
 * Admin account rules shared by the login route and the admin CLI. Kept free
 * of Next imports so the CLI can run it outside the app.
 */

export const ADMIN_USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/;
export const ADMIN_PASSWORD_MIN = 12;
export const ADMIN_PASSWORD_MAX_BYTES = 72;
export const ADMIN_BCRYPT_ROUNDS = 12;
/** Wrong passwords or codes before the account is locked for a while. */
export const ADMIN_MAX_FAILED_LOGINS = 5;
export const ADMIN_LOCKOUT_MINUTES = 15;
export const TOTP_ISSUER = "Aergyle Admin";

// Checked when the username doesn't exist, so the response time doesn't
// reveal which usernames are real. A hash of random bytes nobody knows.
const DUMMY_HASH =
  "$2a$12$pycQgajIR4BrsUQa8fpKsOskRj1DpV532NfwlLq5pFIK8u4u.X0UW";

export function normalizeAdminUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function adminPasswordProblem(password: string): string | null {
  if (password.length < ADMIN_PASSWORD_MIN) {
    return `Use at least ${ADMIN_PASSWORD_MIN} characters.`;
  }
  if (new TextEncoder().encode(password).length > ADMIN_PASSWORD_MAX_BYTES) {
    return `Use at most ${ADMIN_PASSWORD_MAX_BYTES} bytes.`;
  }
  return null;
}

export function hashAdminPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ADMIN_BCRYPT_ROUNDS);
}

/** Compares in roughly constant time whether or not the account exists. */
export async function verifyAdminPassword(
  password: string,
  passwordHash: string | null | undefined,
): Promise<boolean> {
  const matches = await bcrypt.compare(password, passwordHash ?? DUMMY_HASH);
  return matches && Boolean(passwordHash);
}

/* -------------------------------------------------------------------------- */
/* Invites                                                                     */
/* -------------------------------------------------------------------------- */

/** How long a new admin has to finish setup before the invite goes dead. */
export const ADMIN_INVITE_HOURS = 48;

// No I, L, O or U: nothing that can be misread or misheard when the password
// is passed on, and no accidental words.
const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const INVITE_GROUPS = 5;
const INVITE_GROUP_SIZE = 4;

/**
 * The one-time password an invited admin signs in with once. Generated rather
 * than chosen, because it is a single factor: for the length of the invite it
 * is the only thing standing in front of the account.
 */
export function generateInvitePassword(): string {
  const groups: string[] = [];
  for (let group = 0; group < INVITE_GROUPS; group++) {
    let chunk = "";
    for (let index = 0; index < INVITE_GROUP_SIZE; index++) {
      chunk += INVITE_ALPHABET[crypto.randomInt(INVITE_ALPHABET.length)];
    }
    groups.push(chunk);
  }
  // ~98 bits, in groups that are easy to read out loud.
  return groups.join("-");
}

export type AdminInviteState = {
  totpSecret: string | null;
  setupExpiresAt: Date | null;
  disabled: boolean;
};

/**
 * True while the account is waiting for its first setup: no authenticator yet
 * and the invite has not run out. Only then does the password alone open a
 * (setup-only) session.
 */
export function isInviteOpen(
  admin: AdminInviteState | null | undefined,
  now: Date = new Date(),
): boolean {
  return Boolean(
    admin &&
      !admin.disabled &&
      admin.totpSecret === null &&
      admin.setupExpiresAt !== null &&
      admin.setupExpiresAt > now,
  );
}
