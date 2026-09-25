import React from "react";
import { AdminShell } from "~/components/admin/AdminShell";
import { getAdminSession } from "~/server/admin/auth";
import { countOpenReports } from "~/server/communication";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Aergyle Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminSession();
  // Signed out, only the login page renders: every other admin page redirects
  // to it on its own (requireAdminPageAccess), so nothing else shows here.
  if (!admin) return <>{children}</>;

  const openReports = await countOpenReports();
  return (
    <AdminShell openReports={openReports} adminName={admin.username}>
      {children}
    </AdminShell>
  );
}
