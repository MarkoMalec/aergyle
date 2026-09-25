/**
 * In-memory sliding-window limits for sign-in and registration. The app runs
 * as one Node process, so memory is shared by every request; a restart
 * forgets old attempts, which only ever errs towards letting players in.
 */

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the oldest counted attempt falls out of the window. */
  retryAfterSeconds: number;
};

export type RateLimiter = {
  /** Counts an attempt for `key`; `ok` is false once the key is over its limit. */
  hit(key: string, now?: number): RateLimitResult;
  /** Reports the key's state without counting an attempt. */
  peek(key: string, now?: number): RateLimitResult;
  /** Forgets the key, e.g. after a successful sign-in. */
  reset(key: string): void;
};

const SWEEP_EVERY = 500;

export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const attempts = new Map<string, number[]>();
  let hitsSinceSweep = 0;

  const recent = (key: string, now: number) => {
    const since = now - options.windowMs;
    const kept = (attempts.get(key) ?? []).filter((at) => at > since);
    if (kept.length > 0) attempts.set(key, kept);
    else attempts.delete(key);
    return kept;
  };

  const result = (kept: number[], now: number): RateLimitResult => {
    const ok = kept.length <= options.limit;
    const oldest = kept[0] ?? now;
    return {
      ok,
      retryAfterSeconds: ok
        ? 0
        : Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000)),
    };
  };

  // Keys nobody retries would otherwise stay in memory forever.
  const sweep = (now: number) => {
    for (const key of [...attempts.keys()]) recent(key, now);
  };

  return {
    hit(key, now = Date.now()) {
      if (++hitsSinceSweep >= SWEEP_EVERY) {
        hitsSinceSweep = 0;
        sweep(now);
      }
      const kept = recent(key, now);
      kept.push(now);
      attempts.set(key, kept);
      return result(kept, now);
    },
    peek(key, now = Date.now()) {
      const kept = recent(key, now);
      return {
        ok: kept.length < options.limit,
        retryAfterSeconds:
          kept.length < options.limit
            ? 0
            : Math.max(
                1,
                Math.ceil(((kept[0] ?? now) + options.windowMs - now) / 1000),
              ),
      };
    },
    reset(key) {
      attempts.delete(key);
    },
  };
}

/**
 * One limiter per name for the whole process. Next can load a module once per
 * bundle, so the registry lives on globalThis rather than in module scope.
 */
export function sharedRateLimiter(
  name: string,
  options: { limit: number; windowMs: number },
): RateLimiter {
  const registry = ((globalThis as { __aergyleRateLimiters?: Map<string, RateLimiter> })
    .__aergyleRateLimiters ??= new Map<string, RateLimiter>());
  let limiter = registry.get(name);
  if (!limiter) {
    limiter = createRateLimiter(options);
    registry.set(name, limiter);
  }
  return limiter;
}

type HeaderSource =
  | Headers
  | Record<string, string | string[] | undefined>
  | undefined;

function readHeader(headers: HeaderSource, name: string): string | undefined {
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) ?? undefined;
  }
  const value = (headers as Record<string, string | string[] | undefined>)[
    name
  ];
  return Array.isArray(value) ? value[value.length - 1] : value;
}

/**
 * The client address as the reverse proxy saw it. Apache appends the peer
 * address to X-Forwarded-For, so only the last entry is trustworthy; earlier
 * entries arrive with the request and can be anything.
 */
export function getClientIp(headers: HeaderSource): string {
  const forwarded = readHeader(headers, "x-forwarded-for");
  const last = forwarded?.split(",").pop()?.trim();
  if (last) return last.slice(0, 64);
  const realIp = readHeader(headers, "x-real-ip")?.trim().slice(0, 64);
  return realIp ? realIp : "local";
}
