/**
 * The measures the site knows about, and the order the report uses.
 *
 * `compare` means a national series exists and is drawn dashed behind the place.
 * `countyFallback` means the measure is only published for counties, so a place
 * inside one borrows the county figure and says so in the panel note.
 */


export interface MetricSpec {
  label: string;
  compare: boolean;
  countyFallback: boolean;
}

export const METRICS: Record<string, MetricSpec> = {
  population: { label: "Population", compare: false, countyFallback: false },
  unemployment_rate: { label: "Unemployment", compare: true, countyFallback: true },
  median_gross_rent: { label: "Median gross rent", compare: true, countyFallback: false },
  median_household_income: { label: "Median household income", compare: true, countyFallback: false },
  median_home_value: { label: "Median home value", compare: true, countyFallback: false },
  gdp: { label: "Output", compare: false, countyFallback: true },
  federal_obligations: { label: "Federal obligations", compare: false, countyFallback: true },
  poverty_rate: { label: "Poverty rate", compare: true, countyFallback: false },
  bachelors_or_higher: { label: "Bachelor's degree or higher", compare: true, countyFallback: false },
  median_age: { label: "Median age", compare: true, countyFallback: false },
  labor_force_participation_rate: { label: "Labor force participation", compare: true, countyFallback: false },
  unemployment_rate_acs: { label: "Unemployment rate, five-year average", compare: false, countyFallback: false },
};

/** The order the one-page report uses. */
export const REPORT_ORDER = ["population", "unemployment_rate", "median_gross_rent", "gdp", "federal_obligations"];
