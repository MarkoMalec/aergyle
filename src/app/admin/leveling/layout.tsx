import type React from "react";
import { requireAdminPageAccess } from "~/server/admin/auth";

// The leveling page is a client component, so the guard sits in its segment.
export default async function LevelingAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPageAccess();
  return children;
}
