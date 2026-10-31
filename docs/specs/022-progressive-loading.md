# #22 — Progressive loading for the question box

Parent: #3 · Epic spec: [03-the-question-box](../remediation/specs/03-the-question-box.md) · Status: draft

## Problem

A question blocks for three to five seconds and the browser shows the previous
page, unchanged. There is no signal that anything is happening, and a five-second
silence reads as a broken box.

## Approach

Progressive enhancement with no framework.

- The form posts normally. With JavaScript, submit is intercepted, `/ask` is
  fetched, the shell renders immediately with the question echoed, and the
  response replaces the document when it arrives.
- The progress line advances on a timer through three named steps — *reading the
  question · finding the place · pulling the number* — and the third waits for
  the response. It never claims to be finished early.
- With JavaScript off, the original blocking request still works and returns the
  same page.

## Acceptance criteria

- [ ] The shell appears within 100 ms of submit
- [ ] The progress line names a step at all times and never completes early
- [ ] The response replaces the document
- [ ] JavaScript disabled still answers
- [ ] A failure replaces the shell with the right state from #21

### What changed while building it

The loading panel replaces the front of the page rather than the whole document,
so the stylesheet is already there and nothing flashes white. The document is
replaced once, when the answer arrives.

The panel is inserted in 2 ms and the first step is set at submit. A fast answer
therefore never shows steps two and three, which is correct: the steps describe
waiting, and there was none.

`public/ask.js` is served by the assets route with a five-minute cache. The name
does not change between deploys, so it is not immutable like a font.

## Risks

A fake progress bar is a lie if it never changes. Three named steps tied to real
phases, with the last one waiting, keeps it honest.

## Out of scope

Streaming model tokens, partial results, optimistic rendering.

## Files

new `public/ask.js` · `server/views/states.ts` · `server/views/ask.ts` · `server/routes/ask.ts`