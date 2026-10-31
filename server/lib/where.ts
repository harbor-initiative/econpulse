/**
 * Which place is at this point.
 *
 * The boundaries are already here for the map, so "use my location" needs no
 * geocoder and no third party: it is a point-in-polygon test against the same
 * files the outline is drawn from.
 *
 * Shapes are loaded once, on the first request, and held. Sixteen megabytes of
 * GeoJSON is a lot to parse for an endpoint most readers never call, so it is
 * not parsed at boot; it is parsed when somebody asks where they are.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(import.meta.dirname, "..", "..", "data", "boundaries");

interface Shape {
  geoid: string;
  kind: "place" | "county";
  bbox: [number, number, number, number];
  /** Outer rings only. A hole would need the full winding rule; no city here has one at this resolution. */
  rings: number[][][];
}

let shapes: Shape[] | null = null;

function bboxOf(rings: number[][][]): [number, number, number, number] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring as Array<[number, number]>) {
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  return [west, south, east, north];
}

/** Every outer ring of a Polygon or MultiPolygon. */
function ringsOf(geometry: { type: string; coordinates: unknown }): number[][][] {
  const out: number[][][] = [];
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates as number[][][];
    if (rings[0]) out.push(rings[0]);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates as number[][][][]) {
      if (polygon[0]) out.push(polygon[0]);
    }
  }
  return out;
}

function load(): Shape[] {
  if (shapes) return shapes;
  const loaded: Shape[] = [];
  let files: string[] = [];
  try {
    files = readdirSync(DIR);
  } catch {
    shapes = [];
    return shapes;
  }

  for (const file of files) {
    const kind: "place" | "county" | null = file.startsWith("places-") ? "place" : file.startsWith("state-") ? "county" : null;
    if (!kind) continue;
    let body: { features?: Array<{ properties?: { GEOID?: string }; geometry?: { type: string; coordinates: unknown } }> };
    try {
      body = JSON.parse(readFileSync(path.join(DIR, file), "utf8"));
    } catch {
      continue;
    }
    for (const feature of body.features ?? []) {
      const geoid = feature.properties?.GEOID;
      if (!geoid || !feature.geometry) continue;
      const rings = ringsOf(feature.geometry);
      if (!rings.length) continue;
      loaded.push({ geoid, kind, bbox: bboxOf(rings), rings });
    }
  }

  shapes = loaded;
  return loaded;
}

/** Ray casting. A point on an edge counts as inside, which is what a reader expects. */
export function inRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    const straddles = yi > lat !== yj > lat;
    if (straddles && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function contains(shape: Shape, lon: number, lat: number): boolean {
  const [west, south, east, north] = shape.bbox;
  if (lon < west || lon > east || lat < south || lat > north) return false;
  return shape.rings.some((ring) => inRing(lon, lat, ring));
}

/**
 * The most specific place at a point: a city if one contains it, otherwise the
 * county. Ties go to the place with the smaller bounding box, which is the one
 * whose boundary is more likely to be the answer somebody wanted.
 */
export function placeAt(lon: number, lat: number): { geoid: string; kind: string } | null {
  const candidates = load().filter((shape) => contains(shape, lon, lat));
  if (!candidates.length) return null;
  const places = candidates.filter((shape) => shape.kind === "place");
  const pool = places.length ? places : candidates;
  const smallest = pool.sort((a, b) => {
    const areaA = (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
    const areaB = (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]);
    return areaA - areaB;
  })[0];
  return smallest ? { geoid: smallest.geoid, kind: smallest.kind } : null;
}
