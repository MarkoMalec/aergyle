import React from "react";
import { ItemForm } from "~/components/admin/items/ItemForm";
import { requireAdminPageAccess } from "~/server/admin/auth";

export default async function AdminNewItemPage() {
  await requireAdminPageAccess();
  return <ItemForm mode="create" />;
}
