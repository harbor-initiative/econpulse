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

### AGENTS.md lands with the split

The split is also when the repository gets its `AGENTS.md`, because that file
carries a map of `server/` and the map is only true after the split moves the
files. Written before, it describes a repository that no longer exists.

Four sections, no more:

1. **The house rules that do not bend.** No antithesis constructions. No red or
   green on a number. Hairlines. Every value carries its receipt. The file names
   its own version.
2. **How to run it.** `npm install`, where the database comes from, `npm run
   serve`, `npm run verify`, what the gate checks.
3. **The file map.** Route owns route, view owns view, `css.ts` is the only
   stylesheet, `lib/` holds shared behaviour. An agent should not need to look
   twice.
4. **The traps already paid for.** Each of these cost a deploy:
   - `_E$` never matches `B01003_001E`, because the string ends in `1E`. Slice
     the last character.
   - ZCTA codes are five digits and collide with county FIPS. ZIPs live in their
     own table.
   - Census encodes "no margin" as `-555555555`, and four other sentinels.
   - `openrouter/free` spends the token budget thinking. Under 400 `max_tokens`
     it returns an empty answer with `finish_reason: length`.
   - `PRAGMA wal_checkpoint(TRUNCATE)` before shipping the database, or the
     artifact is two files.
   - The design gate measures coloured pixels in a real browser. Reading the CSS
     proves nothing.

## Acceptance criteria

- [ ] Every route renders byte-identical HTML to the pre-split capture
- [ ] `tsc --noEmit` clean, no new `any`
- [ ] No file in `server/` exceeds 200 lines
- [ ] The design gate's record is unchanged before and after (it reports 54 failures that belong to #34; a refactor must not move the number)
- [ ] The split lands as one commit with no behaviour change in the message
- [ ] `AGENTS.md` exists, names the real file map, and lists the six traps

## What changed from the plan

Three things, all recorded here rather than quietly absorbed.

1. **`/ask?q=Is rent going up in Austin` cannot be captured byte for byte.** That
   URL reaches a model, and a model answer is non-deterministic. The snapshot
   captures it with the key absent, which exercises the "which place" state, and
   a locally parsed question covers the answered-card path. The model path is
   covered by tests, not by a byte comparison.
2. **The gate cannot pass before the split.** It reports 54 failing assertions
   that #34 exists to fix. The proof a refactor is honest is that the record does
   not move, so that is the criterion, and `tests/design-gate-baseline.json` is
   the record.
3. **`server/ask.ts` also needed splitting.** It was 230 lines and the rule is
   200. The model call moved to `lib/model.ts` (where lane L5 expects it), the
   vocabulary to `lib/rules.ts`, and the orchestration stayed in `ask.ts` at 88
   lines.

## Risks

A mechanical refactor that quietly changes a route. The snapshot capture is the
only guard that matters, and it has to be taken *before* the first file moves.

## Out of scope

A framework, a router library, dependency injection, a component system.

## Files

every file in `server/` · new `server/routes/*` · new `server/views/*` ·
new `scripts/snapshot-html.mjs` · `AGENTS.md`
