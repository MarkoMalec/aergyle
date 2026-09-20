import "server-only";

import type { MessageReportStatus } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";

/** One line of a reported thread, as it stood when the report was filed. */
export type TranscriptLine = {
  at: string;
  senderId: string | null;
  sender: string;
  body: string;
};

export type ReportView = {
  id: number;
  status: MessageReportStatus;
  reason: string | null;
  reporter: string;
  reported: string;
  transcript: TranscriptLine[];
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
};

const REPORT_SELECT = {
  id: true,
  status: true,
  reason: true,
  transcript: true,
  createdAt: true,
  reviewedAt: true,
  reviewNote: true,
  reporter: { select: { name: true } },
  reported: { select: { name: true } },
  reviewedBy: { select: { name: true } },
} as const;

type ReportRow = {
  id: number;
  status: MessageReportStatus;
  reason: string | null;
  transcript: unknown;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  reporter: { name: string | null } | null;
  reported: { name: string | null } | null;
  reviewedBy: { name: string | null } | null;
};

function toView(row: ReportRow): ReportView {
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    reporter: row.reporter?.name ?? "Deleted player",
    reported: row.reported?.name ?? "Deleted player",
    transcript: Array.isArray(row.transcript)
      ? (row.transcript as TranscriptLine[])
      : [],
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy?.name ?? null,
    reviewNote: row.reviewNote,
  };
}

/** Reports for the moderation queue, open ones first and newest first. */
export async function listReports(status?: MessageReportStatus) {
  const rows = await prisma.messageReport.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: "asc" }, { id: "desc" }],
    take: 100,
    select: REPORT_SELECT,
  });
  return rows.map(toView);
}

export function countOpenReports() {
  return prisma.messageReport.count({ where: { status: "OPEN" } });
}

/** Closes a report as handled or as nothing to answer for. */
export async function reviewReport(params: {
  reportId: number;
  reviewerId: string;
  status: Exclude<MessageReportStatus, "OPEN">;
  note?: string;
}) {
  const note = params.note?.trim().slice(0, 1000);
  const row = await prisma.messageReport.update({
    where: { id: params.reportId },
    data: {
      status: params.status,
      reviewNote: note && note.length > 0 ? note : null,
      reviewedById: params.reviewerId,
      reviewedAt: new Date(),
    },
    select: REPORT_SELECT,
  });
  return toView(row);
}
