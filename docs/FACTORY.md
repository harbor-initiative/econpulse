# The factory

How 35 issues get built by sub-agents without stepping on each other.

The operator's model, chosen 2026-10-31: **one agent per issue, one branch, one
pull request.** Everything below exists to make that survivable.

## Decisions taken

| # | Question | Answer |
|---|---|---|
| 1 | Who dispatches | the operator's agent, from the working session; sub-agents execute, the operator merges |
| 2 | The score's peer group | **both** — a county reading and a place reading, shown together |
| 3 | The name | EconPulse stays; the collision with three other projects is accepted |
| 4 | Deploy cadence | every merged wave reaches production with a health check and a rollback tag |
| 5 | The old domain | `econpulse.porbanderwala.cloud` 301s to `econpulse.harborgovcon.com` |

## The constraint that shapes everything

Measured across the 29 per-issue specs, before the split:

| File | Issues touching it |
|---|---|
| `server/index.ts` | 21 |
| `server/view.ts` | 19 |

Twenty-one branches against one file is a merge queue wearing a parallelism
costume. **Wave 0 is [spec 035](specs/035-server-split.md): split the server, no
behaviour change.** Nothing else starts until it merges. It is one day and it is
the difference between a factory and a traffic jam.

## Hotspots, measured

The split removes the two megafiles. It does not remove every hotspot. Measured
across the specs:

| File after the split | Issues touching it |
|---|---|
| `server/views/panel.ts` | 8 — #13, #14, #15, #18, #23, #29, #30, #32 |
| `server/views/css.ts` | 5 — #10, #17, #29, #31, #33 |
| `server/views/header.ts` | 3 — #10, #12, #16 |
| `server/lib/search-index.ts` | 2 — #5, #6 |
| `server/views/layout.ts` | 2 — #26, #31 |

So the unit of parallelism is not a wave. It is a **lane**: a strictly ordered
chain of issues that share files. Lanes run in parallel; inside a lane, one at a
time, always.

## The lanes

| Lane | Issues, in order | Files it owns |
|---|---|---|
| **L1 Search** | #5 → #6 → #7 | `lib/search-index.ts`, `routes/suggest.ts` |
| **L2 Data** | #8 → #11 | `pipeline/*` only |
| **L3 Panels** | #13 → #14 → #18 → #29 → #30 → #32 → #15 → #23 | `views/panel.ts` |
| **L4 Header** | #33 → #12 → #10 → #17 → #31 | `views/header.ts`, `css.ts`, `public/fonts` |
| **L5 Box** | #19 → #21 → #22 | `lib/model.ts`, `views/states.ts`, `public/ask.js` |
| **L6 Infra** | #20 → #24 → #28 → #27 → #25 → #26 | `lib/ratelimit.ts`, `routes/*`, `deploy/`, `.github/` |
| **L7 Location** | #16 → #9 | `pipeline/sources/boundaries.ts`, `public/map.js` |

Wave 0 (#35) lands before any lane starts.

**L3 and L4 are the long poles** at eight and five issues. If either becomes the
constraint, the answer is a second split — `panel.ts` into a shell plus
`views/visuals/*` — not more agents. Four agents against one file is four people
editing the same paragraph.

## The rules an agent works under

Every agent gets one issue and this contract.

1. **One worktree.** `git worktree add ../wt-012 -b feat/012-ai-summary` from
   `main`. Never `main` itself.
2. **Branch name** `feat/<issue>-<slug>` from the spec filename.
3. **Read the spec first**, then the files it names. The spec is the authority;
   the issue is a pointer.
4. **Stay inside the files the spec lists.** A change outside them is a scope
   breach and belongs in a comment on the issue, not in the diff.
5. **Rebase on `main`** before opening the PR. A PR that does not apply is not
   a PR.
6. **Never merge. Never push to `main`. Never touch another worktree.**
7. **Definition of done**: every acceptance box ticked, `tsc --noEmit` clean,
   tests pass, and the design gate (#34) passes where the change touches a page.
8. **Blocked**: comment on the issue with the exact blocker and stop. Do not
   widen the issue to route around it.

## The pull request

Title: `<issue> <title>`, for example `#12 AI summary grounded in the pillars`.

Body:

```
Closes #12

Spec: docs/specs/012-ai-summary.md

## Acceptance
- [x] …
- [x] …

## Files
server/lib/summary.ts (new), server/views/header.ts

## Notes
Anything a reviewer needs that the spec did not anticipate.
```

The acceptance list is copied from the spec and ticked. A reviewer should not
have to open the issue to know what "done" means.

## Collisions, after the split

The split gives every issue a home:

| Area | Owner |
|---|---|
| `server/routes/<name>.ts` | the issue for that route |
| `server/views/<name>.ts` | the issue for that component |
| `server/lib/<name>.ts` | the issue for that concern |
| `server/views/css.ts` | #33 and #34 only, serialised between them |
| `pipeline/*` | pipeline issues, which rarely collide |

Two issues in the same wave must not share a file. If they do, the later one
waits a wave. `css.ts` is the known serialisation point: #33 lands before #29,
#30, #31 and #32, because all five touch styles.

## Merging

The operator merges. Agents do not.

Merge one lane at a time, in the order the lane lists. Within an issue, smallest diff first.

Before merging a lane step, `npm run verify` and the design gate both run on `main`.
A wave that breaks either is not merged, whatever the individual PRs said.

## Concurrency

Four agents at once. Not a technical limit — a review limit. One operator reading
four PRs a day is the actual constraint, and a fifth only adds unread diffs.

## What this document is not

Not a workflow engine. There is no queue, no daemon, no scheduler. The operator
reads a wave, dispatches four agents, reviews four PRs, merges, repeats. The
value here is the graph and the contract, not automation for its own sake.

## Acceptance

- [ ] #35 merges before any other issue is dispatched
- [ ] No two lanes touch the same file; inside a lane, one issue at a time
- [ ] Every PR links its spec and ticks its acceptance list
- [ ] `main` passes `verify` and the design gate after every wave
- [ ] No agent merges
