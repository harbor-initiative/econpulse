/**
 * One number, printed the way its unit is read.
 *
 * Kept apart from the panels because the comparison rows print the same
 * values, and two formatters that disagree would be two products on one page.
 */

export function formatValue(value: number, unit: string): string {
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "years") return value.toFixed(1);
  if (unit === "usd_per_month") return `$${Math.round(value).toLocaleString("en-US")}`;
  if (unit === "usd") {
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
  return Math.round(value).toLocaleString("en-US");
}
