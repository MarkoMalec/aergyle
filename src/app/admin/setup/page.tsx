import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { AdminSetupForm } from "~/components/admin/AdminSetupForm";
import { prisma } from "~/lib/prisma";
import { requireAdminSetupSession } from "~/server/admin/auth";
import { ADMIN_LOGIN_PATH } from "~/server/admin/constants";
import {
  ADMIN_PASSWORD_MIN,
  TOTP_ISSUER,
} from "~/server/admin/credentials";
import { totpUri } from "~/server/admin/totp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set up your admin account",
  robots: { index: false, follow: false },
};

export default async function AdminSetupPage() {
  const session = await requireAdminSetupSession();
  const row = await prisma.adminSession.findUnique({
    where: { id: session.sessionId },
    select: { pendingTotpSecret: true },
  });
  // Nothing to enrol means this session is past its purpose.
  if (!row?.pendingTotpSecret) redirect(ADMIN_LOGIN_PATH);

  const uri = totpUri({
    secret: row.pendingTotpSecret,
    account: session.username,
    issuer: TOTP_ISSUER,
  });
  const qr = await QRCode.toDataURL(uri, {
    margin: 1,
    width: 320,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return (
    <main className="admin-theme dark relative min-h-svh overflow-hidden bg-background px-4 py-10 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10%,hsl(var(--primary)/0.14),transparent_70%)]"
      />
      <AdminSetupForm
        username={session.username}
        secret={row.pendingTotpSecret}
        qrDataUrl={qr}
        passwordMin={ADMIN_PASSWORD_MIN}
      />
    </main>
  );
}
