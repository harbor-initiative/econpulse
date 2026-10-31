/**
 * One sentence about a place, generated once and cached.
 *
 * The numbers are above it. The sentence says what they mean, and it is checked
 * before it is shown: no digits, no advice, and no measure the page does not
 * carry. A summary that fails a check is replaced by a template built from the
 * same facts, so the block is never empty and never wrong.
 *
 * The model is asked once per place per data version. A reader who reloads does
 * not pay for it again, and neither does the next reader.
 */

import type { Fact } from "../store.ts";
import { askSummary } from "./model.ts";

/** Words that turn a description into advice. */
const ADVICE = /\b(recommend|recommends|consider|should|must|try to|ought|we suggest|you may want)\b/i;

/** A digit anywhere defeats the point: the numbers are already on the page. */
const DIGIT = /[0-9]/;

export interface SummaryInput {
  placeName: string;
  panels: Array<{ label: string; fact: Fact | null; nation?: Fact | null; mark?: "better" | "worse" | null }>;
}

export interface Summary {
  text: string;
  source: "model" | "template";
}

const CACHE = new Map<string, Summary>();
const HOUR = 60 * 60 * 1000;
const cachedAt = new Map<string, number>();

/** Calls allowed per hour, so a crawler cannot spend the model allowance. */
const BUDGET = { perHour: Number(process.env.SUMMARY_BUDGET ?? 60), used: 0, since: Date.now() };

function budgetLeft(now: number): boolean {
  if (now - BUDGET.since > HOUR) {
    BUDGET.used = 0;
    BUDGET.since = now;
  }
  return BUDGET.used < BUDGET.perHour;
}

/** True when the sentence says only what the page already shows. */
export function accept(text: string, labels: string[]): boolean {
  if (!text || DIGIT.test(text)) return false;
  if (ADVICE.test(text)) return false;
  if (text.length > 260) return false;
  // Every measure it names has to be one of the panels.
  const named = /\b(unemployment|rent|income|output|poverty|population|education|federal|housing|jobs)\b/gi;
  for (const match of text.matchAll(named)) {
    const word = (match[0] ?? "").toLowerCase();
    const known = labels.some((label) => label.toLowerCase().includes(word));
    if (!known) return false;
  }
  return true;
}

/**
 * The fallback, built from the same facts.
 *
 * Two sentences at most, and the comparisons come from the panels rather than
 * from a second reading of the data.
 */
export function template(input: SummaryInput): string {
  const parts: string[] = [];
  for (const panel of input.panels) {
    if (!panel.fact || !panel.mark) continue;
    const label = panel.label.toLowerCase();
    if (panel.mark === "better") parts.push(`${label} is better than the national figure`);
    else parts.push(`${label} is worse than the national figure`);
    if (parts.length === 2) break;
  }
  if (!parts.length) return "Every measure on this page is within the national range, or has no national figure to compare with.";
  // A panel label is lower case by design; the start of a sentence is not.
  return `${parts.join(". ")}.`
    .replace(/\.\./g, ".")
    .replace(/(^|\. )([a-z])/g, (_match, start: string, letter: string) => `${start}${letter.toUpperCase()}`);
}

function keyFor(placeName: string, dataVersion: string): string {
  return `${placeName}::${dataVersion}`;
}

export async function summarise(input: SummaryInput, dataVersion: string): Promise<Summary> {
  const key = keyFor(input.placeName, dataVersion);
  const cached = CACHE.get(key);
  const at = cachedAt.get(key) ?? 0;
  if (cached && Date.now() - at < HOUR) return cached;

  const labels = input.panels.map((panel) => panel.label);
  const fallback: Summary = { text: template(input), source: "template" };

  if (!budgetLeft(Date.now())) {
    CACHE.set(key, fallback);
    cachedAt.set(key, Date.now());
    return fallback;
  }

  BUDGET.used += 1;
  const comparisons = input.panels
    .filter((panel) => panel.fact && panel.mark)
    .map((panel) => `${panel.label}: ${panel.mark} than the national figure`)
    .join("; ");

  const answer = await askSummary(input.placeName, comparisons || "no national comparison available");
  const text = answer?.trim() ?? "";

  const result = accept(text, labels) ? { text, source: "model" as const } : fallback;
  CACHE.set(key, result);
  cachedAt.set(key, Date.now());
  return result;
}

/** For tests. */
export function resetSummaries(): void {
  CACHE.clear();
  cachedAt.clear();
  BUDGET.used = 0;
  BUDGET.since = Date.now();
}
