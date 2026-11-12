import { WorldHub } from "./View";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminWorldPage(props: {
  searchParams: { tab?: string };
}) {
  await requireAdminPageAccess();
  return <WorldHub {...props} />;
}
