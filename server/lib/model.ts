/**
 * The one place this server talks to a model.
 *
 * The model names a place and picks a measure. It never receives a GEOID and
 * never returns one, so the index resolves the name afterwards and a
 * hallucinated identifier cannot put a wrong number on a page.
 */


export interface ModelAnswer { placeName: string | null; metric: string | null }

/** First balanced JSON object in a string, ignoring anything around it. */
export function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/**
 * The model names a place and picks a measure. It never sees a GEOID, so it
 * cannot invent one, and the answer is resolved against the index afterwards.
 */
export async function askModel(
  question: string,
  metrics: Array<{ id: string; label: string }>,
): Promise<ModelAnswer | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  // openrouter/free is a router: it picks whichever free model is
  // available, so one provider going down does not break the box.
  const model = process.env.ECONPULSE_MODEL ?? process.env.OPENROUTER_MODEL ?? "openrouter/free";
  const metricMenu = metrics.map((m) => `${m.id} (${m.label})`).join(", ");

  const prompt = [
    "You turn a question about a United States place into two fields.",
    'Reply with JSON only, no prose: {"place":"...","metric":"..."}',
    "place: the US city, county, or state the question is about, as a plain name. Use your knowledge. If none is implied, null.",
    `metric: one id from this list, or null if the question is not about a measure: ${metricMenu}`,
    "Examples:",
    'Q: How are things going where the Liberty Bell is -> {"place":"Philadelphia","metric":null}',
    'Q: Is rent going up in Austin? -> {"place":"Austin","metric":"median_gross_rent"}',
    'Q: Are people leaving the city of brotherly love -> {"place":"Philadelphia","metric":"population"}',
    `Q: ${question}`,
  ].join("\n");

  // The free router is occasionally out of capacity. One retry costs a second
  // and turns a visible failure into an invisible one.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          // The free router can land on a reasoning model that spends tokens
          // thinking before it answers. 120 produced an empty answer with
          // finish_reason "length" every time. 400 leaves room for both.
          max_tokens: 400,
          provider: { data_collection: "deny" },
        }),
      });
      if (!response.ok) {
        console.error(`[ask] model ${model} returned ${response.status} (attempt ${attempt + 1})`);
        if (response.status >= 500 && attempt === 0) continue;
        return null;
      }
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(content) as { place?: unknown; metric?: unknown } | null;
      if (!parsed) {
        console.error("[ask] model returned no JSON");
        return null;
      }
      return {
        placeName: typeof parsed.place === "string" && parsed.place.trim() ? parsed.place.trim() : null,
        metric: typeof parsed.metric === "string" && parsed.metric.trim() ? parsed.metric.trim() : null,
      };
    } catch (error) {
      console.error("[ask] model call failed:", (error as Error).message);
      if (attempt === 0) continue;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
