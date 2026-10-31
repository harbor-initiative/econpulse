import type { DatabaseSync } from "node:sqlite";
import { searchPlaces, type Place } from "./store.ts";

/**
 * The question layer.
 *
 * Most questions a person asks about a place do not need a model. "Is rent
 * going up in Austin" is a metric and a place, and both are in the file. So the
 * deterministic pass runs first, always, and the model is a fallback for the
 * questions it cannot place.
 *
 * That ordering is the design: the no-key path is the normal path, not the
 * degraded one.
 */

export interface Parsed {
  place: Place | null;
  metric: string | null;
  /** How the answer was reached, shown to the reader and logged for tuning. */
  via: "exact" | "keyword" | "model" | "none";
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
  { metric: "population", words: ["population", "growing", "grow", "shrinking", "shrink", "declining", "decline", "people", "residents", "bigger", "smaller", "boom", "booming"] },
  { metric: "gdp", words: ["gdp", "output", "economy", "economic", "prosperous", "thriving"] },
  { metric: "poverty_rate", words: ["poverty", "poor", "struggling"] },
  { metric: "bachelors_or_higher", words: ["education", "educated", "degree", "college", "university"] },
  { metric: "median_age", words: ["median age", "how old", "age", "young", "older", "retirees"] },
];

const STOPWORDS = new Set([
  "is", "are", "was", "were", "the", "a", "an", "in", "at", "for", "of", "to", "and", "or",
  "how", "what", "where", "when", "why", "does", "do", "did", "my", "our", "your", "their",
  "this", "that", "it", "its", "here", "there", "town", "city", "county", "area", "place",
  "compare", "versus", "vs", "me", "show", "tell", "about", "going", "up", "down", "much",
  "many", "good", "bad", "better", "worse", "people", "live", "living", "like", "than",
  "can", "i", "afford", "house", "home", "buy", "renting", "expensive", "cheap", "cost",
]);

function findMetric(text: string): { metric: string; matched: string } | null {
  const lower = ` ${text.toLowerCase()} `;
  for (const rule of RULES) {
    for (const word of rule.words) {
      if (lower.includes(` ${word} `) || lower.includes(`${word} `) || lower.includes(` ${word}`)) {
        return { metric: rule.metric, matched: word };
      }
    }
  }
  return null;
}

/** Strip the metric words and question filler, leaving the place name. */
function stripToPlace(text: string, matched: string | null): string {
  let out = ` ${text.toLowerCase().replace(/[?.!,]/g, " ")} `;
  if (matched) out = out.split(` ${matched} `).join(" ").split(matched).join(" ");
  const words = out.split(/\s+/).filter((w) => w && !STOPWORDS.has(w));
  return words.join(" ").trim();
}

function bestPlace(db: DatabaseSync, candidate: string): Place | null {
  if (!candidate || candidate.length < 3) return null;
  const places = searchPlaces(db, candidate, 8);
  if (!places.length) return null;

  // An exact name match wins. Otherwise take the biggest place, because a
  // question about "Springfield" almost always means the one people know.
  const lower = candidate.toLowerCase();
  const exact = places.find((p) => (p.short_name ?? p.name).toLowerCase() === lower);
  if (exact) return exact;
  return places[0] ?? null;
}

export function parseQuestion(db: DatabaseSync, raw: string): Parsed {
  const text = raw.trim().slice(0, 200);
  const lower = text.toLowerCase();

  // A bare GEOID or ZIP is a place, not a question.
  if (/^\d{2,11}$/.test(text)) {
    const byId = searchPlaces(db, text, 1)[0] ?? null;
    return { place: byId, metric: null, via: byId ? "exact" : "none", cleaned: text };
  }

  const metric = findMetric(lower);
  const remainder = stripToPlace(lower, metric?.matched ?? null);

  // Try the whole remainder, then progressively drop leading words so
  // "is philadelphia growing" still finds Philadelphia.
  const words = remainder.split(" ").filter(Boolean);
  for (let i = 0; i < Math.min(words.length, 4); i += 1) {
    const candidate = words.slice(i).join(" ");
    const place = bestPlace(db, candidate);
    if (place) {
      return { place, metric: metric?.metric ?? null, via: metric ? "keyword" : "exact", cleaned: candidate };
    }
  }

  return { place: null, metric: metric?.metric ?? null, via: "none", cleaned: remainder };
}

export interface ModelChoice { geoid: string | null; metric: string | null }

/**
 * The optional model pass.
 *
 * It may only choose from a menu. It never sees the database and never produces
 * a number, so a wrong choice produces a wrong question, not a wrong fact.
 */
export async function askModel(
  db: DatabaseSync,
  question: string,
  metrics: Array<{ id: string; label: string }>,
): Promise<ModelChoice | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const candidates = searchPlaces(db, question.slice(0, 60), 5);
  const placeMenu = candidates.map((p) => `${p.geoid}: ${p.name}${p.state_code ? `, ${p.state_code}` : ""}`);
  const metricMenu = metrics.map((m) => `${m.id}: ${m.label}`);

  const prompt = [
    "You map a question to one place and one measure. Reply with JSON only.",
    `Places: ${placeMenu.join(" | ") || "none"}`,
    `Measures: ${metricMenu.join(" | ")}`,
    `Question: ${question}`,
    'Reply exactly: {"geoid":"...","metric":"..."} using an id from the lists, or null for either.',
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "google/gemini-2.0-flash-exp:free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 120,
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { geoid?: string | null; metric?: string | null };
    return { geoid: parsed.geoid ?? null, metric: parsed.metric ?? null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
