import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  playerNameSchema,
  registerSchema,
  safeCallbackPath,
  sanitizePlayerName,
} from "../src/lib/auth-rules";
import {
  base32Decode,
  base32Encode,
  hotp,
  openTotpSecret,
  sealTotpSecret,
  totpUri,
  verifyTotp,
} from "../src/server/admin/totp";
import { adminPasswordProblem } from "../src/server/admin/credentials";
import {
  createRateLimiter,
  getClientIp,
} from "../src/server/security/rateLimit";
import { isSameOriginRequest } from "../src/server/security/origin";
import {
  checkConservation,
  fitSlots,
  parseSlotLayout,
} from "../src/server/items/inventoryLayout";

/* ---------------------------------------------------------------- TOTP */

// RFC 6238 appendix B, SHA-1 secret "12345678901234567890", last 6 digits.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
const RFC_VECTORS: Array<[number, string]> = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

void test("TOTP matches the RFC 6238 test vectors", () => {
  for (const [seconds, code] of RFC_VECTORS) {
    assert.equal(hotp(base32Decode(RFC_SECRET), Math.floor(seconds / 30)), code);
    assert.equal(
      verifyTotp(RFC_SECRET, code, { nowMs: seconds * 1000, window: 0 }),
      Math.floor(seconds / 30),
    );
  }
});

void test("TOTP accepts one step of clock drift and nothing more", () => {
  const nowMs = 1234567890 * 1000;
  const counter = Math.floor(1234567890 / 30);
  const secret = base32Decode(RFC_SECRET);
  assert.equal(verifyTotp(RFC_SECRET, hotp(secret, counter - 1), { nowMs }), counter - 1);
  assert.equal(verifyTotp(RFC_SECRET, hotp(secret, counter + 1), { nowMs }), counter + 1);
  assert.equal(verifyTotp(RFC_SECRET, hotp(secret, counter + 2), { nowMs }), null);
  assert.equal(verifyTotp(RFC_SECRET, "12345", { nowMs }), null);
  assert.equal(verifyTotp(RFC_SECRET, "abcdef", { nowMs }), null);
});

void test("base32 round-trips and the otpauth link carries the secret", () => {
  const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
  assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
  const uri = totpUri({ secret: RFC_SECRET, account: "marko", issuer: "Aergyle Admin" });
  assert.match(uri, /^otpauth:\/\/totp\/Aergyle%20Admin%3Amarko\?/);
  assert.equal(new URL(uri).searchParams.get("secret"), RFC_SECRET);
});

void test("a sealed authenticator secret opens only with the right password", async () => {
  const sealed = await sealTotpSecret(RFC_SECRET, "correct horse battery");
  assert.ok(!sealed.includes(RFC_SECRET));
  assert.equal(await openTotpSecret(sealed, "correct horse battery"), RFC_SECRET);
  assert.equal(await openTotpSecret(sealed, "wrong password here"), null);
  assert.equal(await openTotpSecret("v1.garbage", "correct horse battery"), null);
});

void test("admin passwords need 12 characters", () => {
  assert.ok(adminPasswordProblem("short"));
  assert.equal(adminPasswordProblem("long enough pass"), null);
});

/* ------------------------------------------------------- rate limiting */

void test("the rate limiter blocks over the limit and forgets old attempts", () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(limiter.hit("k", 0).ok, true);
  assert.equal(limiter.hit("k", 100).ok, true);
  assert.equal(limiter.peek("k", 150).ok, false);
  const blocked = limiter.hit("k", 200);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  assert.equal(limiter.hit("other", 200).ok, true);
  // The first two attempts have left the window by now.
  assert.equal(limiter.hit("k", 1150).ok, true);
  limiter.reset("k");
  assert.equal(limiter.peek("k", 1150).ok, true);
});

