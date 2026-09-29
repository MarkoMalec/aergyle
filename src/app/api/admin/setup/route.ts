import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import {
  adminCookieOptions,
  createAdminSession,
  getAdminSession,
  recordAdminAudit,
  requestMeta,
} from "~/server/admin/auth";
import { adminSessionCookieName } from "~/server/admin/constants";
import {
  adminPasswordProblem,
  hashAdminPassword,
  isInviteOpen,
  verifyAdminPassword,
} from "~/server/admin/credentials";
import { sealTotpSecret, verifyTotp } from "~/server/admin/totp";
import { isSameOriginRequest } from "~/server/security/origin";
import { sharedRateLimiter } from "~/server/security/rateLimit";

export const dynamic = "force-dynamic";

const attempts = sharedRateLimiter("admin-setup", {
  limit: 15,
  windowMs: 15 * 60_000,
});

function fail(status: number, error: string, field?: "password" | "code") {
  return NextResponse.json({ error, field }, { status });
}

/**
 * Finishes an invited admin's account: a password of their own, and an
 * authenticator enrolled against it. Both land in one write, so the account
 * is never left with one and not the other. Until this succeeds the session
 * reaches nothing else (see requireAdminApiAccess).
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request.headers)) {
    return fail(403, "Forbidden");
  }

  const session = await getAdminSession();
  if (!session || session.scope !== "SETUP") {
    return fail(401, "Unauthorized");
  }

  const { ip, userAgent } = requestMeta();
  if (!attempts.hit(session.adminId).ok) {
    return fail(429, "Too many attempts. Start again from the sign-in page.");
  }

  const body = (await request.json().catch(() => null)) as {
    password?: unknown;
    code?: unknown;
  } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  const code =
    typeof body?.code === "string" ? body.code.replace(/\s+/g, "") : "";

  const problem = adminPasswordProblem(password);
  if (problem) return fail(400, problem, "password");
  if (!/^\d{6}$/.test(code)) {
    return fail(400, "Enter the 6-digit code from your app.", "code");
  }

  const [admin, row] = await Promise.all([
    prisma.adminUser.findUnique({ where: { id: session.adminId } }),
    prisma.adminSession.findUnique({
      where: { id: session.sessionId },
      select: { pendingTotpSecret: true },
    }),
  ]);
  // An invite that ran out while this page was open is not finishable.
  if (!admin || !isInviteOpen(admin) || !row?.pendingTotpSecret) {
    return fail(409, "This invite has expired. Ask for a new one.");
  }

  // The one-time password travelled through a message somewhere, so keeping
  // it would leave the account on a credential other people have seen.
  if (await verifyAdminPassword(password, admin.passwordHash)) {
    return fail(
      400,
      "Choose a different password from the one you were given.",
      "password",
    );
  }

  const counter = verifyTotp(row.pendingTotpSecret, code);
  if (counter === null) {
    return fail(
      400,
      "That code doesn't match. Wait for the next one and try again.",
      "code",
    );
  }

  const [passwordHash, totpSecret] = await Promise.all([
    hashAdminPassword(password),
    sealTotpSecret(row.pendingTotpSecret, password),
  ]);

  // Only while the account is still unfinished, so two tabs can't both
  // complete the same setup and the second one can't reset the first's work.
  const claimed = await prisma.adminUser.updateMany({
    where: { id: admin.id, totpSecret: null, disabled: false },
    data: {
      passwordHash,
      totpSecret,
      // The code just used can't also open a session.
      totpLastCounter: counter,
      setupExpiresAt: null,
      failedLogins: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });
  if (claimed.count !== 1) {
    return fail(409, "This invite has already been used.");
  }

  // The invite is spent, so every session it opened goes with it — including
  // this one, which the response replaces with a full session below.
  await prisma.adminSession.updateMany({
    where: { adminId: admin.id, revokedAt: null },
    data: { revokedAt: new Date(), pendingTotpSecret: null },
  });

  attempts.reset(session.adminId);
  await recordAdminAudit({
    adminId: admin.id,
    username: admin.username,
    action: "setup.completed",
    ip,
  });

  // Both factors were just proved, so they go straight in.
  const full = await createAdminSession(admin.id, { ip, userAgent });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    adminSessionCookieName(),
    full.token,
    adminCookieOptions(full.expiresAt),
  );
  return response;
}
