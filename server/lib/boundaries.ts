/**
 * One county's outline, out of the state file that holds it.
 *
 * The build writes one file per state (52 files, 3.5 MB) rather than one per
 * county (3,222 files), and this pulls a single feature out of the right one.
 * A place page then fetches about a kilobyte instead of a megabyte.
 *
 * A city has no boundary file of its own: the outline drawn is the county it
 * sits in, which is the honest shape at this resolution.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(import.meta.dirname, "..", "..", "data", "boundaries");
const CACHE = new Map<string, string>();

interface BoundaryFile {
  features: Array<{ properties: { GEOID?: string } }>;
  centres?: Record<string, { center: [number, number]; zoom: number }>;
}

function load(name: string): BoundaryFile | null {
  try {
    return JSON.parse(readFileSync(path.join(DIR, name), "utf8")) as BoundaryFile;
  } catch {
    return null;
  }
}

/**
 * A state's counties, a county's outline, or a city's own shape.
 *
 * The three live in different files because a county page should not fetch the
 * city boundaries and a city page should not fetch the counties. A geoid is
 * enough to know which file to open: two digits is a state, five a county, seven
 * a place.
 */
export function boundaryFor(geoid: string): string | null {
  const cached = CACHE.get(geoid);
  if (cached) return cached;

  const state = geoid.slice(0, 2);
  const collection = (features: BoundaryFile["features"], centres: BoundaryFile["centres"]) =>
    JSON.stringify({ type: "FeatureCollection", features, centres: centres ?? {} });

  if (geoid.length === 2) {
    const file = load(`state-${state}.json`);
    if (!file?.features.length) return null;
    const body = collection(file.features, file.centres);
    CACHE.set(geoid, body);
    return body;
  }

  if (geoid.length >= 7) {
    const file = load(`places-${state}.json`);
    const features = (file?.features ?? []).filter((feature) => feature.properties.GEOID === geoid);
    if (!features.length) return null;
    const body = collection(features, file?.centres);
    CACHE.set(geoid, body);
    return body;
  }

  const file = load(`state-${state}.json`);
  const features = (file?.features ?? []).filter((feature) => feature.properties.GEOID === geoid);
  if (!features.length) return null;
  const body = collection(features, file?.centres);
  CACHE.set(geoid, body);
  return body;
}

/** The centre and zoom for a place, from the same file. */
export function mapCentre(geoid: string): { center: [number, number]; zoom: number } | null {
  const body = boundaryFor(geoid);
  if (!body) return null;
  const parsed = JSON.parse(body) as { centres?: Record<string, { center: [number, number]; zoom: number }> };
  return parsed.centres?.[geoid] ?? null;
}
