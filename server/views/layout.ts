/**
 * The page shell, and the one escaping function everything else uses.
 *
 * Every value on this site came from an agency file, so every value is escaped
 * on the way out. A view that forgets is a view that can be written to by a
 * place name.
 */


import { CSS } from "./css.ts";
import { SITE } from "../lib/site.ts";

/** Everything a page can say about itself in the head. */
export interface ShellOptions {
  /** The line that prints in the footer, and the only line that survives on paper. */
  footerNote?: string;
  /** The docked search field. Off on the home route, which has the hero field. */
  docked?: boolean;
  /** Path only; the origin is fixed. A canonical that follows a header agrees with anything. */
  canonical?: string;
  description?: string;
  /** Structured data, one object per script tag. Never an aggregate rating. */
  jsonld?: unknown[];
  /** `noindex` for a page that should not be in a search result. */
  robots?: string;
}
export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The page shell.
 *
 * `docked` puts a search field in the top bar. It is off on the home route only,
 * where the hero field is already the point of the page, and a second box would
 * be two of the same thing.
 *
 * The field comes first in the document so it is the first thing Tab reaches,
 * and CSS places it between the brand and the nav. Tab order follows the
 * document; the layout follows the design.
 */
export function shell(title: string, body: string, options: ShellOptions = {}): string {
  const { footerNote = "", docked = true, canonical, description = SITE.description, jsonld = [], robots } = options;
  const head = [
    canonical ? `<link rel="canonical" href="${esc(`${SITE.origin}${canonical}`)}">` : "",
    robots ? `<meta name="robots" content="${esc(robots)}">` : "",
    ...jsonld.map((block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`),
  ].filter(Boolean).join("\n");

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${head}
<style>${CSS}</style>
<link rel="stylesheet" href="/maplibre-gl.css">
</head><body><div class="wrap">
<div class="topbar">
${docked
  ? `<form class="dock" action="/ask" method="get" role="search"><input type="search" name="q" placeholder="Place or question" aria-label="Place or question"></form>`
  : `<span class="dock-gap" aria-hidden="true"></span>`}
<a class="brand" href="/">EconPulse</a>
<nav class="nav"><a href="/status">Status</a><a href="https://github.com/harbor-initiative/econpulse">GitHub</a></nav></div>
${body}
<footer><span>${esc(footerNote)}</span><span>A Harbor Initiative project · Public data · Not financial advice</span></footer>
</div><script src="/ask.js" defer></script>
<script src="/maplibre-gl.js" defer></script>
<script src="/map.js" defer></script><script src="/combobox.js" defer></script></body></html>`;
}
