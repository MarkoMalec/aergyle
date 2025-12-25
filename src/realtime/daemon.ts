import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import fs from "fs";
import path from "path";
import { verifyRealtimeToken } from "~/server/realtime/token";

type PrismaClientLike = {
  userVocationalActivity: {
    findMany: (...args: any[]) => Promise<any[]>;
  };
};

type Client = {
  ws: WebSocket;
  userId: string;
  lastSeenAt: number;
};

type ServerEvent =
  | {
      type: "vocational_tick";
      userId: string;
      claimedUnits: number;
      grantedQuantity: number;
      remainingClaimableUnits: number;
      at: string;
    }
  | {
      type: "inventory_changed";
      userId: string;
      at: string;
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
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function send(ws: WebSocket, event: ServerEvent) {
  try {
    ws.send(JSON.stringify(event));
  } catch {
    // ignore
  }
}

function broadcastToUser(clientsByUserId: Map<string, Set<Client>>, userId: string, event: ServerEvent) {
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

async function tickLoop(
  clientsByUserId: Map<string, Set<Client>>,
  prisma: PrismaClientLike,
  claimVocationalRewards: (params: { userId: string; maxUnits?: number }) => Promise<{
    claimedUnits: number;
    grantedQuantity: number;
    remainingClaimableUnits: number;
  }>,
) {
  // Simple loop: every 250ms check due ticks.
  // This is intentionally simple for your early stage.
  // Later: optimize by scheduling next due tick via min-heap.
  const intervalMs = Number(process.env.VOCATION_TICK_LOOP_MS ?? 250);

  // Prevent overlapping iterations if a claim takes longer than interval.
  let running = false;

  setInterval(async () => {
    if (running) return;
    running = true;

    try {
      const now = new Date();

      // Fetch active activities that have not ended.
      const activities = await prisma.userVocationalActivity.findMany({
        where: {
          endsAt: { gt: now },
        },
        select: {
          userId: true,
          startedAt: true,
          endsAt: true,
          unitSeconds: true,
          unitsClaimed: true,
        },
      });

      for (const a of activities) {
        const unitMs = Math.max(1, Math.floor(a.unitSeconds)) * 1000;
        const nextTickAt = new Date(a.startedAt.getTime() + (a.unitsClaimed + 1) * unitMs);

        if (now < nextTickAt) continue;

        // Claim exactly one unit if due. Server remains authoritative.
        const result = await claimVocationalRewards({ userId: a.userId, maxUnits: 1 });
        if (result.claimedUnits <= 0) continue;

        console.log(
          `[realtime-daemon] tick user=${a.userId} claimedUnits=${result.claimedUnits} grantedQty=${result.grantedQuantity}`,
        );

        const at = new Date().toISOString();
        broadcastToUser(clientsByUserId, a.userId, {
          type: "vocational_tick",
          userId: a.userId,
          claimedUnits: result.claimedUnits,
          grantedQuantity: result.grantedQuantity,
          remainingClaimableUnits: result.remainingClaimableUnits,
          at,
        });
        broadcastToUser(clientsByUserId, a.userId, {
          type: "inventory_changed",
          userId: a.userId,
          at,
        });
      }
    } catch (err) {
      console.error("[realtime-daemon] tick loop error", err);
    } finally {
      running = false;
    }
  }, intervalMs);
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

  // Import after env is loaded so Prisma sees DATABASE_URL.
  const modPrisma = await import("~/lib/prisma");
  const modVoc = await import("~/server/vocations/service");
  const prisma = modPrisma.prisma as unknown as PrismaClientLike;
  const claimVocationalRewards = modVoc.claimVocationalRewards as unknown as (
    params: { userId: string; maxUnits?: number },
  ) => Promise<{ claimedUnits: number; grantedQuantity: number; remainingClaimableUnits: number }>;

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

    console.log(`[realtime-daemon] connected user=${userId} clients=${set.size}`);

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

    // Hello
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

  await tickLoop(clientsByUserId, prisma, claimVocationalRewards);
}

main().catch((err) => {
  console.error("[realtime-daemon] fatal", err);
  process.exit(1);
});
