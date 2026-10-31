#!/usr/bin/env node
/**
 * County outlines, fetched once and served from our own origin.
 *
 * A map that asks a third party for its outline is a map that shows nothing when
 * that party is down or behind a firewall. The tiles are already a dependency;
 * the boundary is the part we can own.
 *
 * Source: the Census Bureau's TIGERweb service, the same agency the numbers come
 * from. `maxAllowableOffset` simplifies the geometry at the source: 0.003 degrees
 * keeps a county recognisable and takes Pennsylvania from 3.3 MB to 70 KB.
 *
 *   node scripts/fetch-boundaries.mjs            every state
 *   node scripts/fetch-boundaries.mjs 42 06      two states
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SERVICE =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query";
/** Incorporated places and census designated places, the two layers a city sits in. */
const PLACE_SERVICE =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer";
const OFFSET = "0.003";
const OUT = path.resolve(import.meta.dirname, "..", "data", "boundaries");

/** The 50 states, DC, and Puerto Rico, as the FIPS prefixes the file uses. */
const STATES = [
  "01","02","04","05","06","08","09","10","11","12","13","15","16","17","18","19","20","21","22","23",
  "24","25","26","27","28","29","30","31","32","33","34","35","36","37","38","39","40","41","42","44",
  "45","46","47","48","49","50","51","53","54","55","56","72",
];

async function fetchPlaces(fips, layer) {
  const url = `${PLACE_SERVICE}/${layer}/query?where=STATE%3D%27${fips}%27&outFields=GEOID,NAME&returnGeometry=true&outSR=4326&f=geojson&maxAllowableOffset=0.01`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${fips} places/${layer}: HTTP ${response.status}`);
  const body = await response.json();
  return body.features ?? [];
}

async function fetchState(fips) {
  const url = `${SERVICE}?where=STATE%3D%27${fips}%27&outFields=GEOID,NAME&returnGeometry=true&outSR=4326&f=geojson&maxAllowableOffset=${OFFSET}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${fips}: HTTP ${response.status}`);
  const body = await response.json();
  if (!body.features?.length) throw new Error(`${fips}: no features`);
  return body;
}

/** The bounding box of a polygon or multipolygon. */
function bounds(coordinates) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const walk = (node) => {
    if (typeof node[0] === "number") {
      const [lon, lat] = node;
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      return;
    }
    for (const child of node) walk(child);
  };
  walk(coordinates);
  return Number.isFinite(west) ? [west, south, east, north] : null;
}

async function main() {
  const only = process.argv.slice(2).filter((arg) => /^\d{2}$/.test(arg));
  const targets = only.length ? only : STATES;
  await mkdir(OUT, { recursive: true });

  let bytes = 0;
  for (const fips of targets) {
    const body = await fetchState(fips);
    // A centre per county, from its own bounding box. The page should not guess
    // where a place is when the geometry is already here.
    body.centres = {};
    for (const feature of body.features) {
      const box = bounds(feature.geometry.coordinates);
      if (!box) continue;
      const [west, south, east, north] = box;
      const span = Math.max(east - west, north - south);
      body.centres[feature.properties.GEOID] = {
        center: [(west + east) / 2, (south + north) / 2],
        zoom: span > 4 ? 5 : span > 1.5 ? 6 : span > 0.6 ? 7 : span > 0.2 ? 8 : 9,
      };
    }
    // A state's own centre, from the union of its counties, so a state page can
    // draw itself.
    const stateBox = body.features.reduce((acc, feature) => {
      const box = bounds(feature.geometry.coordinates);
      if (!box) return acc;
      return acc
        ? [Math.min(acc[0], box[0]), Math.min(acc[1], box[1]), Math.max(acc[2], box[2]), Math.max(acc[3], box[3])]
        : box;
    }, null);
    if (stateBox) {
      const span = Math.max(stateBox[2] - stateBox[0], stateBox[3] - stateBox[1]);
      body.centres[fips] = {
        center: [(stateBox[0] + stateBox[2]) / 2, (stateBox[1] + stateBox[3]) / 2],
        zoom: span > 12 ? 3 : span > 6 ? 4 : span > 3 ? 5 : 6,
      };
    }

    const text = JSON.stringify(body);
    await writeFile(path.join(OUT, `state-${fips}.json`), text);
    bytes += text.length;

    // Cities and CDPs, so a place page draws its own shape rather than a
    // neighbour's.
    const places = [...(await fetchPlaces(fips, 4)), ...(await fetchPlaces(fips, 5))];
    const placeFile = { type: "FeatureCollection", features: places, centres: {} };
    for (const feature of places) {
      const box = bounds(feature.geometry.coordinates);
      if (!box) continue;
      const [west, south, east, north] = box;
      const span = Math.max(east - west, north - south);
      placeFile.centres[feature.properties.GEOID] = {
        center: [(west + east) / 2, (south + north) / 2],
        zoom: span > 0.6 ? 8 : span > 0.25 ? 9 : span > 0.1 ? 10 : 11,
      };
    }
    await writeFile(path.join(OUT, `places-${fips}.json`), JSON.stringify(placeFile));
    process.stdout.write(`  ${fips}  ${String(body.features.length).padStart(3)} counties  ${(text.length / 1024).toFixed(0)} KB\n`);
  }
  console.log(`\n  ${targets.length} states, ${(bytes / 1024 / 1024).toFixed(1)} MB in ${path.relative(process.cwd(), OUT)}/`);
}

await main();
