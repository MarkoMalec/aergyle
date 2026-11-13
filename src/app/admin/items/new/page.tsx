import React from "react";
import { ItemForm } from "~/components/admin/items/ItemForm";
import { requireAdminPageAccess } from "~/server/admin/auth";
import { loadEnchantBonusTable } from "~/server/enchanting/config";

export const dynamic = "force-dynamic";

export default async function AdminNewItemPage() {
  await requireAdminPageAccess();
  return (
    <ItemForm mode="create" enchantBonuses={await loadEnchantBonusTable()} />
  );
}
