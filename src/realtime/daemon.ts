import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import fs from "fs";
import path from "path";
import { verifyRealtimeToken } from "~/server/realtime/token";
import type { ActivityTickEvent, RealtimeServerEvent } from "~/realtime/events";

type Client = {
  ws: WebSocket;
  userId: string;
  lastSeenAt: number;
};

type TickPayload = Pick<
  ActivityTickEvent,
  "skill" | "label" | "itemChanges" | "newStacks" | "stopReason"
>;

/** One kind of ticking activity: finds players with a tick due and settles it. */
type Ticker = {
  activity: ActivityTickEvent["activity"];
  findDueUserIds: (now: Date) => Promise<string[]>;
  /** Settles one player's due ticks; null when there's nothing to tell them. */
  settle: (userId: string) => Promise<TickPayload | null>;
};

const PORT = Number(process.env.REALTIME_WS_PORT ?? 3001);

function loadDotEnvIfPresent() {
  // Next.js auto-loads .env files, but this standalone daemon does not.
  // This tiny loader keeps RPi usage simple without adding extra dependencies.
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (!key) continue;
    if (process.env[key] !== undefined) continue; // don't override

    // strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function send(ws: WebSocket, event: RealtimeServerEvent) {
  try {
    ws.send(JSON.stringify(event));
  } catch {
    // ignore
  }
}

function broadcastToUser(
  clientsByUserId: Map<string, Set<Client>>,
  userId: string,
  event: RealtimeServerEvent,
) {
  const set = clientsByUserId.get(userId);
  if (!set || set.size === 0) return;
  for (const client of set) send(client.ws, event);
}

function parseTokenFromUrl(url: string) {
  try {
    const u = new URL(url, "http://localhost");
    return u.searchParams.get("token");
  } catch {
    return null;
  }
}

async function loadTickers(): Promise<Ticker[]> {
  // Import after env is loaded so Prisma sees DATABASE_URL. These modules must stay
  // free of `server-only` imports: this process runs outside Next.js.
  const [
    { prisma },
    { claimVocationalRewards },
    { computeVocationalProgress },
    garden,
    harvestSchedule,
  ] = await Promise.all([
    import("~/lib/prisma"),
    import("~/server/vocations/claim"),
    import("~/server/vocations/progress"),
    import("~/server/garden/service"),
    import("~/server/garden/harvestSchedule"),
  ]);

  return [
    {
      activity: "VOCATION",
      findDueUserIds: async (now) => {
        const activities = await prisma.userVocationalActivity.findMany({
          select: {
            userId: true,
            startedAt: true,
            endsAt: true,
            unitSeconds: true,
            unitsClaimed: true,
          },
        });
        return activities
          .filter((activity) => {
            const progress = computeVocationalProgress(activity, now);
            return progress.unitsClaimable > 0 || progress.isComplete;
          })
          .map((activity) => activity.userId);
      },
      settle: async (userId) => {
        const claim = await claimVocationalRewards({ userId });
        if (!claim.summary || (claim.claimedUnits <= 0 && !claim.stopReason)) {
          return null;
        }
        return {
          skill: claim.summary.actionType,
          label: claim.summary.resourceName,
          itemChanges: claim.itemChanges,
          newStacks: claim.newStacks,
          stopReason: claim.stopReason,
        };
      },
    },
    {
      activity: "GARDEN",
      findDueUserIds: async (now) => {
        const harvests = await prisma.userGardenHarvestActivity.findMany({
          select: { userId: true, startedAt: true, tiles: true },
        });
        return harvests
          .filter((harvest) => harvestSchedule.hasDueHarvestTiles(harvest, now))
          .map((harvest) => harvest.userId);
      },
      settle: async (userId) => {
        const settlement = await garden.settleGardenHarvest(userId);
        if (settlement.harvestedTiles <= 0 && !settlement.stopReason) {
          return null;
        }
        return {
          skill: "GARDENING",
          label: "Harvest",
          itemChanges: settlement.itemChanges,
          newStacks: settlement.newStacks,
          stopReason: settlement.stopReason,
        };
      },
    },
  ];
}

