import React from "react";
import { ItemForm } from "~/components/admin/items/ItemForm";
import { requireAdminPageAccess } from "~/server/admin/auth";

export default async function AdminNewItemPage() {
  await requireAdminPageAccess();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Item</h1>
        <p className="text-sm text-white/70">Create a new item template.</p>
      </div>
      <ItemForm mode="create" />
    </div>
  );
}
