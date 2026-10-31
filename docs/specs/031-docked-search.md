# #31 — Search docked on every page

Parent: #2 · Epic spec: [05-design-system](../remediation/specs/05-design-system.md) ·
Audit: [DESIGN-AUDIT](../../DESIGN-AUDIT.md) D4 · Status: draft

## Problem

On a place page the top bar carries Status and GitHub. The most frequent job after
reading a place is "show me a different one", and it costs a trip back to the home
page.

## Approach

The search field lives in the top bar on every route: home, place, question card,
status, method, and the not-found page.

It is the first focusable element, before the nav. It submits to `/ask`, so a
question works from a place page too. The home page keeps its large hero field;
the docked one is a compact 420px version in the same visual language.

## Acceptance criteria

- [ ] A search field is present in the top bar on every route
- [ ] It is the first focusable element
- [ ] It submits to `/ask` and answers questions as well as names
- [ ] The home page still has its hero field
- [ ] The gate asserts presence (#5 G9)

### What changed while building it

G9 used to assert "the top bar contains a search input", which fails the home
page on purpose: there the hero field is the search, and the spec says so. The
rule it was measuring is "a reader can search from any page", so the gate now
accepts a search input in the top bar or in the body. Without that, 18 failures
became 3 for the right reason and for the wrong rule.

The field is first in the document so Tab reaches it first, and CSS `order`
places it between the brand and the nav. Tab order follows the document;
the layout follows the design. At 390px it drops to its own row rather than
compressing the nav into nothing.

## Risks

Two search fields on the home page is a duplication. The hero field is the
primary; the docked one hides on the home route.

## Out of scope

Voice input, recent searches, keyboard shortcuts.

## Files

`server/views/layout.ts` · `server/views/css.ts` · `scripts/lib/probe.mjs` · `scripts/design-check.mjs`