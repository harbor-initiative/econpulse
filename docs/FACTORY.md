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

## The dependency graph

`—` means no dependency. Wave = the earliest wave it can run in, after #35.

| Issue | Depends on | Wave |
|---|---|---|
| #35 split | — | 0 |
| #5 aliases | — | 1 |
| #8 coverage | — | 1 |
| #13 freshness | — | 1 |
| #14 benchmarks | — | 1 |
| #15 quick facts | — | 1 |
| #18 chart tables | #35 | 1 |
| #19 model reliability | — | 1 |
| #20 rate limit | — | 1 |
| #27 refresh | — | 1 |
| #29 panel substance | #35 | 1 |
| #30 legends | #35 | 1 |
| #33 typefaces | #35 | 1 |
| #6 fuzzy index | #5 | 2 |
| #11 percentiles | #8 | 2 |
| #21 six states | #19, #20 | 2 |
| #24 health and status | #13 | 2 |
| #32 meaning without colour | #14 | 2 |
| #7 autocomplete | #6 | 3 |
| #12 AI summary | #11 | 3 |
| #16 map | #35 | 3 |
| #22 progressive loading | #21 | 3 |
| #23 comparison | #6, #19 | 3 |
| #28 staleness job | #24 | 3 |
| #10 header block | #11, #12 | 4 |
| #25 method page | #11, #12 | 4 |
| #31 docked search | #7 | 4 |
| #9 use my location | #16 | 4 |
| #17 print | #10 | 5 |
| #26 discoverability | #10 | 5 |
| #34 design epic | its children | — |

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

Order inside a wave: smallest diff first, so a stuck PR blocks the least.

Before merging a wave, `npm run verify` and the design gate both run on `main`.
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
- [ ] No two issues in one wave share a file
- [ ] Every PR links its spec and ticks its acceptance list
- [ ] `main` passes `verify` and the design gate after every wave
- [ ] No agent merges
