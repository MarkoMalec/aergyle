"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { adminRequest, inputClass } from "~/components/admin/fields";
import { Button } from "~/components/ui/button";
import type { MessageReportStatus } from "~/generated/prisma/enums";
import type { ReportView } from "~/server/communication";
import { cn } from "~/lib/utils";

const STATUS_STYLES: Record<MessageReportStatus, string> = {
  OPEN: "bg-amber-400/15 text-amber-300",
  RESOLVED: "bg-emerald-400/15 text-emerald-300",
  DISMISSED: "bg-white/10 text-white/50",
};

export function ReportsQueue({ reports }: { reports: ReportView[] }) {
  const [openId, setOpenId] = useState<number | null>(
    reports.find((report) => report.status === "OPEN")?.id ?? null,
  );

  if (reports.length === 0) {
    return <p className="text-sm text-white/45">No reports yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {reports.map((report) => (
        <li key={report.id} className="rounded-lg bg-black/25">
          <button
            type="button"
            onClick={() => setOpenId(openId === report.id ? null : report.id)}
            className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
          >
            <span
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                STATUS_STYLES[report.status],
              )}
            >
              {report.status}
            </span>
            <span className="text-sm font-semibold">{report.reported}</span>
            <span className="text-xs text-white/45">
              reported by {report.reporter}
            </span>
            <span className="ml-auto text-xs text-white/35">
              {new Date(report.createdAt).toLocaleString()}
            </span>
          </button>

          {openId === report.id ? <ReportDetail report={report} /> : null}
        </li>
      ))}
    </ul>
  );
}

function ReportDetail({ report }: { report: ReportView }) {
  const router = useRouter();
  const [note, setNote] = useState(report.reviewNote ?? "");
  const [saving, setSaving] = useState<MessageReportStatus | null>(null);

  const close = async (status: "RESOLVED" | "DISMISSED") => {
    setSaving(status);
    try {
      await adminRequest(
        `/api/admin/moderation/reports/${report.id}`,
        "PATCH",
        {
          status,
          note,
        },
      );
      toast.success(status === "RESOLVED" ? "Marked handled" : "Dismissed");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4 border-t border-white/10 px-4 py-4">
      {report.reason ? (
        <p className="text-sm text-white/70">
          <span className="text-white/40">Reason given: </span>
          {report.reason}
        </p>
      ) : (
        <p className="text-sm text-white/40">No reason given.</p>
      )}

      <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-black/30 p-3">
        {report.transcript.length === 0 ? (
          <p className="text-sm text-white/40">
            The conversation was empty when it was reported.
          </p>
        ) : (
          report.transcript.map((line, index) => (
            <div key={index} className="text-sm">
              <div className="flex items-baseline gap-2 text-xs text-white/40">
                <span
                  className={cn(
                    "font-semibold",
                    line.senderId === null ? "text-white/50" : "text-white/70",
                  )}
                >
                  {line.sender}
                </span>
                <span>{new Date(line.at).toLocaleString()}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-white/85">
                {line.body}
              </p>
            </div>
          ))
        )}
      </div>

      {report.status === "OPEN" ? (
        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="space-y-1 text-xs text-white/55">
            <span className="font-medium text-white/70">
              Note (kept with the report)
            </span>
            <input
              className={inputClass}
              value={note}
              maxLength={1000}
              placeholder="What you did about it"
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <Button
            size="sm"
            variant="secondary"
            disabled={saving !== null}
            onClick={() => void close("DISMISSED")}
          >
            Dismiss
          </Button>
          <Button
            size="sm"
            disabled={saving !== null}
            onClick={() => void close("RESOLVED")}
          >
            {saving === "RESOLVED" ? "Saving…" : "Mark handled"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-white/45">
          Closed by {report.reviewedBy ?? "a moderator"} on{" "}
          {report.reviewedAt
            ? new Date(report.reviewedAt).toLocaleString()
            : "an unknown date"}
          {report.reviewNote ? ` — ${report.reviewNote}` : ""}
        </p>
      )}
    </div>
  );
}
