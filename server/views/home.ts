/**
 * The front door: a box, four examples, and no claim it cannot keep.
 */


import { shell } from "./layout.ts";
export function home(): string {
  return shell(
    "EconPulse — how is your town doing?",
    `<div class="hero">
      <h1>How is your town doing?</h1>
      <p class="lede">Type a place. Every number carries its source and the date it was pulled.</p>
      <form class="search" action="/ask" method="get">
        <input type="search" name="q" placeholder="Philadelphia, or is rent going up here?" autofocus aria-label="Place or question">
        <div class="hint"><span>No account</span><span>·</span><span>Runs offline</span><span>·</span><span>Free</span></div>
      </form>
      <div class="chips">
        <a class="chip" href="/ask?q=Philadelphia">Philadelphia</a>
        <a class="chip" href="/ask?q=Cook%20County">Cook County</a>
        <a class="chip" href="/ask?q=Is%20rent%20going%20up%20in%20Austin">Is rent going up in Austin?</a>
        <a class="chip" href="/ask?q=Federal%20money%20in%20Philadelphia">Federal money in Philadelphia</a>
      </div>
    </div>`,
    { docked: false, canonical: "/", description: "How is your town doing? Type a place and read every number with the agency, dataset and date behind it." },
  );
}
