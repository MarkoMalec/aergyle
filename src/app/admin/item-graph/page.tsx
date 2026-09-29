import { ItemGraphExplorer } from "~/components/admin/itemGraph/ItemGraphExplorer";
import { requireAdminPageAccess } from "~/server/admin/auth";
import { loadItemGraphContent } from "~/server/itemGraph/content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminItemGraphPage() {
  await requireAdminPageAccess();
  const content = await loadItemGraphContent();
  return <ItemGraphExplorer content={content} />;
}
