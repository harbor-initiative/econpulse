import type { Fact, Place } from "./store.ts";

/**
 * Server-rendered HTML and hand-built SVG.
 *
 * No framework and no build step, on purpose. A stranger should be able to run
 * this with `node server/index.ts` on a machine that has Node and nothing else.
 * The charts are ours: a spec in, an SVG string out, so the same numbers can be
 * re-rendered by an MCP client later without touching the query layer.
 */

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TEAL = "#009689";
const BLUE = "#104E64";
const RULE = "#E4E2DC";

export function formatValue(value: number, unit: string): string {
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "years") return value.toFixed(1);
  if (unit === "usd_per_month") return `$${Math.round(value).toLocaleString("en-US")}`;
  if (unit === "usd") {
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
  return Math.round(value).toLocaleString("en-US");
}

function points(values: number[], width: number, height: number): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / Math.max(1, values.length - 1);
  return values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 8)).toFixed(1)}`)
    .join(" ");
}

export function lineChart(values: number[], comparison: number[] = []): string {
  const w = 320;
  const h = 54;
  const base = `<line x1="0" y1="${h - 1}" x2="${w}" y2="${h - 1}" stroke="${RULE}" stroke-width="1"/>`;
  const compare = comparison.length > 1
    ? `<polyline points="${points(comparison, w, h)}" fill="none" stroke="${BLUE}" stroke-width="1.2" stroke-dasharray="4 3"/>`
    : "";
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${points(values, w, h)}" fill="none" stroke="${TEAL}" stroke-width="1.7" stroke-linejoin="round"/>
    ${compare}${base}</svg>`;
}

export function barChart(values: number[], labels: string[]): string {
  const w = 320;
  const h = 54;
  const max = Math.max(...values, 1);
  const slot = w / values.length;
  const barW = Math.max(6, slot * 0.62);
  const bars = values
    .map((v, i) => {
      const bh = Math.max(2, (v / max) * (h - 8));
      const x = i * slot + (slot - barW) / 2;
      return `<rect x="${x.toFixed(1)}" y="${(h - 1 - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${TEAL}"/>`;
    })
    .join("");
  const ticks = labels.length
    ? `<div class="years"><span>${esc(labels[0])}</span><span>${esc(labels[labels.length - 1])}</span></div>`
    : "";
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${bars}
    <line x1="0" y1="${h - 1}" x2="${w}" y2="${h - 1}" stroke="${RULE}" stroke-width="1"/></svg>${ticks}`;
}

export function compareBars(rows: Array<{ label: string; value: number }>, unit: string): string {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<div class="compare">${rows
    .map(
      (r) => `<div class="crow">
        <span class="cl">${esc(r.label)}</span>
        <span class="cbar"><i style="width:${Math.max(2, (r.value / max) * 100).toFixed(1)}%"></i></span>
        <span class="cv">${esc(formatValue(r.value, unit))}</span>
      </div>`,
    )
    .join("")}</div>`;
}

function delta(latest: Fact, previous: Fact | null): string {
  if (!previous || previous.value === 0) return "";
  const change = latest.value - previous.value;
  const pct = (change / previous.value) * 100;
  const sign = change >= 0 ? "+" : "−";
  const unit = latest.unit === "percent" ? " pts" : "%";
  const body = latest.unit === "percent"
    ? `${sign}${Math.abs(change).toFixed(1)} pts`
    : `${sign}${Math.abs(pct).toFixed(1)}%`;
  void unit;
  return `${body} vs ${esc(previous.period)}`;
}

