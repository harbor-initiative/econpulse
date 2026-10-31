/**
 * The words this site recognises.
 *
 * Longest phrase first, because "federal spending" must beat "spending". This
 * table is a fallback for a name, never a substitute for reading the question:
 * a keyword scan over a question answered "the Liberty Bell" with Bell County.
 */


interface Rule { metric: string; words: string[] }

/** Longest phrases first: "federal spending" must beat "spending". */
const RULES: Rule[] = [
  { metric: "federal_obligations", words: ["federal money", "federal spending", "federal contracts", "federal funding", "federal dollars", "federal"] },
  { metric: "median_home_value", words: ["home value", "home values", "house price", "house prices", "home price", "home prices", "housing market", "property value"] },
  { metric: "median_gross_rent", words: ["rent", "rents", "rental", "renting", "cost of living"] },
  { metric: "median_household_income", words: ["income", "salary", "salaries", "wages", "earn", "earnings", "pay"] },
  { metric: "unemployment_rate", words: ["unemployment", "jobless", "jobs", "hiring", "layoffs", "layoff", "labor market"] },
  { metric: "population", words: ["population", "growing", "grow", "shrinking", "shrink", "declining", "decline", "residents", "boom", "booming"] },
  { metric: "gdp", words: ["gdp", "output", "economy", "economic", "prosperous", "thriving"] },
  { metric: "poverty_rate", words: ["poverty", "poor", "struggling"] },
  { metric: "bachelors_or_higher", words: ["education", "educated", "degree", "college", "university"] },
  { metric: "median_age", words: ["median age", "how old", "age", "young", "retirees"] },
];

const QUESTION_START = /^(is|are|was|were|how|what|where|which|why|when|does|do|did|should|can|could|will|would|compare|tell|show)\b/i;

/**
 * A question wears a question mark, opens with a question word, or is too long
 * to be a name. Everything else is treated as a name.
 */
export function isQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (/\?/.test(trimmed)) return true;
  if (QUESTION_START.test(trimmed)) return true;
  return trimmed.split(/\s+/).length > 5;
}

export function findMetric(text: string): string | null {
  const lower = ` ${text.toLowerCase()} `;
  for (const rule of RULES) {
    for (const word of rule.words) {
      if (lower.includes(` ${word} `) || lower.includes(`${word} `) || lower.includes(` ${word}`)) {
        return rule.metric;
      }
    }
  }
  return null;
}

/** "rent in austin" -> { metric: rent, place: "austin" } */
export function splitMetricAndPlace(text: string): { metric: string | null; rest: string } {
  const metric = findMetric(text);
  if (!metric) return { metric: null, rest: text };
  const rule = RULES.find((r) => r.metric === metric);
  let rest = text.toLowerCase();
  for (const word of rule?.words ?? []) rest = rest.split(word).join(" ");
  rest = rest.replace(/\b(in|of|for|the|at|around)\b/g, " ").replace(/\s+/g, " ").trim();
  return { metric, rest };
}
