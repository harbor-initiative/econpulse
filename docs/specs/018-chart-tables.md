# #18 — Table alternative under every chart

Parent: #2 · Epic spec: [02-the-report](../remediation/specs/02-the-report.md) · Status: draft

## Problem

Every chart is an `aria-hidden` SVG with no alternative. The design doc promised a
table toggle and it was never built. A screen-reader user gets a label and a
number and no series at all.

## Approach

A `<details>` under each chart:

```html
<details data-chart-table>
  <summary>Table</summary>
  <table>…period, value, margin, agency…</table>
</details>
```

Collapsed by default so it does not compete with the chart. Keyboard reachable
because `<details>` is. Rows carry the period and value; the receipt below the
chart covers provenance, so the table does not repeat it per row.

The chart keeps `aria-hidden`; the table is the accessible path, and the panel
label names the measure for anyone who reaches it first.

## Acceptance criteria

- [ ] Every chart has a table with the full series
- [ ] Reachable and operable by keyboard alone
- [ ] Values match the chart exactly, asserted in a test
- [ ] Absent values appear as an em dash, never a zero

## Risks

A table under every chart doubles the page height when opened. Collapsed by
default and print-excluded.

## Out of scope

CSV download of the table, sorting, column selection.

## Files

`server/view.ts` · `server/index.ts` · new `tests/tables.test.ts`
