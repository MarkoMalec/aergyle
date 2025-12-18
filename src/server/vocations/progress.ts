import type { UserVocationalActivity } from "@prisma/client";

export type VocationalProgress = {
  now: Date;
  startedAt: Date;
  endsAt: Date;
  unitSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  unitsTotal: number;
  unitsClaimable: number;
  unitProgress: number; // 0..1
  isComplete: boolean;
};

export function computeVocationalProgress(
  activity: Pick<
    UserVocationalActivity,
    "startedAt" | "endsAt" | "unitSeconds" | "unitsClaimed"
  >,
  now = new Date(),
): VocationalProgress {
  const startedAt = new Date(activity.startedAt);
  const endsAt = new Date(activity.endsAt);
  const unitSeconds = Math.max(1, activity.unitSeconds);

  const durationMs = Math.max(0, endsAt.getTime() - startedAt.getTime());
  const elapsedMsRaw = now.getTime() - startedAt.getTime();
  const elapsedMs = Math.min(Math.max(0, elapsedMsRaw), durationMs);

  const unitMs = unitSeconds * 1000;

  const unitsTotal = Math.floor(elapsedMs / unitMs);
  const unitsClaimable = Math.max(0, unitsTotal - activity.unitsClaimed);

  const unitProgress = durationMs === 0 ? 1 : (elapsedMs % unitMs) / unitMs;
  const remainingSeconds = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));

  return {
    now,
    startedAt,
    endsAt,
    unitSeconds,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    remainingSeconds,
    unitsTotal,
    unitsClaimable,
    unitProgress,
    isComplete: now.getTime() >= endsAt.getTime(),
  };
}