function startTickLoop(
  clientsByUserId: Map<string, Set<Client>>,
  tickers: Ticker[],
) {
  // Simple loop: every VOCATION_TICK_LOOP_MS settle whatever came due.
  // Later: schedule each player's next tick precisely (min-heap) instead of polling.
  const intervalMs = Number(process.env.VOCATION_TICK_LOOP_MS ?? 250);

  // Prevent overlapping iterations if settling takes longer than the interval.
  let running = false;

  // A settlement that throws rolls its transaction back, which leaves the
  // player still due. Without a backoff the loop retries that same failure on
  // every iteration forever, paying for a full transaction each time - one
  // wedged player is enough to load the database indefinitely.
  const failures = new Map<string, { count: number; nextAttemptAt: number }>();
  const FAILURES_BEFORE_BACKOFF = 3;
  const MAX_BACKOFF_MS = 5 * 60_000;

  const settleDueTicks = async () => {
    if (running) return;
    running = true;

    try {
      const now = new Date();

      for (const ticker of tickers) {
        let userIds: string[];
        try {
          userIds = await ticker.findDueUserIds(now);
        } catch (err) {
          console.error(
            `[realtime-daemon] ${ticker.activity} lookup failed`,
            err,
          );
          continue;
        }

        for (const userId of userIds) {
          const failureKey = `${ticker.activity}:${userId}`;
          const failure = failures.get(failureKey);
          if (failure && Date.now() < failure.nextAttemptAt) continue;

          // Each player settles on their own: one failure must not hold up everyone else.
          try {
            const tick = await ticker.settle(userId);
            if (failure) failures.delete(failureKey);
            if (!tick) continue;

            console.log(
              `[realtime-daemon] ${ticker.activity} tick user=${userId} changes=${tick.itemChanges.length}${tick.stopReason ? ` stop=${tick.stopReason}` : ""}`,
            );

            broadcastToUser(clientsByUserId, userId, {
              type: "activity_tick",
              userId,
              activity: ticker.activity,
              ...tick,
              at: new Date().toISOString(),
            });
          } catch (err) {
            const count = (failure?.count ?? 0) + 1;
            const backoffMs =
              count <= FAILURES_BEFORE_BACKOFF
                ? 0
                : Math.min(
                    MAX_BACKOFF_MS,
                    1_000 * 2 ** (count - FAILURES_BEFORE_BACKOFF - 1),
                  );
            failures.set(failureKey, {
              count,
              nextAttemptAt: Date.now() + backoffMs,
            });

            console.error(
              `[realtime-daemon] ${ticker.activity} tick failed user=${userId} (failure ${count}${backoffMs > 0 ? `, retrying in ${Math.round(backoffMs / 1000)}s` : ""})`,
              err,
            );
          }
        }
      }
    } finally {
      running = false;
    }
  };

  setInterval(() => void settleDueTicks(), intervalMs);
}

async function main() {
  loadDotEnvIfPresent();

  const secret = process.env.REALTIME_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "REALTIME_TOKEN_SECRET is required to run the realtime daemon (set it in env).",
    );
  }

  const clientsByUserId = new Map<string, Set<Client>>();
  const tickers = await loadTickers();

  const wss = new WebSocketServer({ port: PORT });
  console.log(`[realtime-daemon] WebSocket server listening on :${PORT}`);

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const token = parseTokenFromUrl(req.url ?? "");
    if (!token) {
      ws.close(1008, "Missing token");
      return;
    }

    const payload = verifyRealtimeToken(token, secret);
    if (!payload) {
      ws.close(1008, "Invalid token");
      return;
    }

    const userId = payload.sub;
    const client: Client = { ws, userId, lastSeenAt: Date.now() };

    let set = clientsByUserId.get(userId);
    if (!set) {
      set = new Set();
      clientsByUserId.set(userId, set);
    }
    set.add(client);

    console.log(
      `[realtime-daemon] connected user=${userId} clients=${set.size}`,
    );

    ws.on("pong", () => {
      client.lastSeenAt = Date.now();
    });

    ws.on("close", () => {
      const s = clientsByUserId.get(userId);
      if (!s) return;
      s.delete(client);
      if (s.size === 0) clientsByUserId.delete(userId);

      console.log(`[realtime-daemon] disconnected user=${userId}`);
    });

    // Optional: allow clients to send keepalive pings.
    ws.on("message", () => {
      client.lastSeenAt = Date.now();
    });

    // Hello: lets the client resync anything that changed while it was disconnected.
    send(ws, {
      type: "inventory_changed",
      userId,
      at: new Date().toISOString(),
    });
  });

  // Ping clients to keep connections healthy.
  setInterval(() => {
    const now = Date.now();
    for (const [, set] of clientsByUserId) {
      for (const client of set) {
        if (now - client.lastSeenAt > 60_000) {
          try {
            client.ws.terminate();
          } catch {
            // ignore
          }
          continue;
        }
        try {
          client.ws.ping();
        } catch {
          // ignore
        }
      }
    }
  }, 30_000);

  startTickLoop(clientsByUserId, tickers);
}

main().catch((err) => {
  console.error("[realtime-daemon] fatal", err);
  process.exit(1);
});
