import React from "react";
import { AdminShell } from "~/components/admin/AdminShell";
import { requireAdminPageAccess } from "~/server/admin/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPageAccess();

  return <AdminShell>{children}</AdminShell>;
}
