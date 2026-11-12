import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dueRound,
  playerContributionCap,
  projectPhase,
  stageRewardFor,
  sumProjectEffects,
  type ProjectTiming,
} from "../src/server/settlements/rules";

const H = 60 * 60 * 1_000;
const t0 = new Date("2026-11-02T00:00:00Z");
const at = (hours: number) => new Date(t0.getTime() + hours * H);
const base: ProjectTiming = {
  repeat: "ONCE",
  repeatHours: 24,
  maxRounds: null,
  startsAt: null,
  endsAt: null,
  createdAt: t0,
  round: 1,
  completedAt: null,
};

test("one-time projects never roll over", () => {
  assert.equal(dueRound({ ...base, completedAt: at(1) }, at(500)), null);
  assert.equal(projectPhase(base, at(5)).phase, "open");
  assert.equal(projectPhase({ ...base, completedAt: at(1) }, at(5)).phase, "done");
});

test("scheduled rounds follow the clock, finished or not", () => {
  const p: ProjectTiming = { ...base, repeat: "SCHEDULE", startsAt: t0 };
  assert.equal(dueRound(p, at(23)), null);
  assert.deepEqual(dueRound(p, at(50)), { round: 3, startedAt: at(48) });
  assert.deepEqual(projectPhase(p, at(5)), { phase: "open", until: at(24) });
  assert.deepEqual(projectPhase({ ...p, completedAt: at(3) }, at(5)), {
    phase: "waiting",
    until: at(24),
  });
  // Capped rounds: the last one ends the project.
  const capped = { ...p, maxRounds: 2 };
  assert.deepEqual(dueRound(capped, at(100)), { round: 2, startedAt: at(24) });
  assert.equal(projectPhase({ ...capped, round: 2 }, at(100)).phase, "ended");
  assert.equal(
    projectPhase({ ...capped, round: 2, completedAt: at(30) }, at(100)).phase,
    "done",
  );
});

test("after-completion rounds wait out the cooldown", () => {
  const p: ProjectTiming = { ...base, repeat: "AFTER_COMPLETION", repeatHours: 12 };
  assert.equal(dueRound(p, at(100)), null);
  const done = { ...p, completedAt: at(10) };
  assert.deepEqual(projectPhase(done, at(15)), { phase: "waiting", until: at(22) });
  assert.deepEqual(dueRound(done, at(22)), { round: 2, startedAt: at(22) });
  assert.equal(dueRound({ ...done, maxRounds: 1 }, at(99)), null);
  assert.equal(projectPhase({ ...done, maxRounds: 1 }, at(99)).phase, "done");
});

test("windows hide and close projects", () => {
  assert.equal(projectPhase({ ...base, startsAt: at(10) }, at(5)).phase, "upcoming");
  assert.equal(projectPhase({ ...base, endsAt: at(10) }, at(11)).phase, "ended");
  assert.deepEqual(projectPhase({ ...base, endsAt: at(10) }, at(1)), {
    phase: "open",
    until: at(10),
  });
});

test("contribution caps and rewards", () => {
  assert.equal(playerContributionCap(1_000, null), 1_000);
  assert.equal(playerContributionCap(1_000, 25), 250);
  assert.equal(playerContributionCap(3, 10), 1);
  const reward = { gold: 100, xp: 50, items: [{ itemId: 1, quantity: 3 }] };
  assert.deepEqual(stageRewardFor(0.1, reward, "FLAT", 5), reward);
  assert.equal(stageRewardFor(0.01, reward, "FLAT", 5), null);
  assert.equal(stageRewardFor(0, reward, "FLAT", 0), null);
  assert.deepEqual(stageRewardFor(0.5, reward, "BY_SHARE", 0), {
    gold: 50,
    xp: 25,
    items: [{ itemId: 1, quantity: 1 }],
  });
});

test("effects stack within their caps", () => {
  const total = sumProjectEffects([
    { type: "SHOP_DISCOUNT", value: 60 },
    { type: "SHOP_DISCOUNT", value: 60 },
    { type: "STORAGE_SLOTS", value: 4.7 },
  ]);
  assert.equal(total.SHOP_DISCOUNT, 90);
  assert.equal(total.STORAGE_SLOTS, 4);
  assert.equal(total.TRAVEL_SPEED, 0);
});
