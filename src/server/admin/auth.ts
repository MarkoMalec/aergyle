import "server-only";

import crypto from "crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getClientIp } from "~/server/security/rateLimit";
import { isSafeMethod, isSameOriginRequest } from "~/server/security/origin";
import {
  ADMIN_LOGIN_PATH,
  adminSessionCookieName,
  usesSecureCookies,
} from "./constants";

/**
 * /admin has its own accounts and sessions, separate from player sign-in.
 * The cookie holds a random token; only its SHA-256 is stored, so a copy of
 * the database can't be turned into a working session. Sessions end after
 * ADMIN_SESSION_MAX_AGE_SECONDS, or sooner when idle.
 */

export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const ADMIN_SESSION_IDLE_SECONDS = 60 * 60;
// Recording activity on every request would be one write per click.
const TOUCH_AFTER_MS = 60_000;

export type AdminSessionInfo = {
  sessionId: string;
  adminId: string;
  username: string;
  expiresAt: Date;
};

export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function adminCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: usesSecureCookies(),
    sameSite: "strict" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function createAdminSession(
  adminId: string,
  meta: { ip: string; userAgent: string | null },
) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000);
  await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash: hashSessionToken(token),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

async function loadSession(token: string | undefined) {
  if (!token || token.length > 128) return null;

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      revokedAt: true,
      admin: { select: { id: true, username: true, disabled: true } },
    },
  });
  if (!session || session.revokedAt !== null || session.admin.disabled) {
    return null;
  }

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) return null;
  const idleMs = now - session.lastSeenAt.getTime();
  if (idleMs > ADMIN_SESSION_IDLE_SECONDS * 1000) return null;
  if (idleMs > TOUCH_AFTER_MS) {
    await prisma.adminSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(now) },
    });
  }

  return {
    sessionId: session.id,
    adminId: session.admin.id,
    username: session.admin.username,
    expiresAt: session.expiresAt,
  } satisfies AdminSessionInfo;
}

/** The admin signed in on this request, or null. Cached per request. */
export const getAdminSession = cache(
  async (): Promise<AdminSessionInfo | null> =>
    loadSession(cookies().get(adminSessionCookieName())?.value),
);

/**
 * Every admin page calls this first. The layout checks too, but Next renders
 * only the changed segments on navigation, so a layout check alone would not
 * run for every page request.
 */
export async function requireAdminPageAccess(): Promise<AdminSessionInfo> {
  const admin = await getAdminSession();
  if (!admin) redirect(ADMIN_LOGIN_PATH);
  return admin;
}

/**
 * Guards an admin API route. Returns a response to send back when access is
 * denied, or null to carry on. Changes must come from our own pages and are
 * written to the audit log before they run.
 */
export async function requireAdminApiAccess(
  req: Request,
): Promise<NextResponse | null> {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSafeMethod(req.method)) {
    if (!isSameOriginRequest(req.headers)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await recordAdminAudit({
      adminId: admin.adminId,
      username: admin.username,
      action: `${req.method} ${new URL(req.url).pathname}`,
      ip: getClientIp(req.headers),
    });
  }
  return null;
}

export async function recordAdminAudit(entry: {
  adminId: string | null;
  username: string;
  action: string;
  ip: string | null;
}) {
  await prisma.adminAuditLog.create({
    data: {
      adminId: entry.adminId,
      username: entry.username.slice(0, 64),
      action: entry.action.slice(0, 191),
      ip: entry.ip,
    },
  });
}

/** Ends the session behind this request's cookie, if any. */
export async function revokeCurrentAdminSession() {
  const token = cookies().get(adminSessionCookieName())?.value;
  if (!token) return;
  await prisma.adminSession.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function requestMeta() {
  const requestHeaders = headers();
  return {
    ip: getClientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent"),
  };
}
