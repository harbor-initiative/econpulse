/**
 * A ceiling on the one endpoint that costs money.
 *
 * One key, one public URL. A script can spend the day's allowance in a minute
 * and the reader who arrives after it gets a failure that has nothing to do with
 * the question they asked.
 *
 * Two limits, both in memory. State is lost on restart, which is right for an
 * abuse guard and wrong for billing; there is no billing.
 *
 * A token bucket rather than a fixed window, because a fixed window lets a
 * caller send the whole allowance at the end of one minute and the whole
 * allowance again at the start of the next.
 */

export interface Limit {
  /** Requests allowed per window. */
  capacity: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface Decision {
  allowed: boolean;
  /** Seconds until the caller may try again. Zero when allowed. */
  retryAfter: number;
  /** The limit that refused, when one did. */
  limit?: "client" | "global";
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** Per client, per hour. Generous for a person, mean for a loop. */
export const CLIENT_LIMIT: Limit = {
  capacity: Number(process.env.ASK_CLIENT_LIMIT ?? 20),
  windowMs: 60 * 60 * 1000,
};

/** Overall, per minute. The box serves other things too. */
export const GLOBAL_LIMIT: Limit = {
  capacity: Number(process.env.ASK_GLOBAL_LIMIT ?? 60),
  windowMs: 60 * 1000,
};

const clients = new Map<string, Bucket>();
let global: Bucket = { tokens: GLOBAL_LIMIT.capacity, updatedAt: Date.now() };

/** Refill, spend one, and say whether it was there. */
function take(bucket: Bucket, limit: Limit, now: number): { allowed: boolean; retryAfter: number } {
  // A clock that jumps backwards must not drain a bucket. It happens on a VM
  // after a migration, and the first reader afterwards would be told to wait an
  // hour for a question they had not asked.
  const elapsed = Math.max(0, now - bucket.updatedAt);
  const refill = (elapsed / limit.windowMs) * limit.capacity;
  bucket.tokens = Math.min(limit.capacity, bucket.tokens + refill);
  bucket.updatedAt = Math.max(bucket.updatedAt, now);

  if (bucket.tokens < 1) {
    const missing = 1 - bucket.tokens;
    const waitMs = (missing / limit.capacity) * limit.windowMs;
    return { allowed: false, retryAfter: Math.max(1, Math.ceil(waitMs / 1000)) };
  }
  bucket.tokens -= 1;
  return { allowed: true, retryAfter: 0 };
}

/** Drop buckets that have refilled completely. A bucket is a few bytes; this is for the long run. */
export function evict(now: number = Date.now()): number {
  let dropped = 0;
  for (const [key, bucket] of clients) {
    if (now - bucket.updatedAt > CLIENT_LIMIT.windowMs) {
      clients.delete(key);
      dropped += 1;
    }
  }
  return dropped;
}

/**
 * Ask for one question. The client bucket is consulted first so one caller
 * cannot spend the global allowance and starve everybody else.
 */
export function allow(clientKey: string, now: number = Date.now()): Decision {
  const bucket = clients.get(clientKey) ?? { tokens: CLIENT_LIMIT.capacity, updatedAt: now };
  clients.set(clientKey, bucket);

  const client = take(bucket, CLIENT_LIMIT, now);
  if (!client.allowed) return { allowed: false, retryAfter: client.retryAfter, limit: "client" };

  const shared = take(global, GLOBAL_LIMIT, now);
  if (!shared.allowed) {
    // The client did not spend a question, so give the token back.
    bucket.tokens = Math.min(CLIENT_LIMIT.capacity, bucket.tokens + 1);
    return { allowed: false, retryAfter: shared.retryAfter, limit: "global" };
  }

  return { allowed: true, retryAfter: 0 };
}

/** The clock and the counters, for tests. The clock it starts from is the caller's. */
export function reset(now: number = Date.now()): void {
  clients.clear();
  global = { tokens: GLOBAL_LIMIT.capacity, updatedAt: now };
}

/** The caller, as far as this process can tell. Behind Caddy this is the real address. */
export function clientKey(headers: Record<string, string | string[] | undefined>, remote?: string): string {
  const forwarded = headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const address = (first ?? "").split(",")[0]?.trim();
  return address || remote || "unknown";
}
