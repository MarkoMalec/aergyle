import { NextResponse, type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "~/lib/prisma";
import { env } from "~/env";
import { getServerAuthSession } from "~/server/auth";

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function isAdminUser(userId: string | null | undefined) {
  if (!userId) return false;

  const allowedUserIds = new Set(parseCsv(env.ADMIN_USER_IDS));
  if (allowedUserIds.size > 0) {
    return allowedUserIds.has(userId);
  }

  const allowedEmails = new Set(parseCsv(env.ADMIN_EMAILS).map((e) => e.toLowerCase()));
  if (allowedEmails.size > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const email = user?.email?.toLowerCase();
    return Boolean(email && allowedEmails.has(email));
  }

  // Fallback: if no allowlist is configured, allow any authenticated user.
  // (Recommended: set ADMIN_EMAILS or ADMIN_USER_IDS in production.)
  return true;
}

export async function requireAdminPageAccess() {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/signin");
  }

  const ok = await isAdminUser(userId);
  if (!ok) {
    redirect("/profile");
  }

  return { session };
}

export async function requireAdminApiAccess(req: NextRequest) {
  const session = await getServerAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await isAdminUser(userId);
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
