import React from "react";
import { AdminShell } from "~/components/admin/AdminShell";
import { requireAdminPageAccess } from "~/server/admin/auth";
import { countOpenReports } from "~/server/communication";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPageAccess();
  const openReports = await countOpenReports();

  return <AdminShell openReports={openReports}>{children}</AdminShell>;
}
