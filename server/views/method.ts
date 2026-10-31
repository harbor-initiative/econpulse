/**
 * The method page: where the numbers come from and what they cannot tell you.
 *
 * This is the answer to "why should I trust this", which is the only question a
 * product built on provenance has to be able to answer. It is written for a
 * reader, not for a reviewer: every claim here is checkable from the file, and
 * the places it points at are the ones that hold the code.
 *
 * The score section is deliberately absent until #10 builds a score. A method
 * page that documents a number the site does not show is a page that lies by
 * omission in the other direction.
 */

import { esc, shell } from "./layout.ts";
import type { AgencySummary } from "../lib/method.ts";

export interface MethodInput {
  appVersion: string;
  dataVersion: string;
  built: string;
  places: number;
  facts: number;
  agencies: AgencySummary[];
}

/** "U.S. Census Bureau" -> "the Census Bureau", for prose. */
function plain(agency: string): string {
  return agency.replace(/^U\.S\. /, "");
}

export function method(input: MethodInput): string {
  const agencyRows = input.agencies
    .map(
      (agency) => `<tr>
        <th scope="row">${esc(plain(agency.agency))}</th>
        <td>${esc(agency.measures.join(", "))}</td>
        <td>${esc(agency.periodRange)}</td>
        <td>${esc(agency.facts.toLocaleString("en-US"))}</td>
        <td>${esc(agency.retrieved)}</td>
      </tr>`,
    )
    .join("");

  return shell(
    `Method — EconPulse`,
    `<p class="crumb">Method</p>
     <h1 class="place">Where these numbers come from</h1>
     <p class="sub">${input.places.toLocaleString("en-US")} places · ${input.facts.toLocaleString("en-US")} facts · data ${esc(input.dataVersion)} · built ${esc(input.built)}</p>

     <section class="method">
       <h2>1. Five agencies</h2>
       <p>Every figure on this site is published by one of these. Nothing is modelled, estimated or interpolated here; the file carries what they published, and each number says which table it came from.</p>
       <table class="method-table">
         <thead><tr><th scope="col">Agency</th><th scope="col">What it measures</th><th scope="col">Periods</th><th scope="col">Facts</th><th scope="col">Pulled</th></tr></thead>
         <tbody>${agencyRows}</tbody>
       </table>

       <h2>2. Why two unemployment rates</h2>
       <p>The Census Bureau's American Community Survey publishes a five-year average. The Bureau of Labor Statistics publishes a monthly estimate. For Philadelphia County they read 8.1% and 4.3%.</p>
       <p>Neither is wrong. The ACS asks a sample of households about the previous twelve months and averages five years of those answers, so it includes people who have stopped looking and it moves slowly. The BLS surveys employers and models the rest, so it is current and it counts only people actively looking for work. A five-year average is the right figure for "how does this place compare"; a monthly estimate is the right figure for "what is happening now".</p>
       <p>Where a figure is a five-year average, its period says so: <span class="mono">2020-2024</span>. Where it is monthly, the period is a month: <span class="mono">2026-09</span>.</p>

       <h2>3. Margins, and what an em dash means</h2>
       <p>Survey figures carry a margin of error and the panel receipt prints it as <span class="mono">±</span> a number. Administrative figures do not, and an absent margin prints as an em dash. It never prints as zero: a margin of zero would mean the figure is exact, and a survey figure never is.</p>

       <h2>4. What this is not</h2>
       <p>It predicts nothing and recommends nothing. A place is not doing well or badly because a number moved; the <span class="mark">better</span> and <span class="mark">worse</span> words compare a figure to the national one and say which direction is which, and nothing more.</p>
       <p>Where a measure is only published for counties, a city borrows its county's figure and the panel says so. Where a measure has no national series, the panel says that too.</p>

       <h2>5. How to cite it</h2>
       <p>The file has a version and each fact has a retrieval date, so a citation can be exact. Copy this and adjust the place:</p>
       <pre class="cite">EconPulse, data ${esc(input.dataVersion)} (built ${esc(input.built)}), app ${esc(input.appVersion)}.
"Philadelphia County, Pennsylvania", retrieved from
https://econpulse.harborgovcon.com/p/42101.
Source: U.S. Census Bureau, American Community Survey 5-Year, table B01003, period 2020-2024.</pre>
       <p>The underlying figures are public domain. The compilation is offered under CC0. Cite the agency first and this site second, because the agency did the measurement.</p>
     </section>`,
    {
      canonical: "/method",
      description: "Where the numbers come from: five federal agencies, the two unemployment rates and why they disagree, what a margin means, and how to cite it.",
      footerNote: `data ${input.dataVersion} · app ${input.appVersion} · econpulse.harborgovcon.com`,
    },
  );
}
