/**
 * The six faces of the question box.
 *
 * A busy model, an unreadable answer, and a place the file does not carry all
 * used to reach the same place picker. These are the states that replace it:
 * the card, the two "which", the busy model, the unreadable answer, and the
 * place that is not in the file.
 *
 * Every state wears the same shape: a crumb, the question, one sentence, one way
 * forward. The shape lives in `statePage`, so the copy in one state cannot drift
 * away from the page in another. The answered state is the card in
 * `views/ask.ts`, which the spec marks as existing.
 */

import type { Place } from "../store.ts";
import { esc, shell } from "./layout.ts";
import { CLIENT_LIMIT } from "../lib/ratelimit.ts";

interface StatePage {
  /** The page title, without the site suffix. */
  title: string;
  question: string;
  /** One sentence. The caller escapes any value inside it. */
  sentence: string;
  /** The way forward: a retry form, measure chips, or the full report. */
  action: string;
}

/** The one shape: crumb, question, sentence, way forward. */
function statePage({ title, question, sentence, action }: StatePage): string {
  return shell(
    `${title} — EconPulse`,
    `<p class="crumb">You asked</p>
     <h1 class="place" style="font-size:1.6rem">${esc(question)}</h1>
     <p class="sub">${sentence}</p>
     ${action}`,
  );
}

/** Ask the same question again, with the examples that show what the box reads. */
function retryAndExamples(question: string, label: string, examples: string[]): string {
  return `<form class="search" action="/ask" method="get" style="margin-left:0">
       <input type="search" name="q" value="${esc(question)}" aria-label="${esc(label)}">
     </form>
     <div class="chips" style="justify-content:flex-start">${examples
       .map((e) => `<a class="chip" href="/ask?q=${encodeURIComponent(e)}">${esc(e)}</a>`)
       .join("")}</div>`;
}

/** A measure was read, a place was not. */
export function askNeedPlace(question: string, metricLabel: string | null, examples: string[]): string {
  const sentence = metricLabel
    ? `I can answer that with ${esc(metricLabel.toLowerCase())}, but I need a place.`
    : "I need a place to answer that.";
  return statePage({
    title: "Which place?",
    question,
    sentence,
    action: retryAndExamples(question, "Try again with a place", examples),
  });
}

/** A place was read, a measure was not. */
export function askNeedMetric(question: string, place: Place, metrics: Array<{ id: string; label: string }>): string {
  return statePage({
    title: place.name,
    question,
    sentence: `I found ${esc(place.name)}. Pick a measure, or open the full report.`,
    action: `<div class="chips" style="justify-content:flex-start;margin-top:1rem">
       ${metrics.map((m) => `<a class="chip" href="/ask?q=${encodeURIComponent(`${m.label} in ${place.name}`)}">${esc(m.label)}</a>`).join("")}
       <a class="chip" href="/p/${esc(place.geoid)}">Full report</a>
     </div>`,
  });
}

/** The model was asked and did not answer. #19 owns this copy. */
export function askModelBusy(question: string, examples: string[]): string {
  return statePage({
    title: "Model unavailable",
    question,
    sentence: "The model that reads questions is unavailable right now. Try again in a minute, or ask with a place name and a measure.",
    action: retryAndExamples(question, "Try again in a minute", examples),
  });
}

/** The model answered, and the answer carried no place and no measure. */
export function askUnreadable(question: string, examples: string[]): string {
  return statePage({
    title: "I could not read that answer",
    question,
    sentence: "I could not read that answer.",
    action: retryAndExamples(question, "Try again", examples),
  });
}

/** Neither the index nor a model produced a place. */
/**
 * The ceiling, explained.
 *
 * A 429 with a retry hint is a fact about the server and not about the reader's
 * question, so the sentence says which limit was reached and when it lifts.
 */
export function askRateLimited(question: string, retryAfterSeconds: number, limit: "client" | "global"): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  const sentence = limit === "global"
    ? `The box is answering as many questions as it can right now. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
    : `That is ${CLIENT_LIMIT.capacity} questions in an hour from one address. The next one is available in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  return statePage({
    title: "Too many questions",
    question,
    sentence,
    action: retryAndExamples(question, "Try again", [
      "Is rent going up in Austin",
      "Population of Cook County",
    ]),
  });
}

export function askNoMatch(question: string, examples: string[]): string {
  return statePage({
    title: "We do not know that place",
    question,
    sentence: "We do not know that place.",
    action: retryAndExamples(question, "Try another place", examples),
  });
}