export const CSS = `
:root{--paper:#FCFBF8;--ink:#16161E;--muted:#52555B;--rec:#566669;--rule:#E4E2DC;--rule2:#C9C7C0;--teal:#009689;--teal-ink:#0B5C55;--blue:#104E64;
--sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;--serif:Georgia,"Times New Roman",serif;--mono:ui-monospace,"SF Mono",Menlo,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:940px;margin:0 auto;padding:0 1.5rem 4rem}
a{color:inherit}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:1.1rem 0;border-bottom:1px solid var(--rule);margin-bottom:2.4rem}
.brand{font-weight:600;font-size:1rem;letter-spacing:-.02em;text-decoration:none}
.nav{display:flex;gap:1.3rem;font-size:.8rem;color:var(--muted)}
h1{font-size:2.5rem;line-height:1.08;letter-spacing:-.035em;margin:0 0 .9rem;font-weight:600}
.lede{color:var(--muted);font-size:1rem;margin:0 auto;max-width:46ch}
.hero{text-align:center;padding:2.4rem 0 2rem;max-width:640px;margin:0 auto}
form.search{max-width:540px;margin:1.8rem auto 0;text-align:left}
input[type=search]{width:100%;font:inherit;font-size:1rem;padding:.95rem 1rem;border:1px solid var(--rule2);border-radius:8px;background:#fff;color:var(--ink)}
input[type=search]::placeholder{color:#7A7F86}
.hint{font-family:var(--mono);font-size:.64rem;letter-spacing:.07em;text-transform:uppercase;color:var(--rec);margin:.7rem 0 0;display:flex;gap:.5rem;flex-wrap:wrap}
.chips{display:flex;gap:.4rem;flex-wrap:wrap;justify-content:center;margin-top:1.2rem}
.chip{font-size:.76rem;padding:.34rem .65rem;border:1px solid var(--rule);border-radius:999px;color:var(--muted);background:#fff;text-decoration:none}
.place{font-family:var(--serif);font-size:2.2rem;line-height:1.05;margin:.2rem 0 0;font-weight:400;letter-spacing:-.015em}
.sub{color:var(--muted);font-size:.86rem;margin:.45rem 0 0}
.tools{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin:1.1rem 0 0;padding:0 0 1rem;border-bottom:1px solid var(--ink)}
.tv{font-family:var(--mono);font-size:.6rem;text-transform:uppercase;letter-spacing:.09em;color:var(--rec)}
.crumb{font-family:var(--mono);font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:var(--rec);margin:0 0 .9rem}
.grid{display:grid;grid-template-columns:1fr 1fr}
.metric{padding:1.35rem 0 1.2rem;border-bottom:1px solid var(--rule)}
.metric:nth-child(odd){padding-right:2rem;border-right:1px solid var(--rule)}
.metric:nth-child(even){padding-left:2rem}
.metric.full{grid-column:1/-1;border-right:0;padding-left:0;padding-right:0}
.label{font-family:var(--mono);font-size:.6rem;text-transform:uppercase;letter-spacing:.11em;color:var(--rec);margin:0 0 .5rem}
.value{font-size:1.85rem;letter-spacing:-.03em;font-weight:600;font-variant-numeric:tabular-nums;margin:0;line-height:1.1}
.delta{font-size:.79rem;color:var(--muted);margin:.28rem 0 0;font-variant-numeric:tabular-nums}
svg{display:block;width:100%;height:54px;margin:.85rem 0 .1rem;overflow:visible}
.years{display:flex;justify-content:space-between;font-family:var(--mono);font-size:.55rem;color:#6B7578;margin:.1rem 0 0}
.rec{margin:.6rem 0 0;padding-left:.55rem;border-left:2px solid #BFDBD7;font-family:var(--mono);font-size:.58rem;line-height:1.5;color:var(--rec)}
.rec b{font-weight:400;text-transform:uppercase;letter-spacing:.09em;color:var(--teal-ink)}
.compare{margin:.9rem 0 .2rem}
.crow{display:flex;align-items:center;gap:.6rem;margin:.28rem 0;font-size:.76rem;color:var(--muted)}
.cl{width:7.5rem;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cbar{flex:1;height:8px;background:#F0EEE6;border-radius:2px;overflow:hidden}
.cbar i{display:block;height:8px;background:var(--teal)}
.cv{font-family:var(--mono);font-size:.66rem;width:5.5rem;text-align:right;color:var(--ink)}
.missing{font-size:.8rem;color:var(--muted);margin:.7rem 0}
.results{list-style:none;padding:0;margin:1.5rem 0}
.results li{border-bottom:1px solid var(--rule)}
.results a{display:flex;justify-content:space-between;gap:1rem;padding:.8rem .2rem;text-decoration:none}
.results .rn{font-weight:500}
.results .rk{font-family:var(--mono);font-size:.62rem;color:var(--rec);text-transform:uppercase;letter-spacing:.08em}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--rule);font-family:var(--mono);font-size:.6rem;color:var(--rec);letter-spacing:.04em;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.mono{font-family:var(--mono)}
@media (max-width:720px){
  .grid{grid-template-columns:1fr}
  .metric:nth-child(odd){padding-right:0;border-right:0}
  .metric:nth-child(even){padding-left:0}
  h1{font-size:2rem}
  .place{font-size:1.6rem}
}
`;

