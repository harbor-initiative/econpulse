/**
 * What is inside the file, printed from the file.
 *
 * A reader opens this to answer two questions: what is in here, and how old is
 * it. The counts, the retrieval dates and the build record all come from the
 * database, so the page cannot disagree with the report or with `/healthz`.
 */


import { esc, shell } from "./layout.ts";
import { FRESHNESS, ageInDays, ageWords, bandOf, spanBand, type FileFacts } from "../lib/freshness.ts";

function pulled(oldest: string, newest: string): string {
  return oldest === newest ? `pulled ${esc(newest)}` : `pulled ${esc(oldest)} to ${esc(newest)}`;
}

export function status(
  counts: { places: number; facts: number; metrics: number },
  meta: Record<string, string>,
  file: FileFacts,
  now: Date = new Date(),
): string {
  const rows = file.agencies
    .map((agency) => {
      const band = bandOf(agency.newestRetrieval, now);
      const age = ageWords(ageInDays(agency.newestRetrieval, now));
      return `<li data-agency="${esc(agency.agency)}" data-band="${band}"><span class="mono">${esc(agency.agency)}</span> · ${agency.facts.toLocaleString("en-US")} facts · covers ${esc(agency.oldestPeriod)} · ${pulled(agency.oldestRetrieval, agency.newestRetrieval)} (${age}) · <span class="mono">${band}</span></li>`;
    })
    .join("");

  const span = { oldest: file.oldestRetrieval, newest: file.newestRetrieval };
  const band = spanBand(span, now);
  const age = file.newestRetrieval ? ageInDays(file.newestRetrieval, now) : null;
  const dated = file.oldestRetrieval && file.newestRetrieval
    ? `${pulled(file.oldestRetrieval, file.newestRetrieval)} (${ageWords(age ?? 0)}) · ${band} band · stale after ${FRESHNESS.staleAfterDays} days`
    : "No facts in the file.";
  const covered = file.oldestPeriod && file.newestPeriod
    ? (file.oldestPeriod === file.newestPeriod
        ? `The file covers ${esc(file.oldestPeriod)}.`
        : `The file covers ${esc(file.oldestPeriod)} to ${esc(file.newestPeriod)}.`)
    : "";
  const stale = band === "stale"
    ? `<p class="stale"><b>Stale</b> the newest retrieval is ${esc(file.newestRetrieval ?? "")}, ${ageWords(age ?? 0)}. The stale threshold is ${FRESHNESS.staleAfterDays} days.</p>`
    : "";

  const buildRows = Object.entries(meta)
    .map(([k, v]) => `<li><span class="mono">${esc(k)}</span> ${esc(v)}</li>`)
    .join("");

  return shell(
    "Status — EconPulse",
    `<p class="crumb">Status</p><h1 style="font-size:1.6rem">What is in the file</h1>
     <p class="sub">${counts.places.toLocaleString("en-US")} places · ${counts.facts.toLocaleString("en-US")} facts · ${counts.metrics} metrics · data ${esc(meta["data.version"] ?? "?")}</p>
     <p class="sub">${dated}</p>
     ${covered ? `<p class="sub">${covered}</p>` : ""}
     ${stale}
     <p class="label">Sources</p>
     <ul class="results">${rows}</ul>
     <p class="label">Build</p>
     <ul class="results">${buildRows}</ul>`,
    { canonical: "/status", description: "What is in the EconPulse file: places, facts, every agency and the date it was last pulled." },
  );
}
