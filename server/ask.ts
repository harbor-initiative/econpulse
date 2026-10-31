import type { DatabaseSync } from "node:sqlite";
import { searchPlaces, type Place } from "./store.ts";

/**
 * The question layer.
 *
 * Two inputs, two paths.
 *
 *   "Philadelphia"            -> the index. No model, no network.
 *   "Is rent up in Austin?"   -> the model, then the index again.
 *
 * The split is deliberate. A previous version ran a keyword parser over
 * everything and answered "the Liberty Bell" with Bell County, Texas, because
 * "Bell" was the last word left after the stopwords came out. A question is not
 * a place with the question words removed.
 *
 * The model never receives a GEOID and never returns one. It names the place and
 * picks a measure; the index resolves the name. That makes a hallucinated id
 * impossible, which is the only failure here that would put a wrong number on a
 * page.
 */

export interface Parsed {
  place: Place | null;
  metric: string | null;
  via: "index" | "model" | "none";
  cleaned: string;
}

interface Rule { metric: string; words: string[] }

/** Longest phrases first: "federal spending" must beat "spending". */
const RULES: Rule[] = [
  { metric: "federal_obligations", words: ["federal money", "federal spending", "federal contracts", "federal funding", "federal dollars", "federal"] },
  { metric: "median_home_value", words: ["home value", "home values", "house price", "house prices", "home price", "home prices", "housing market", "property value"] },
  { metric: "median_gross_rent", words: ["rent", "rents", "rental", "renting", "cost of living"] },
  { metric: "median_household_income", words: ["income", "salary", "salaries", "wages", "earn", "earnings", "pay"] },
  { metric: "unemployment_rate", words: ["unemployment", "jobless", "jobs", "hiring", "layoffs", "layoff", "labor market"] },
  { metric: "population", words: ["population", "growing", "grow", "shrinking", "shrink", "declining", "decline", "residents", "boom", "booming"] },
  { metric: "gdp", words: ["gdp", "output", "economy", "economic", "prosperous", "thriving"] },
  { metric: "poverty_rate", words: ["poverty", "poor", "struggling"] },
  { metric: "bachelors_or_higher", words: ["education", "educated", "degree", "college", "university"] },
  { metric: "median_age", words: ["median age", "how old", "age", "young", "retirees"] },
];

const QUESTION_START = /^(is|are|was|were|how|what|where|which|why|when|does|do|did|should|can|could|will|would|compare|tell|show)\b/i;

/**
 * A question wears a question mark, opens with a question word, or is too long
 * to be a name. Everything else is treated as a name.
 */
export function isQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (/\?/.test(trimmed)) return true;
  if (QUESTION_START.test(trimmed)) return true;
  return trimmed.split(/\s+/).length > 5;
}

export function findMetric(text: string): string | null {
  const lower = ` ${text.toLowerCase()} `;
  for (const rule of RULES) {
    for (const word of rule.words) {
      if (lower.includes(` ${word} `) || lower.includes(`${word} `) || lower.includes(` ${word}`)) {
        return rule.metric;
      }
    }
  }
  return null;
}

/** "rent in austin" -> { metric: rent, place: "austin" } */
function splitMetricAndPlace(text: string): { metric: string | null; rest: string } {
  const metric = findMetric(text);
  if (!metric) return { metric: null, rest: text };
  const rule = RULES.find((r) => r.metric === metric);
  let rest = text.toLowerCase();
  for (const word of rule?.words ?? []) rest = rest.split(word).join(" ");
  rest = rest.replace(/\b(in|of|for|the|at|around)\b/g, " ").replace(/\s+/g, " ").trim();
  return { metric, rest };
}

export function resolveName(db: DatabaseSync, name: string): Place | null {
  const candidate = name.trim();
  if (!candidate || candidate.length < 3) return null;
  const places = searchPlaces(db, candidate, 8);
  if (!places.length) return null;
  const lower = candidate.toLowerCase();
  const exact = places.find((p) => (p.short_name ?? p.name).toLowerCase() === lower);
  if (exact) return exact;
  const starts = places.find((p) => (p.short_name ?? p.name).toLowerCase().startsWith(lower));
  return starts ?? places[0] ?? null;
}

