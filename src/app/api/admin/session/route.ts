import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import {
  adminCookieOptions,
  createAdminSession,
  getAdminSession,
  recordAdminAudit,
  requestMeta,
  revokeCurrentAdminSession,
} from "~/server/admin/auth";
import { adminSessionCookieName } from "~/server/admin/constants";
import {
  ADMIN_LOCKOUT_MINUTES,
  ADMIN_MAX_FAILED_LOGINS,
  normalizeAdminUsername,
  verifyAdminPassword,
} from "~/server/admin/credentials";
import { openTotpSecret, verifyTotp } from "~/server/admin/totp";
import { isSameOriginRequest } from "~/server/security/origin";
import { sharedRateLimiter } from "~/server/security/rateLimit";

export const dynamic = "force-dynamic";

// Across all usernames, so guessing different accounts from one address
// doesn't get around the per-account lockout.
const attemptsByIp = sharedRateLimiter("admin-login-ip", {
  limit: 10,
  windowMs: 15 * 60_000,
});

const INVALID = "Invalid username, password or code.";

function minutesUntil(date: Date) {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60_000));
}

/** Signs in with username, password and the authenticator code. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request.headers)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { ip, userAgent } = requestMeta();
  const limit = attemptsByIp.hit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    username?: unknown;
    password?: unknown;
    code?: unknown;
  } | null;
  const username =
    typeof body?.username === "string"
      ? normalizeAdminUsername(body.username)
      : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const code =
    typeof body?.code === "string" ? body.code.replace(/\s+/g, "") : "";
  if (
    !username ||
    username.length > 64 ||
    !password ||
    password.length > 256 ||
    !/^\d{6}$/.test(code)
  ) {
    return NextResponse.json(
      { error: "Enter your username, password and the 6-digit code." },
      { status: 400 },
    );
  }

  const admin = await prisma.adminUser.findUnique({ where: { username } });
  const now = new Date();

  if (admin?.lockedUntil && admin.lockedUntil > now) {
    await recordAdminAudit({
      adminId: admin.id,
      username,
      action: "login.locked",
      ip,
    });
    return NextResponse.json(
      {
        error: `Too many failed attempts. This account is locked for ${minutesUntil(admin.lockedUntil)} more min.`,
      },
      { status: 429 },
    );
  }

  // The password is always checked, even for unknown usernames, so response
  // times don't reveal which accounts exist.
  const passwordOk = await verifyAdminPassword(password, admin?.passwordHash);
  let counter: number | null = null;
  if (admin && !admin.disabled && passwordOk) {
    const secret = await openTotpSecret(admin.totpSecret, password);
    counter = secret ? verifyTotp(secret, code) : null;
    // A code that already opened a session can't open another one.
    if (
      counter !== null &&
      admin.totpLastCounter !== null &&
      counter <= admin.totpLastCounter
    ) {
      counter = null;
    }
  }

  const claimed =
    admin && counter !== null
      ? await prisma.adminUser.updateMany({
          where: {
            id: admin.id,
            disabled: false,
            OR: [
              { totpLastCounter: null },
              { totpLastCounter: { lt: counter } },
            ],
          },
          data: {
            totpLastCounter: counter,
            failedLogins: 0,
            lockedUntil: null,
            lastLoginAt: now,
          },
        })
      : null;

  if (!admin || !claimed || claimed.count !== 1) {
    if (admin && !admin.disabled) {
      const { failedLogins } = await prisma.adminUser.update({
        where: { id: admin.id },
        data: { failedLogins: { increment: 1 } },
        select: { failedLogins: true },
      });
      if (failedLogins >= ADMIN_MAX_FAILED_LOGINS) {
        await prisma.adminUser.update({
          where: { id: admin.id },
          data: {
            failedLogins: 0,
            lockedUntil: new Date(
              now.getTime() + ADMIN_LOCKOUT_MINUTES * 60_000,
            ),
          },
        });
      }
    }
    await recordAdminAudit({
      adminId: admin?.id ?? null,
      username,
      action: "login.failed",
      ip,
    });
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  attemptsByIp.reset(ip);
  const session = await createAdminSession(admin.id, { ip, userAgent });
  await recordAdminAudit({
    adminId: admin.id,
    username: admin.username,
    action: "login",
    ip,
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    adminSessionCookieName(),
    session.token,
    adminCookieOptions(session.expiresAt),
  );
  return response;
}

/** Signs out: ends the session server-side and clears the cookie. */
export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request.headers)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = await getAdminSession();
  await revokeCurrentAdminSession();
  if (admin) {
    await recordAdminAudit({
      adminId: admin.adminId,
      username: admin.username,
      action: "logout",
      ip: requestMeta().ip,
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminSessionCookieName(), "", {
    ...adminCookieOptions(new Date(0)),
    maxAge: 0,
  });
  return response;
}
