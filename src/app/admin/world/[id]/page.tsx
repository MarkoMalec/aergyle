import { RegionWorkspace } from "./View";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminRegionPage(props: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  await requireAdminPageAccess();
  return <RegionWorkspace {...props} />;
}
