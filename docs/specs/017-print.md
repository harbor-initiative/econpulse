# #17 — Print stylesheet

Parent: #2 · Epic spec: [02-the-report](../remediation/specs/02-the-report.md) · Status: draft

## Problem

Print is now the only export, by decision, and there is no print stylesheet. A
browser print of the current page cuts panels across pages and drops the header
colour.

## Approach

`@media print` in the single stylesheet, no second file to drift:

- one column, panels unbroken (`break-inside: avoid`)
- the header block first, always
- receipts included at 9pt, never hidden to save space
- footer: URL, app version, data version, retrieval dates
- the map prints as its outline, or not at all if it would break the flow
- links print their href only where the href is the citation

Verified by generating a PDF with Chrome headless and inspecting the page count and the last page's footer.

## Acceptance criteria

- [ ] A PDF of `/p/42101` is one column with every receipt
- [ ] No panel splits across a page boundary
- [ ] The footer carries URL, app version and data version
- [ ] Grayscale output remains legible
- [ ] The PDF is generated in CI and its page count asserted

## Risks

Print fidelity drifts silently because nobody looks at it. The CI PDF check is
the only thing that will keep it honest.

## Out of scope

Server-side PDF rendering, branded cover pages, CSV or JSON export.

## Files

`server/view.ts` (the `@media print` block) · new `scripts/pdf-check.mjs`