void test("the client address is the one the proxy appended", () => {
  assert.equal(getClientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" })), "1.2.3.4");
  assert.equal(getClientIp({ "x-forwarded-for": "9.9.9.9" }), "9.9.9.9");
  assert.equal(getClientIp(new Headers()), "local");
});

/* ------------------------------------------------------ CSRF / origin */

void test("only same-origin requests may change things", () => {
  process.env.NEXTAUTH_URL = "https://mmo.markomalec.com";
  const check = (headers: Record<string, string>) =>
    isSameOriginRequest(new Headers(headers));

  assert.equal(check({ "sec-fetch-site": "same-origin" }), true);
  // A sibling subdomain is "same site" but not the same origin.
  assert.equal(check({ "sec-fetch-site": "same-site", origin: "https://n8n.markomalec.com" }), false);
  assert.equal(check({ "sec-fetch-site": "cross-site" }), false);
  // Older browsers only send Origin.
  assert.equal(check({ origin: "https://mmo.markomalec.com" }), true);
  assert.equal(check({ origin: "https://evil.example" }), false);
  assert.equal(check({ origin: "http://localhost:3000", host: "localhost:3000" }), true);
  // No browser headers at all: not a browser, so no victim cookies either.
  assert.equal(check({}), true);
});

/* ------------------------------------------------ names and redirects */

void test("player names are readable and bounded", () => {
  assert.equal(playerNameSchema.parse("  Šime   Ćosić "), "Šime Ćosić");
  assert.equal(playerNameSchema.safeParse("ab").success, false);
  assert.equal(playerNameSchema.safeParse("x".repeat(21)).success, false);
  assert.equal(playerNameSchema.safeParse("<script>").success, false);
  assert.equal(playerNameSchema.safeParse("Rowan​Ash").success, false);
  assert.equal(sanitizePlayerName("  ✨Dark__Lord✨ "), "Dark_Lord");
  assert.equal(sanitizePlayerName("🔥🔥"), "");
});

void test("registration needs a real email and an 8+ character password", () => {
  assert.equal(
    registerSchema.safeParse({ name: "Rowan", email: "a@b.co", password: "1234567" }).success,
    false,
  );
  const ok = registerSchema.parse({ name: "Rowan", email: " A@B.co ", password: "12345678" });
  assert.equal(ok.email, "a@b.co");
  assert.equal(
    registerSchema.safeParse({ name: "Rowan", email: "a@b.co", password: "é".repeat(40) }).success,
    false,
  );
});

void test("post-login redirects stay on this site", () => {
  assert.equal(safeCallbackPath("/marketplace?tab=sell"), "/marketplace?tab=sell");
  assert.equal(safeCallbackPath("//evil.example"), "/profile");
  assert.equal(safeCallbackPath("https://evil.example"), "/profile");
  assert.equal(safeCallbackPath("/\\evil.example"), "/profile");
  assert.equal(safeCallbackPath(null), "/profile");
});

/* ------------------------------------------------- inventory layouts */

void test("a layout must be a list of distinct, well-formed slots", () => {
  assert.ok(parseSlotLayout([{ slotIndex: 0, item: { id: 5 } }, { slotIndex: 1, item: null }]));
  assert.equal(parseSlotLayout([{ slotIndex: 0, item: null }, { slotIndex: 0, item: null }]), null);
  assert.equal(parseSlotLayout([{ slotIndex: -1, item: null }]), null);
  assert.equal(parseSlotLayout([{ slotIndex: 0, item: { id: "5" } }]), null);
  assert.equal(parseSlotLayout([{ slotIndex: 0, item: { id: 1.5 } }]), null);
  assert.equal(parseSlotLayout("nope"), null);
  assert.equal(parseSlotLayout(Array.from({ length: 501 }, (_, i) => ({ slotIndex: i, item: null }))), null);
});

void test("a move keeps exactly the items the player carries", () => {
  const carried = new Set([1, 2, 3]);
  assert.deepEqual(checkConservation(carried, [3, 1, 2]), { ok: true });
  assert.deepEqual(checkConservation(carried, [1, 1, 2, 3]), { ok: false, reason: "duplicate" });
  assert.deepEqual(checkConservation(carried, [1, 2, 3, 99]), { ok: false, reason: "added" });
  assert.deepEqual(checkConservation(carried, [1, 2]), { ok: false, reason: "missing" });
});

void test("a smaller bag moves items into free slots and never drops them", () => {
  const slots = [
    { slotIndex: 0, item: { id: 1 } },
    { slotIndex: 1, item: null },
    { slotIndex: 2, item: { id: 2 } },
  ];
  assert.deepEqual(fitSlots(slots, 2), {
    slots: [
      { slotIndex: 0, item: { id: 1 } },
      { slotIndex: 1, item: { id: 2 } },
    ],
    overflow: 0,
  });
  assert.equal(fitSlots(slots, 1).overflow, 1);
  const kept = fitSlots(slots, 1, { extend: true });
  assert.deepEqual(kept.slots.map((slot) => slot.item?.id), [1, 2]);
});

/* -------------------------------------------------------- admin guards */

function filesNamed(dir: string, name: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return filesNamed(full, name);
    return entry === name ? [full] : [];
  });
}

const root = path.join(import.meta.dirname, "..");

void test("every admin page checks the admin session itself", () => {
  const adminDir = path.join(root, "src/app/admin");
  for (const page of filesNamed(adminDir, "page.tsx")) {
    if (page.endsWith(path.join("admin", "login", "page.tsx"))) continue;
    // A page may rely on a guard in its own segment's layouts (not the root
    // admin layout, which doesn't re-render on navigation).
    let guarded = readFileSync(page, "utf8").includes("requireAdminPageAccess()");
    for (let dir = path.dirname(page); !guarded && dir !== adminDir; dir = path.dirname(dir)) {
      try {
        guarded = readFileSync(path.join(dir, "layout.tsx"), "utf8").includes(
          "requireAdminPageAccess()",
        );
      } catch {
        // No layout in this segment.
      }
    }
    assert.ok(guarded, `${path.relative(root, page)} must call requireAdminPageAccess()`);
  }
});

void test("every admin API handler checks the admin session", () => {
  for (const route of filesNamed(path.join(root, "src/app/api/admin"), "route.ts")) {
    if (route.includes(path.join("admin", "session"))) continue;
    const source = readFileSync(route, "utf8");
    const handlers = source.match(/^export async function (GET|POST|PUT|PATCH|DELETE)/gm) ?? [];
    const guards = source.match(/requireAdminApiAccess\(/g) ?? [];
    assert.equal(guards.length, handlers.length, path.relative(root, route));
  }
});
