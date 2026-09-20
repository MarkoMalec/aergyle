import { Panel } from "~/components/admin/fields";
import { BroadcastForm } from "~/components/admin/moderation/BroadcastForm";
import { ReportsQueue } from "~/components/admin/moderation/ReportsQueue";
import { listReports } from "~/server/communication";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminModerationPage() {
  const reports = await listReports();
  const open = reports.filter((report) => report.status === "OPEN").length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Moderation</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/70">
          Conversations players reported, copied in as they stood at the moment
          of the report, so neither side can erase them. Closing a report only
          clears it from this queue; act on the players yourself.
        </p>
        <p className="mt-2 text-xs text-white/50">
          {open === 0
            ? "Nothing waiting."
            : `${open} report${open === 1 ? "" : "s"} waiting for review.`}
        </p>
      </header>

      <Panel
        title="Reported conversations"
        description="Open ones first. Open a report to read the whole conversation."
      >
        <ReportsQueue reports={reports} />
      </Panel>

      <BroadcastForm />
    </div>
  );
}
