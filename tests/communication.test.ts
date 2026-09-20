import assert from "node:assert/strict";
import { test } from "node:test";
import {
  conversationPairKey,
  isNotificationCategory,
  systemPairKey,
  timeAgo,
} from "../src/game/communication";

void test("a pair of players share one conversation key, whoever writes first", () => {
  assert.equal(
    conversationPairKey("ckb_alice", "cka_bob"),
    conversationPairKey("cka_bob", "ckb_alice"),
  );
  // Different pairs never collide, and a pair never looks like a system key.
  assert.notEqual(
    conversationPairKey("a", "b"),
    conversationPairKey("a", "bb"),
  );
  assert.notEqual(conversationPairKey("system", "a"), systemPairKey("a"));
});

void test("the game's thread with a player is its own key", () => {
  assert.equal(systemPairKey("cka_bob"), "system|cka_bob");
});

void test("only real categories pass the filter guard", () => {
  assert.equal(isNotificationCategory("SETTLEMENT"), true);
  assert.equal(isNotificationCategory("ALL"), false);
  assert.equal(isNotificationCategory("toString"), false);
  assert.equal(isNotificationCategory(undefined), false);
});

void test("notification times read as plain English", () => {
  const ago = (seconds: number) => new Date(Date.now() - seconds * 1000);
  assert.equal(timeAgo(ago(5)), "Just now");
  assert.equal(timeAgo(ago(60)), "1 minute ago");
  assert.equal(timeAgo(ago(13 * 60)), "13 minutes ago");
  assert.equal(timeAgo(ago(18 * 3600)), "18 hours ago");
  assert.equal(timeAgo(ago(3 * 86_400)), "3 days ago");
  // Past a week it becomes a date rather than a count.
  assert.match(timeAgo(ago(30 * 86_400)), /\d/);
  assert.equal(timeAgo("not a date"), "");
});
