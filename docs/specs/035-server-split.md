# #35 — Split server/index.ts and server/view.ts before parallel work

Parent: #36 · Status: draft · Blocks: every other issue

## Problem

Measured across the 29 per-issue specs, two files own almost everything:

| File | Issues touching it |
|---|---|
| `server/index.ts` | 21 |
| `server/view.ts` | 19 |
| `server/store.ts` | 3 |
| `pipeline/verify.ts` | 3 |

The operator's chosen model is one branch and one pull request per issue. Under that model, twenty-one branches editing one file become a merge queue with extra steps. Every PR will conflict with every other PR and the factory
stalls on the first wave.

This is the single largest constraint on the plan and it is cheap to remove:
one mechanical refactor, no behaviour change.

## Approach

Split by responsibility so that an issue owns a file.

```
server/
├── app.ts            the router: method + path → handler
├── routes/
│   ├── home.ts       /
│   ├── place.ts      /p/:geoid
│   ├── ask.ts        /ask
│   ├── suggest.ts    /api/suggest
│   ├── status.ts     /status
│   ├── method.ts     /method
│   └── assets.ts     robots, sitemap, healthz
├── views/
│   ├── css.ts        the stylesheet, one export
│   ├── layout.ts     shell, top bar
│   ├── header.ts     header block
│   ├── panel.ts      panel, chart, receipt
│   └── states.ts     the six states
└── lib/              search-index, score, freshness, model, ratelimit
```

Rules the split enforces:

- No route file over 200 lines.
- A route imports views; a view never imports a route.
- `css.ts` is the only place styles live, so #33 and #29 cannot collide in the
  markup.
- Shared behaviour moves to `server/lib/`, one module per concern.

**No behaviour change.** The rendered HTML for `/`, `/p/42101`, `/p/4260000`,
`/ask?q=…`, `/status` and a 404 is captured before the split and asserted
identical after, modulo whitespace. A refactor that changes an answer is not a
refactor.

## Acceptance criteria

- [ ] Every route renders byte-identical HTML to the pre-split capture
- [ ] `tsc --noEmit` clean, no new `any`
- [ ] No file in `server/` exceeds 200 lines
- [ ] The browser gate (#34) passes before and after
- [ ] The split lands as one commit with no behaviour change in the message

## Risks

A mechanical refactor that quietly changes a route. The snapshot capture is the
only guard that matters, and it has to be taken *before* the first file moves.

## Out of scope

A framework, a router library, dependency injection, a component system.

## Files

every file in `server/` · new `server/routes/*` · new `server/views/*` ·
new `scripts/snapshot-html.mjs`
