import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cooldownLeft,
  FRIEND_SEARCH_MIN_LENGTH,
  friendPairKey,
  isEndableFriendRelation,
  readFriendSearchTerm,
} from "../src/game/friends";
import { readLeaderboardScope } from "../src/game/leaderboard";

const HOUR = 3_600_000;

void test("a pair of players share one friend key, whoever asks first", () => {
  assert.equal(friendPairKey("a", "b"), friendPairKey("b", "a"));
  // Different pairs never collide.
  assert.notEqual(friendPairKey("a", "bb"), friendPairKey("ab", "b"));
});

void test("a search term is read as a name tag", () => {
  assert.equal(readFriendSearchTerm("  Tenreed  "), "Tenreed");
  assert.equal(readFriendSearchTerm("@Tenreed"), "Tenreed");
  assert.equal(readFriendSearchTerm("@@ Tenreed"), "Tenreed");
  assert.equal(readFriendSearchTerm("Old  Bridge"), "Old-Bridge");
});

void test("a search term needs a few characters and a string", () => {
  assert.equal(
    readFriendSearchTerm("a".repeat(FRIEND_SEARCH_MIN_LENGTH - 1)),
    null,
  );
  assert.equal(readFriendSearchTerm("@a"), null);
  assert.equal(readFriendSearchTerm("   "), null);
  assert.equal(readFriendSearchTerm(null), null);
  assert.equal(readFriendSearchTerm(42), null);
  assert.equal(
    readFriendSearchTerm("a".repeat(FRIEND_SEARCH_MIN_LENGTH)),
    "a".repeat(FRIEND_SEARCH_MIN_LENGTH),
  );
});

void test("a search term is capped at 64 characters", () => {
  assert.equal(readFriendSearchTerm("a".repeat(200))?.length, 64);
});

void test("only relations with something to undo pass the guard", () => {
  assert.equal(isEndableFriendRelation("friends"), true);
  assert.equal(isEndableFriendRelation("outgoing"), true);
  assert.equal(isEndableFriendRelation("incoming"), true);
  assert.equal(isEndableFriendRelation("none"), false);
  assert.equal(isEndableFriendRelation("self"), false);
  assert.equal(isEndableFriendRelation(undefined), false);
  assert.equal(isEndableFriendRelation("toString"), false);
});

void test("the wait before asking again reads in hours, then days", () => {
  assert.equal(cooldownLeft(1), "1 hour");
  assert.equal(cooldownLeft(5 * HOUR), "5 hours");
  assert.equal(cooldownLeft(47 * HOUR), "47 hours");
  assert.equal(cooldownLeft(72 * HOUR), "3 days");
});

void test("the leaderboard shows everyone unless asked for friends", () => {
  assert.equal(readLeaderboardScope("friends"), "friends");
  assert.equal(readLeaderboardScope("everyone"), "everyone");
  assert.equal(readLeaderboardScope("nonsense"), "everyone");
  assert.equal(readLeaderboardScope(undefined), "everyone");
});
