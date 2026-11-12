// Community project words and numbers shared by the admin editor and the
// player page. Plain data only: safe in client components.

export type ProjectRepeat = "ONCE" | "SCHEDULE" | "AFTER_COMPLETION";
export type ProjectUnlockMode = "PERMANENT" | "WHILE_REACHED";
export type ProjectRewardSplit = "FLAT" | "BY_SHARE";
export type ProjectEffectType =
  | "SHOP_DISCOUNT"
  | "SELL_BONUS"
  | "STORAGE_SLOTS"
  | "TRAVEL_SPEED"
  | "QUEST_REWARD_BONUS";

export const PROJECT_EFFECTS: Record<
  ProjectEffectType,
  { label: string; suffix: string; max: number; describe: (value: number) => string }
> = {
  SHOP_DISCOUNT: {
    label: "Cheaper shops",
    suffix: "% off",
    max: 90,
    describe: (v) => `Shops here sell ${v}% cheaper`,
  },
  SELL_BONUS: {
    label: "Better selling",
    suffix: "% more",
    max: 500,
    describe: (v) => `NPCs here pay ${v}% more for items`,
  },
  STORAGE_SLOTS: {
    label: "Bigger storage",
    suffix: "slots",
    max: 1_000,
    describe: (v) => `Storage here holds ${v} more stacks`,
  },
  TRAVEL_SPEED: {
    label: "Faster travel here",
    suffix: "% faster",
    max: 90,
    describe: (v) => `Journeys to this region are ${v}% shorter`,
  },
  QUEST_REWARD_BONUS: {
    label: "Richer quests",
    suffix: "% more",
    max: 1_000,
    describe: (v) => `Quests here give ${v}% more gold and XP`,
  },
};

const HOURS_PER = { weeks: 168, days: 24, hours: 1 } as const;
export type DurationUnit = keyof typeof HOURS_PER;

/** The largest whole unit for an hour count, for editing and reading. */
export function splitHours(hours: number): { value: number; unit: DurationUnit } {
  for (const unit of ["weeks", "days"] as const) {
    if (hours % HOURS_PER[unit] === 0) return { value: hours / HOURS_PER[unit], unit };
  }
  return { value: hours, unit: "hours" };
}

export function toHours(value: number, unit: DurationUnit) {
  return Math.max(1, Math.round(value * HOURS_PER[unit]));
}

export function formatHours(hours: number) {
  const { value, unit } = splitHours(hours);
  return `${value} ${value === 1 ? unit.slice(0, -1) : unit}`;
}

export const REPEAT_LABELS: Record<ProjectRepeat, string> = {
  ONCE: "Once",
  SCHEDULE: "On a schedule",
  AFTER_COMPLETION: "Again after it's finished",
};

