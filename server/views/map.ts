/**
 * Where this place is.
 *
 * A 200px map beside the header block. It answers "where", then gets out of the
 * way: not interactive, no controls, and the outline drawn from a file on our
 * own origin so it survives the tiles being unavailable.
 *
 * The centre comes from the outline's own bounding box, computed at build time by
 * `scripts/fetch-boundaries.mjs`, so nothing here guesses a coordinate.
 */

import { esc } from "./layout.ts";

export interface MapInput {
  geoid: string;
  center: [number, number] | null;
  zoom: number;
}

export function mapBlock(input: MapInput): string {
  if (!input.center) return "";
  const [lon, lat] = input.center;
  return `<figure class="mapf" data-map data-geoid="${esc(input.geoid)}" data-center="[${lon.toFixed(4)},${lat.toFixed(4)}]" data-zoom="${input.zoom}">
    <noscript><p class="mapnote">The outline needs JavaScript. The GEOID is in the scope line above.</p></noscript>
  </figure>`;
}
