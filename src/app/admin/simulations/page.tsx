import { SimulationWorkbench } from "~/components/admin/balance/SimulationWorkbench";
import { requireAdminPageAccess } from "~/server/admin/auth";
import { loadBalanceContent } from "~/server/balance/content";
import { loadSavedCurves } from "~/server/balance/leveling";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSimulationsPage() {
  await requireAdminPageAccess();
  const [content, curves] = await Promise.all([
    loadBalanceContent(),
    loadSavedCurves(),
  ]);
  return <SimulationWorkbench content={content} curves={curves} />;
}
