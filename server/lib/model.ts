/**
 * The one place this server talks to a model. It names a place and picks a
 * measure, never a GEOID. The free router answers 429 under load, so a model
 * list, one retry, a breaker and an hour-long cache sit in front of it. Every
 * outcome logs one line, so the failure rate is visible in `docker logs`.
 */
export interface ModelAnswer { placeName: string | null; metric: string | null; compareTo: string | null }
/** What became of one question. The route turns this into a page state. */
export type ModelStatus = "ok" | "cached" | "unreadable" | "unavailable" | "failed" | "off";
export interface ModelOutcome { answer: ModelAnswer | null; status: ModelStatus }
export interface ModelContext {
  /** The build the answer is about. A new build is a new cache entry. */
  dataVersion: string;
  /** Injected clock and pause, so the breaker and the cache are testable. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";
const REQUEST_TIMEOUT_MS = 12_000;
const RETRY_PAUSE_MS = 500;
const BREAKER_FAILURES = 3;
const BREAKER_OPEN_MS = 60_000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_LIMIT = 500;
const cache = new Map<string, { answer: ModelAnswer; at: number }>();
let failures = 0;
let openedAt: number | null = null;

/** Clear the breaker and the cache. Production never calls this; tests do. */
export function resetModelState(): void {
  cache.clear();
  failures = 0;
  openedAt = null;
}
/** True when an answer is missing because the model could not be reached. */
export function isModelUnavailable(outcome: ModelOutcome | undefined): boolean {
  return outcome?.status === "unavailable" || outcome?.status === "failed";
}
/** First balanced JSON object in a string, ignoring anything around it. */
export function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/**
 * `ECONPULSE_MODEL` is a comma-separated list in priority order, sent as
 * OpenRouter's `models` array so its router tries the next id on an error.
 */
function modelIds(): string[] {
  const raw = process.env.ECONPULSE_MODEL ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  const ids = [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
  return ids.length ? ids : [DEFAULT_MODEL];
}

function log(ids: string[], status: ModelStatus, detail = ""): void {
  const line = `[ask] model ${ids.join(",")} status ${status}${detail ? ` ${detail}` : ""}`;
  if (status === "ok" || status === "cached") console.log(line);
  else console.error(line);
}

function promptFor(question: string, metrics: Array<{ id: string; label: string }>): string {
  const metricMenu = metrics.map((m) => `${m.id} (${m.label})`).join(", ");
  return `You turn a question about a United States place into two fields.
Reply with JSON only, no prose: {"place":"...","metric":"..."}
place: the US city, county, or state the question is about, as a plain name. Use your knowledge. If none is implied, null.
metric: one id from this list, or null if the question is not about a measure: ${metricMenu}
Examples:
Q: How are things going where the Liberty Bell is -> {"place":"Philadelphia","metric":null}
Q: Is rent going up in Austin? -> {"place":"Austin","metric":"median_gross_rent"}
Q: Are people leaving the city of brotherly love -> {"place":"Philadelphia","metric":"population"}
Q: ${question}`;
}

function retryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}
/** Null when the content holds no JSON object. An empty object is an answer. */
function parseAnswer(content: string): ModelAnswer | null {
  const parsed = extractJson(content) as { place?: unknown; metric?: unknown; compareTo?: unknown } | null;
  if (!parsed) return null;
  const text = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return { placeName: text(parsed.place), metric: text(parsed.metric), compareTo: text(parsed.compareTo) };
}

/** One attempt, one retry on a rate limit, a 5xx or a timeout; then give up. */
export async function askModel(
  question: string,
  metrics: Array<{ id: string; label: string }>,
  context: ModelContext,
): Promise<ModelOutcome> {
  const key = process.env.OPENROUTER_API_KEY;
  const ids = modelIds();
  if (!key) return { answer: null, status: "off" };

  const now = context.now ?? Date.now;
  const sleep = context.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const askedAt = now();
  const cacheKey = `${context.dataVersion}\u0000${question.trim().toLowerCase().replace(/\s+/g, " ")}`;
  const hit = cache.get(cacheKey);
  // A cache hit is served even while the breaker is open: the data has not moved.
  if (hit && askedAt - hit.at < CACHE_TTL_MS) {
    log(ids, "cached");
    return { answer: hit.answer, status: "cached" };
  }
  if (hit) cache.delete(cacheKey);
  if (openedAt !== null) {
    if (askedAt - openedAt < BREAKER_OPEN_MS) {
      log(ids, "unavailable", "breaker open");
      return { answer: null, status: "unavailable" };
    }
    // Half-open: the count stays at the threshold, so one failed probe reopens.
    openedAt = null;
  }
  const prompt = promptFor(question, metrics);
  let status: ModelStatus = "unavailable";
  let detail = "network error";
  let attempts = 0;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    attempts = attempt;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let retry = false;
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          models: ids,
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          // A reasoning model on the free router spends tokens before it answers.
          // 120 produced an empty answer with finish_reason "length"; 400 leaves
          // room for both.
          max_tokens: 400,
          provider: { data_collection: "deny" },
        }),
      });
      if (!response.ok) {
        detail = `http ${response.status}`;
        status = retryable(response.status) ? "unavailable" : "failed";
        retry = retryable(response.status) && attempt < 2;
      } else {
        let payload: { choices?: Array<{ message?: { content?: string } }>; model?: string };
        try { payload = (await response.json()) as typeof payload; }
        catch { failures = 0; log(ids, "unreadable", "http 200, unreadable body"); return { answer: null, status: "unreadable" }; }
        const answer = parseAnswer(payload.choices?.[0]?.message?.content ?? "");
        if (!answer) {
          // The provider answered: an availability success and a content
          // failure, so the breaker resets and nothing is cached.
          failures = 0;
          log(ids, "unreadable", "http 200, no JSON");
          return { answer: null, status: "unreadable" };
        }
        failures = 0;
        cache.set(cacheKey, { answer, at: now() });
        if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
        log(ids, "ok", payload.model ? `used ${payload.model}` : "");
        return { answer, status: "ok" };
      }
    } catch (error) {
      detail = (error as Error).name === "AbortError" ? "timeout" : "network error";
      status = "unavailable";
      retry = attempt < 2;
    } finally {
      clearTimeout(timer);
    }
    if (retry) await sleep(RETRY_PAUSE_MS); else break;
  }

  failures += 1;
  if (failures >= BREAKER_FAILURES) openedAt = now();
  log(ids, status, `${detail} after ${attempts} attempt${attempts === 1 ? "" : "s"}`);
  return { answer: null, status };
}

/**
 * One sentence about a place, for the header block.
 *
 * Deliberately separate from `askModel`: that one turns a question into a place
 * and a measure and must never invent either, and this one turns facts into
 * prose and must never invent a number. Sharing a prompt between them would
 * make one contract do two jobs.
 *
 * The caller validates the answer. This returns the text or null, and nothing
 * here decides whether it is fit to show.
 */
export async function askSummary(placeName: string, comparisons: string): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  const ids = modelIds();
  if (!key) return null;

  const prompt = [
    "You describe a United States place in at most two sentences, for a reader who can see the numbers above your sentence.",
    "Rules: do not write any digit. Do not give advice, predictions or recommendations. Do not mention a measure that is not in the list. Plain English, present tense.",
    `Place: ${placeName}`,
    `Comparisons against the national figure: ${comparisons}`,
    "Write the two sentences.",
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        models: ids,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 400,
        provider: { data_collection: "deny" },
      }),
    });
    if (!response.ok) {
      console.error(`[summary] model returned ${response.status}`);
      return null;
    }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = (payload.choices?.[0]?.message?.content ?? "").trim();
    return content || null;
  } catch (error) {
    console.error(`[summary] call failed: ${(error as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
