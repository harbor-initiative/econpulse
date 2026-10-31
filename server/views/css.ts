/**
 * The stylesheet, and the only place styles live.
 *
 * #33 and #29 both touch this file, so they land in that order and never
 * together. Tokens are documented in docs/remediation/specs/05-design-system.md;
 * where a value here disagrees with that document, the document wins.
 */

export const CSS = `@font-face{font-family:"Inter Tight";src:url("/fonts/inter-tight-latin.woff2") format("woff2");font-weight:100 900;font-style:normal;font-display:swap;unicode-range:U+0000-00FF,U+2013-2014,U+2018-201E,U+2026,U+2212}
@font-face{font-family:"Source Serif 4";src:url("/fonts/source-serif-4-latin-500.woff2") format("woff2");font-weight:500;font-style:normal;font-display:swap}
:root{--paper:#FCFBF8;--ink:#16161E;--muted:#52555B;--rec:#566669;--rule:#E4E2DC;--rule2:#C9C7C0;--teal:#009689;--teal-ink:#0B5C55;--blue:#104E64;--stale:#8A6A00;--stale-bg:#FFF9EC;
--sans:"Inter Tight",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;--serif:"Source Serif 4",Georgia,"Times New Roman",serif;--mono:ui-monospace,"SF Mono",Menlo,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:940px;margin:0 auto;padding:0 1.5rem 4rem}
a{color:inherit}
.topbar{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:1.5rem;padding:1.1rem 0;border-bottom:1px solid var(--rule);margin-bottom:2.4rem}
.brand{order:1}
.dock{order:2;max-width:420px;margin:0}
.dock input[type=search]{width:100%;font:inherit;font-size:.78rem;padding:.42rem .6rem;border:1px solid var(--rule2);border-radius:6px;background:#fff;color:var(--ink)}
.dock input[type=search]::placeholder{color:#7A7F86}
.nav{order:3}
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
.place{font-family:var(--serif);font-size:1.75rem;line-height:1.1;margin:.15rem 0 0;font-weight:500;letter-spacing:-.01em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
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
.vs{font-size:.8rem;font-weight:400;color:var(--muted);margin-left:.6rem;letter-spacing:0}
.value{font-size:1.85rem;letter-spacing:-.03em;font-weight:600;font-variant-numeric:tabular-nums;margin:0;line-height:1.1}
.delta{font-size:.79rem;color:var(--muted);margin:.28rem 0 0;font-variant-numeric:tabular-nums}
svg{display:block;width:100%;height:54px;margin:.85rem 0 .1rem;overflow:visible}
.years{display:flex;justify-content:space-between;font-family:var(--mono);font-size:.55rem;color:#6B7578;margin:.1rem 0 0}
.rec{margin:.6rem 0 0;padding-left:.55rem;border-left:2px solid #BFDBD7;font-family:var(--mono);font-size:.58rem;line-height:1.5;color:var(--rec)}
.rec b{font-weight:400;text-transform:uppercase;letter-spacing:.09em;color:var(--teal-ink)}
.chart-table{margin:.5rem 0 0;font-size:.7rem}
.chart-table summary{font-family:var(--mono);font-size:.58rem;letter-spacing:.08em;text-transform:uppercase;color:var(--rec);cursor:pointer;padding:.2rem 0}
.chart-table summary:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.chart-table table{border-collapse:collapse;width:100%;margin:.4rem 0 .2rem}
.chart-table caption{text-align:left;font-family:var(--mono);font-size:.56rem;letter-spacing:.06em;text-transform:uppercase;color:var(--rec);padding:0 0 .3rem}
.chart-table th,.chart-table td{text-align:right;font-weight:400;padding:.22rem .4rem;border-bottom:1px solid var(--rule);font-variant-numeric:tabular-nums}
.chart-table th:first-child,.chart-table td:first-child{text-align:left}
.chart-table thead th{color:var(--rec);font-family:var(--mono);font-size:.54rem;letter-spacing:.06em;text-transform:uppercase}
.mark{font-family:var(--mono);font-size:.55rem;text-transform:uppercase;letter-spacing:.09em;color:var(--ink);border-bottom:1px solid var(--ink);padding:0 .12rem .06rem;margin-left:.45rem;vertical-align:.05em}
.method{margin:1.6rem 0 0;max-width:74ch}
.method h2{font-family:var(--mono);font-size:.62rem;text-transform:uppercase;letter-spacing:.11em;color:var(--rec);font-weight:400;margin:2rem 0 .6rem}
.method p{font-size:.95rem;line-height:1.65;margin:0 0 .8rem;color:var(--ink)}
.method-table{border-collapse:collapse;width:100%;margin:.6rem 0 1rem;font-size:.78rem}
.method-table th,.method-table td{text-align:left;font-weight:400;padding:.4rem .6rem .4rem 0;border-bottom:1px solid var(--rule);vertical-align:top}
.method-table thead th{font-family:var(--mono);font-size:.54rem;letter-spacing:.06em;text-transform:uppercase;color:var(--rec)}
.method-table th[scope=row]{font-weight:500;white-space:nowrap}
.method-table td:nth-child(3),.method-table td:nth-child(5){white-space:nowrap}
.cite{font-family:var(--mono);font-size:.68rem;line-height:1.6;background:#F4F2EC;padding:.8rem .9rem;white-space:pre-wrap;margin:.4rem 0 1rem}
.facts{margin:2rem 0 0}
.facts h2{font-family:var(--mono);font-size:.6rem;text-transform:uppercase;letter-spacing:.11em;color:var(--rec);font-weight:400;margin:0 0 .6rem}
.factgrid{display:grid;grid-template-columns:1fr 1fr;column-gap:2.2rem}
.fact{display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:.2rem 1rem;padding:.5rem 0;border-bottom:1px solid var(--rule)}
.factl{font-family:var(--mono);font-size:.58rem;text-transform:uppercase;letter-spacing:.09em;color:var(--rec)}
.factv{font-size:1rem;font-weight:600;font-variant-numeric:tabular-nums;text-align:right;letter-spacing:-.01em}
.factr{grid-column:1/-1;font-family:var(--mono);font-size:.55rem;color:var(--rec)}
@media (max-width:720px){.factgrid{grid-template-columns:1fr}}
.ask-loading{margin:0 0 2rem;padding-bottom:1.2rem;border-bottom:1px solid var(--ink)}
.ask-q{font-family:var(--serif);font-size:1.5rem;line-height:1.15;margin:.4rem 0 .8rem;max-width:32ch}
.ask-step{font-family:var(--mono);font-size:.66rem;letter-spacing:.09em;text-transform:uppercase;color:var(--rec);margin:0}
.ask-loading::after{content:"";display:block;height:2px;margin-top:.9rem;background:linear-gradient(90deg,var(--teal) 0 30%,var(--rule) 30% 100%);animation:ask-sweep 1.4s ease-in-out infinite}
.ask-failed::after{background:var(--rule2);animation:none}
@keyframes ask-sweep{0%{background-position:0 0}100%{background-position:100% 0}}
@media (prefers-reduced-motion:reduce){.ask-loading::after{animation:none}}
.hblock{margin:0 0 1.6rem}
.scope{font-size:.82rem;color:var(--muted);margin:.45rem 0 0}
.hrule{height:1px;background:var(--ink);margin:1rem 0 .8rem}
.hrule.light{background:var(--rule);margin:.8rem 0 .6rem}
.hscore{display:flex;flex-wrap:wrap;align-items:baseline;gap:.55rem .9rem}
.score{font-size:2.9rem;font-weight:600;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.hlabel{font-family:var(--mono);font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink)}
.hpeers{font-family:var(--mono);font-size:.6rem;letter-spacing:.04em;color:var(--rec)}
.hweights{font-family:var(--mono);font-size:.58rem;letter-spacing:.03em;color:var(--rec);flex-basis:100%}
.hweights a{color:var(--rec);text-decoration:underline;text-underline-offset:2px}
.hsummary{font-size:.95rem;line-height:1.55;max-width:60ch;margin:.7rem 0 0}
.hreceipt{font-family:var(--mono);font-size:.62rem;line-height:1.5;color:var(--rec);border-left:2px solid #BFDBD7;padding-left:.55rem;margin:0}
.hreceipt b{font-weight:400;color:var(--ink)}
.htv{font-family:var(--mono);font-size:.55rem;letter-spacing:.05em;text-transform:uppercase;color:var(--rec);margin:.55rem 0 0}
.hpending{font-family:var(--mono);font-size:.62rem;color:var(--rec);margin:0}
.legend{display:flex;gap:1rem;font-family:var(--mono);font-size:.58rem;letter-spacing:.04em;color:var(--rec);margin:.3rem 0 0}
.legend span{display:inline-flex;align-items:center;gap:.35rem}
.legend .sw{display:inline-block;width:16px;height:0;border-top-width:1.7px;border-top-style:solid}
.legend .sw-solid{border-top-color:var(--teal)}
.legend .sw-dash{border-top-color:var(--blue);border-top-style:dashed;border-top-width:1.2px}
.sharebar{margin:.75rem 0 .1rem}
.sbtrack{display:block;height:10px;background:#F0EEE6;border-radius:2px;overflow:hidden}
.sbtrack i{display:block;height:10px;background:var(--teal)}
.sblabel{display:block;font-family:var(--mono);font-size:.58rem;line-height:1.5;color:var(--rec);margin-top:.32rem;letter-spacing:.03em}
.bench-share{font-family:var(--mono);font-size:.62rem;line-height:1.5;color:var(--muted);margin:.55rem 0 0}
.bench-note{font-family:var(--mono);font-size:.6rem;letter-spacing:.03em;color:var(--rec);margin:.55rem 0 0}
.stale{margin:0 0 .7rem;padding:.45rem .6rem;background:var(--stale-bg);border:1px solid var(--stale);color:var(--stale);font-size:.74rem;line-height:1.45}
.stale b{font-weight:600;text-transform:uppercase;letter-spacing:.09em}
.notice{background:#F2F7F6;border-left:3px solid var(--teal);padding:.6rem .8rem;margin:0 0 1rem;font-size:.82rem;color:var(--teal-ink)}
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
  .topbar{grid-template-columns:1fr auto;gap:.5rem 1rem;row-gap:.7rem}
  .brand{order:1}
  .nav{order:2}
  .dock{order:3;grid-column:1/-1;max-width:none}
  .grid{grid-template-columns:1fr}
  .metric:nth-child(odd){padding-right:0;border-right:0}
  .metric:nth-child(even){padding-left:0}
  h1{font-size:2rem}
  .place{font-size:1.375rem}
  .score{font-size:2.2rem}
}
@media print{
  :root{--paper:#fff;--ink:#000;--muted:#333;--rec:#444;--rule:#bbb;--rule2:#999}
  @page{margin:14mm}
  body{font-size:10pt;line-height:1.4}
  .wrap{max-width:none;padding:0}
  .topbar,.dock,.chart-table,.chips,form.search,.legend .sw{display:none}
  a{text-decoration:none;color:inherit}
  .grid{display:block}
  .metric,.metric:nth-child(odd),.metric:nth-child(even){display:block;border:0;border-bottom:1px solid var(--rule);padding:.5rem 0 .6rem;break-inside:avoid;page-break-inside:avoid}
  .metric.full{display:block}
  .place{font-size:19pt}
  h1{font-size:14pt}
  .value{font-size:14pt}
  .label,.crumb,.tv,.rec,.sblabel,.bench-note,.bench-share{color:var(--rec)}
  .rec{font-size:9pt}
  .sbtrack,.cbar{background:#e8e8e8}
  .sbtrack i,.cbar i{background:#555}
  .stale{background:#fff;border:1px solid #000;color:#000}
  .mark{color:#000;border-bottom:1px solid #000}
  footer{position:static;margin-top:1rem;border-top:1px solid var(--rule);font-size:8pt}
}
`;