/** The no-model path: a name, or "measure in name". */
export function parseLocally(db: DatabaseSync, text: string): Parsed {
  const trimmed = text.trim();

  if (/^\d{2,11}$/.test(trimmed)) {
    const place = searchPlaces(db, trimmed, 1)[0] ?? null;
    return { place, metric: null, via: place ? "index" : "none", cleaned: trimmed };
  }

  const { metric, rest } = splitMetricAndPlace(trimmed);
  const place = resolveName(db, rest || trimmed);
  return { place, metric, via: place ? "index" : "none", cleaned: rest || trimmed };
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

export interface ModelAnswer { placeName: string | null; metric: string | null }

/**
 * The model names a place and picks a measure. It never sees a GEOID, so it
 * cannot invent one, and the answer is resolved against the index afterwards.
 */
export async function askModel(
  question: string,
  metrics: Array<{ id: string; label: string }>,
): Promise<ModelAnswer | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  // openrouter/free is a router: it picks whichever free model is
  // available, so one provider going down does not break the box.
  const model = process.env.ECONPULSE_MODEL ?? process.env.OPENROUTER_MODEL ?? "openrouter/free";
  const metricMenu = metrics.map((m) => `${m.id} (${m.label})`).join(", ");

  const prompt = [
    "You turn a question about a United States place into two fields.",
    'Reply with JSON only, no prose: {"place":"...","metric":"..."}',
    "place: the US city, county, or state the question is about, as a plain name. Use your knowledge. If none is implied, null.",
    `metric: one id from this list, or null if the question is not about a measure: ${metricMenu}`,
    "Examples:",
    'Q: How are things going where the Liberty Bell is -> {"place":"Philadelphia","metric":null}',
    'Q: Is rent going up in Austin? -> {"place":"Austin","metric":"median_gross_rent"}',
    'Q: Are people leaving the city of brotherly love -> {"place":"Philadelphia","metric":"population"}',
    `Q: ${question}`,
  ].join("\n");

  // The free router is occasionally out of capacity. One retry costs a second
  // and turns a visible failure into an invisible one.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          // The free router can land on a reasoning model that spends tokens
          // thinking before it answers. 120 produced an empty answer with
          // finish_reason "length" every time. 400 leaves room for both.
          max_tokens: 400,
          provider: { data_collection: "deny" },
        }),
      });
      if (!response.ok) {
        console.error(`[ask] model ${model} returned ${response.status} (attempt ${attempt + 1})`);
        if (response.status >= 500 && attempt === 0) continue;
        return null;
      }
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(content) as { place?: unknown; metric?: unknown } | null;
      if (!parsed) {
        console.error("[ask] model returned no JSON");
        return null;
      }
      return {
        placeName: typeof parsed.place === "string" && parsed.place.trim() ? parsed.place.trim() : null,
        metric: typeof parsed.metric === "string" && parsed.metric.trim() ? parsed.metric.trim() : null,
      };
    } catch (error) {
      console.error("[ask] model call failed:", (error as Error).message);
      if (attempt === 0) continue;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Question path: model first, then the index resolves the name it returned. */
export async function parseQuestion(
  db: DatabaseSync,
  text: string,
  metrics: Array<{ id: string; label: string }>,
): Promise<Parsed> {
  const answer = await askModel(text, metrics);
  if (answer) {
    const place = answer.placeName ? resolveName(db, answer.placeName) : null;
    const metric = answer.metric && metrics.some((m) => m.id === answer.metric) ? answer.metric : null;
    if (place || metric) return { place, metric, via: place ? "model" : "none", cleaned: answer.placeName ?? text };
  }

  // No key, or the model failed. Do not fall back to the word parser here: it
  // answered "the Liberty Bell" with Bell County, Texas. Asking which place is
  // honest; guessing is not.
  return { place: null, metric: findMetric(text), via: "none", cleaned: text };
}