type SummaryInput = {
  repeat: ProjectRepeat;
  repeatHours: number;
  maxRounds: number | null;
  startsAt: string | null;
  endsAt: string | null;
  unlockMode: ProjectUnlockMode;
  minLevel: number;
  skill: string | null;
  requiredSkillLevel: number;
  maxSharePercent: number | null;
  rewardSplit: ProjectRewardSplit;
  rewardMinSharePercent: number;
  stages: Array<{
    requirements: unknown[];
    rewardGold: number;
    rewardXp: number;
    rewardItems: unknown[];
    effects: Array<{ type: ProjectEffectType; value: number }>;
    unlocks: number;
  }>;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** The project in a few plain sentences, so an admin can check it at a glance. */
export function describeProject(p: SummaryInput): string[] {
  const lines: string[] = [];
  const stages = p.stages.length;
  const items = p.stages.reduce((sum, s) => sum + s.requirements.length, 0);
  lines.push(
    stages > 1
      ? `Players build it in ${stages} stages, one after another (${items} item types in total).`
      : `Players hand in ${items} item type${items === 1 ? "" : "s"} to finish it.`,
  );

  const window = [
    p.startsAt ? `opens ${when(p.startsAt)}` : null,
    p.endsAt ? `closes for good ${when(p.endsAt)}` : null,
  ].filter(Boolean);
  const rounds = p.maxRounds ? `, ${p.maxRounds} time${p.maxRounds === 1 ? "" : "s"} at most` : "";
  if (p.repeat === "SCHEDULE") {
    lines.push(
      `A fresh round starts every ${formatHours(p.repeatHours)}${rounds}, finished or not; unfinished progress is lost.`,
    );
  } else if (p.repeat === "AFTER_COMPLETION") {
    lines.push(
      `When finished, it rests ${formatHours(p.repeatHours)} and then starts over${rounds}.`,
    );
  } else {
    lines.push("It runs once.");
  }
  if (window.length) lines.push(`It ${window.join(" and ")}.`);

  const who = [
    p.minLevel > 1 ? `character level ${p.minLevel}+` : null,
    p.skill ? `${p.skill} level ${p.requiredSkillLevel}+` : null,
  ].filter(Boolean);
  lines.push(
    who.length ? `Only players with ${who.join(" and ")} can help.` : "Everyone can help.",
  );
  if (p.maxSharePercent) {
    lines.push(`One player can supply at most ${p.maxSharePercent}% of each item.`);
  }

  const paid = p.stages.some(
    (s) => s.rewardGold > 0 || s.rewardXp > 0 || s.rewardItems.length > 0,
  );
  if (paid) {
    lines.push(
      (p.rewardSplit === "FLAT"
        ? "Each helper gets the full stage reward"
        : "Each helper gets the stage reward scaled by their share") +
        (p.rewardMinSharePercent > 0
          ? ` if they gave at least ${p.rewardMinSharePercent}% of it.`
          : "."),
    );
  } else {
    lines.push("Helpers get no reward besides the leaderboard.");
  }

  const effects = p.stages.flatMap((s) => s.effects.filter((e) => e.value > 0));
  const unlocks = p.stages.reduce((sum, s) => sum + s.unlocks, 0);
  if (effects.length || unlocks) {
    const parts = [
      unlocks ? `reveals ${unlocks} thing${unlocks === 1 ? "" : "s"}` : null,
      ...effects.map((e) => {
        const text = PROJECT_EFFECTS[e.type].describe(e.value);
        // Lower-case "Shops…", but keep acronyms such as "NPCs".
        return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
      }),
    ].filter(Boolean);
    lines.push(`Reaching it ${parts.join("; ")}.`);
    if (p.repeat !== "ONCE") {
      lines.push(
        p.unlockMode === "PERMANENT"
          ? "Once reached, that stays for good."
          : "That lasts only while the current round has reached it.",
      );
    }
  } else {
    lines.push("It doesn't unlock or change anything yet.");
  }
  return lines;
}

export type ProjectPreset = "ONE_TIME" | "WEEKLY" | "AFTER_COMPLETION";

/** Starting points for "New project", so a new project needs few changes. */
export const PROJECT_PRESETS: Record<
  ProjectPreset,
  { label: string; hint: string; repeat: ProjectRepeat; repeatHours: number; unlockMode: ProjectUnlockMode }
> = {
  ONE_TIME: {
    label: "One-time goal",
    hint: "Build something once, e.g. a bridge that opens a new merchant.",
    repeat: "ONCE",
    repeatHours: 168,
    unlockMode: "PERMANENT",
  },
  WEEKLY: {
    label: "Weekly goal",
    hint: "Resets every week; bonuses last while the week's goal is met.",
    repeat: "SCHEDULE",
    repeatHours: 168,
    unlockMode: "WHILE_REACHED",
  },
  AFTER_COMPLETION: {
    label: "Repeats after finishing",
    hint: "Starts over a day after players finish it.",
    repeat: "AFTER_COMPLETION",
    repeatHours: 24,
    unlockMode: "WHILE_REACHED",
  },
};

/** "YYYY-MM-DDTHH:mm" in the admin's own time zone, for datetime-local inputs. */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}
