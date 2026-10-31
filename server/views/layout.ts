/**
 * The page shell, and the one escaping function everything else uses.
 *
 * Every value on this site came from an agency file, so every value is escaped
 * on the way out. A view that forgets is a view that can be written to by a
 * place name.
 */


import { CSS } from "./css.ts";
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
export function shell(title: string, body: string, footerNote = "", docked = true): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Every number about a place, with its receipt.">
<style>${CSS}</style>
</head><body><div class="wrap">
<div class="topbar">
${docked ? `<form class="dock" action="/ask" method="get" role="search"><input type="search" name="q" placeholder="Place or question" aria-label="Place or question"></form>` : ""}
<a class="brand" href="/">EconPulse</a>
<nav class="nav"><a href="/status">Status</a><a href="https://github.com/harbor-initiative/econpulse">GitHub</a></nav></div>
${body}
<footer><span>${esc(footerNote)}</span><span>A Harbor Initiative project · Public data · Not financial advice</span></footer>
</div></body></html>`;
}
