/**
 * What a page tells a crawler about itself.
 *
 * Three objects on a place page: the place, the dataset it came from, and where
 * it sits in the site. There is deliberately no `AggregateRating` and no
 * `Review`: a county is not a business and a percentile is not a score out of
 * five. Marking this up as a rating would put a star rating in a search result
 * for a place that nobody reviewed.
 */

import type { Place } from "../store.ts";
import type { Panel } from "../views/panel.ts";
import { SITE, absolute } from "./site.ts";

interface JsonLd {
  "@context": string;
  "@type": string;
  [key: string]: unknown;
}

export function placeJsonLd(place: Place, panels: Panel[], meta: Record<string, string>): JsonLd[] {
  const url = absolute(`/p/${place.geoid}`);
  const placeNode: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    // `name` already carries the state: "Philadelphia County, Pennsylvania".
    name: place.name,
    identifier: place.geoid,
    url,
    address: {
      "@type": "PostalAddress",
      addressRegion: place.state_code ?? undefined,
      addressCountry: "US",
    },
  };

  const variables = panels
    .filter((panel) => panel.fact)
    .map((panel) => ({
      "@type": "PropertyValue",
      name: panel.label,
      value: panel.fact?.value,
      unitText: panel.fact?.unit,
      measurementTechnique: panel.fact?.dataset,
      description: `${panel.fact?.agency} · ${panel.fact?.period} · retrieved ${panel.fact?.retrieved_at}`,
    }));

  const dataset: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${place.name} in the EconPulse record`,
    description: "Figures published by United States federal agencies, with the agency, dataset, period and retrieval date for each.",
    url,
    creator: { "@type": "Organization", name: "Harbor Initiative", url: "https://harborgovcon.com" },
    license: "https://creativecommons.org/publicdomain/zero/1.0/",
    isAccessibleForFree: true,
    temporalCoverage: meta["data.version"] ?? undefined,
    variableMeasured: variables,
  };

  const breadcrumb: JsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE.name, item: SITE.origin },
      {
        "@type": "ListItem",
        position: 2,
        name: place.state_code ?? place.kind,
        item: absolute(place.kind === "state" ? `/p/${place.geoid}` : "/"),
      },
      { "@type": "ListItem", position: 3, name: place.name, item: url },
    ],
  };

  return [placeNode, dataset, breadcrumb];
}