export function shell(title: string, body: string, footerNote = ""): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Every number about a place, with its receipt.">
<style>${CSS}</style>
</head><body><div class="wrap">
<div class="topbar"><a class="brand" href="/">EconPulse</a>
<nav class="nav"><a href="/status">Status</a><a href="https://github.com/harbor-initiative/econpulse">GitHub</a></nav></div>
${body}
<footer><span>${esc(footerNote)}</span><span>A Harbor Initiative project · Public data · Not financial advice</span></footer>
</div></body></html>`;
}

export function home(): string {
  return shell(
    "EconPulse — how is your town doing?",
    `<div class="hero">
      <h1>How is your town doing?</h1>
      <p class="lede">Type a place. Every number carries its source and the date it was pulled.</p>
      <form class="search" action="/s" method="get">
        <input type="search" name="q" placeholder="Philadelphia, Cook County, or 19104" autofocus aria-label="Place">
        <div class="hint"><span>No account</span><span>·</span><span>Runs offline</span><span>·</span><span>Free</span></div>
      </form>
      <div class="chips">
        <a class="chip" href="/s?q=Philadelphia">Philadelphia</a>
        <a class="chip" href="/s?q=Cook%20County">Cook County</a>
        <a class="chip" href="/s?q=19104">19104</a>
        <a class="chip" href="/s?q=Kansas%20City">Kansas City</a>
      </div>
    </div>`,
  );
}

export function searchResults(query: string, places: Place[]): string {
  if (!places.length) {
    return shell(
      `No match for ${query}`,
      `<p class="crumb">Search</p><h1 style="font-size:1.6rem">We do not know that place.</h1>
       <p class="sub">Check the spelling, add a state, or try a ZIP code. Coverage is every county and every place above 1,000 people.</p>
       <form class="search" action="/s" method="get"><input type="search" name="q" value="${esc(query)}" aria-label="Place"></form>`,
    );
  }
  const items = places
    .map(
      (p) => `<li><a href="/p/${esc(p.geoid)}"><span class="rn">${esc(p.name)}${p.state_code ? `, ${esc(p.state_code)}` : ""}</span>
        <span class="rk">${esc(p.kind)}${p.population ? ` · ${p.population.toLocaleString("en-US")}` : ""}</span></a></li>`,
    )
    .join("");
  return shell(
    `${query} — EconPulse`,
    `<p class="crumb">Search</p><h1 style="font-size:1.5rem">${places.length > 1 ? `${places.length} places match` : "One place matches"}</h1>
     <ul class="results">${items}</ul>`,
  );
}

export interface Panel {
  metric: string;
  label: string;
  fact: Fact | null;
  history: Fact[];
  comparison: Fact[];
  comparisonLabel: string | null;
  note?: string;
}

export function report(place: Place, panels: Panel[], meta: Record<string, string>): string {
  const cards = panels.map((panel) => renderPanel(panel)).join("");
  const placeSub = [
    place.state_code,
    place.population ? `population ${place.population.toLocaleString("en-US")}` : null,
    `GEOID ${place.geoid}`,
  ].filter(Boolean).join(" · ");

  return shell(
    `${place.name} — EconPulse`,
    `<p class="crumb">${esc(place.kind)}</p>
     <h1 class="place">${esc(place.name)}</h1>
     <p class="sub">${esc(placeSub)}</p>
     <div class="tools"><span class="tv">data ${esc(meta["data.version"] ?? "?")} · built ${esc((meta["build.finished_at"] ?? "").slice(0, 10))}</span>
       <span class="tv">${esc(meta["build.source_count"] ?? "?")} agencies</span></div>
     <div class="grid">${cards}</div>`,
    "Numbers are illustrative of the source, not of the place.",
  );
}

function renderPanel(panel: Panel): string {
  if (!panel.fact) {
    return `<div class="metric"><p class="label">${esc(panel.label)}</p>
      <p class="missing">No ${esc(panel.label.toLowerCase())} series for this place. ${esc(panel.note ?? "")}</p></div>`;
  }

  const { fact, history, comparison, comparisonLabel } = panel;
  const full = panel.metric === "federal_obligations" ? " full" : "";

  let chart = "";
  if (history.length > 1) {
    const values = history.map((h) => h.value);
    const compareValues = comparison.length === history.length ? comparison.map((c) => c.value) : [];
    const isCount = panel.metric === "federal_obligations";
    chart = isCount
      ? barChart(values, history.map((h) => h.period))
      : lineChart(values, compareValues) +
        `<div class="years"><span>${esc(history[0]?.period ?? "")}</span><span>${esc(history[history.length - 1]?.period ?? "")}</span></div>`;
  } else if (comparison.length && comparisonLabel) {
    chart = compareBars(
      [
        { label: "This place", value: fact.value },
        { label: comparisonLabel, value: comparison[0]?.value ?? 0 },
      ].filter((r) => r.value > 0),
      fact.unit,
    );
  }

  const prev = history.length > 1 ? (history[history.length - 2] ?? null) : null;
  const deltaText = prev ? delta(fact, prev) : "";

  return `<div class="metric${full}">
    <p class="label">${esc(panel.label)}</p>
    <p class="value">${esc(formatValue(fact.value, fact.unit))}</p>
    ${deltaText ? `<p class="delta">${deltaText}</p>` : ""}
    ${chart}
    <p class="rec"><b>Receipt</b> ${esc(fact.agency)} · ${esc(fact.dataset)}${fact.table_id ? ` · ${esc(fact.table_id)}` : ""} · ${esc(fact.period)}${fact.moe !== null ? ` · ±${Math.round(fact.moe).toLocaleString("en-US")}` : ""} · pulled ${esc(fact.retrieved_at)}</p>
  </div>`;
}

export function status(counts: { places: number; facts: number; metrics: number }, meta: Record<string, string>): string {
  const rows = Object.entries(meta)
    .map(([k, v]) => `<li><span class="mono">${esc(k)}</span> ${esc(v)}</li>`)
    .join("");
  return shell(
    "Status — EconPulse",
    `<p class="crumb">Status</p><h1 style="font-size:1.6rem">What is in the file</h1>
     <p class="sub">${counts.places.toLocaleString("en-US")} places · ${counts.facts.toLocaleString("en-US")} facts · ${counts.metrics} metrics</p>
     <ul class="results">${rows}</ul>`,
  );
}
