# #21 — Six distinct states for the box

Parent: #3 · Epic spec: [03-the-question-box](../remediation/specs/03-the-question-box.md) · Status: draft

## Problem

Every failure renders the same place picker. "I could not reach the model" and "I
could not tell which place you meant" are different sentences and currently look
identical.

## Approach

Six templates, each with one job:

| State | When | Sentence |
|---|---|---|
| Loading | request in flight | the shell, question echoed, a progress line |
| Not understood | no place and no metric | "I could not tell which place you meant." + examples |
| Unavailable | breaker open or both attempts failed | "The model is not responding. Pick a place and I will answer without it." |
| Place not found | a name resolved to nothing | "I found *X* but we do not have it." + nearest matches |
| Measure missing | place resolved, metric absent | "No *measure* for *place*." + what it does have |
| Rate limited | bucket empty | "20 questions an hour. Resets at *time*." |

Each is a route branch with its own template, and each is reachable in a test with a fixture.

## Acceptance criteria

- [ ] Each state is reachable in a test
- [ ] Unavailable and not-understood are visibly different
- [ ] No state renders a stack trace or a blank page
- [ ] Every state offers one action that can succeed

## Risks

Six states is more surface than one picker, and a wrong branch is a confusing
page. The tests are the guard.

## Out of scope

Localisation, animated transitions between states.

## Files

new `server/states.ts` · `server/index.ts` · `server/view.ts` ·
new `tests/states.test.ts`
