/**
 * The score, and the five pillars it is made of.
 *
 * A percentile is auditable: it says this value is higher than 62% of the peers
 * in the file, and anyone can recompute it. The score is the weighted mean of
 * five of those, so it is a summary of a rank and not a verdict about a place.
 *
 * The pillars are the five measures that have a direction in `metric` and are
 * present for almost every place. Population, output and federal obligations
 * carry no direction, so they cannot say whether a place is doing well; they are
 * on the page as facts and stay out of the score.
 */

import type { DatabaseSync } from "node:sqlite";
import type { Place } from "../store.ts";

export interface Pillar {
  key: string;
  label: string;
  metric: string;
  weight: number;
}

export const PILLARS: Pillar[] = [
  { key: "jobs", label: "Jobs", metric: "unemployment_rate", weight: 30 },
  { key: "housing", label: "Housing", metric: "median_gross_rent", weight: 25 },
  { key: "income", label: "Income", metric: "median_household_income", weight: 20 },
  { key: "education", label: "Education", metric: "bachelors_or_higher", weight: 15 },
  { key: "poverty", label: "Poverty", metric: "poverty_rate", weight: 10 },
];

export type PeerKind = "county" | "place";

export interface Reading {
  peerKind: PeerKind;
  pct: number;
  peers: number;
}

export interface Score {
  /** 0–100, the weighted mean of the pillars that exist for this place. */
  value: number;
  /** A band, in words. Never a colour. */
  label: string;
  /** How many of the five pillars contributed. */
  pillars: number;
  /** The place's own kind first, then the other peer set where it exists. */
  readings: Reading[];
  /** The pillars that had no percentile, named so the page can say so. */
  missing: string[];
}

/** "well above peers", "near peers", "below peers" — a band, not a grade. */
export function labelFor(value: number): string {
  if (value >= 80) return "well above its peers";
  if (value >= 60) return "above its peers";
  if (value >= 40) return "near its peers";
  if (value >= 20) return "below its peers";
  return "well below its peers";
}

function readingsFor(db: DatabaseSync, geoid: string): Map<string, Reading> {
  const rows = db
    .prepare("SELECT metric, peer_kind, pct, peers FROM percentile WHERE geoid = ?")
    .all(geoid) as unknown as Array<{ metric: string; peer_kind: PeerKind; pct: number; peers: number }>;
  const byMetric = new Map<string, Reading>();
  for (const row of rows) {
    // One reading per metric per peer set; the primary set is chosen below.
    const key = `${row.metric}:${row.peer_kind}`;
    byMetric.set(key, { peerKind: row.peer_kind, pct: row.pct, peers: row.peers });
  }
  return byMetric;
}

/** The peer set a place is scored against first: its own kind. */
function primaryKind(place: Place): PeerKind {
  return place.kind === "county" ? "county" : "place";
}

/** One reading per peer set: the weighted mean of the pillars that exist there. */
function scoreForKind(byMetric: Map<string, Reading>, kind: PeerKind): { value: number; peers: number; pillars: number; missing: string[] } | null {
  let weighted = 0;
  let weight = 0;
  let pillars = 0;
  let peers = 0;
  const missing: string[] = [];

  for (const pillar of PILLARS) {
    const reading = byMetric.get(`${pillar.metric}:${kind}`);
    if (!reading) {
      missing.push(pillar.label);
      continue;
    }
    weighted += reading.pct * pillar.weight;
    weight += pillar.weight;
    pillars += 1;
    peers = Math.max(peers, reading.peers);
  }

  if (!weight) return null;
  return { value: Math.round(weighted / weight), peers, pillars, missing };
}

export function scoreFor(db: DatabaseSync, place: Place): Score | null {
  let byMetric: Map<string, Reading>;
  try {
    byMetric = readingsFor(db, place.geoid);
  } catch {
    return null; // a file built before the percentile pass has no table
  }
  if (!byMetric.size) return null;

  const primary = primaryKind(place);
  const secondary: PeerKind = primary === "county" ? "place" : "county";

  const own = scoreForKind(byMetric, primary);
  if (!own) return null;
  const other = scoreForKind(byMetric, secondary);

  const readings: Reading[] = [{ peerKind: primary, pct: own.value, peers: own.peers }];
  if (other) readings.push({ peerKind: secondary, pct: other.value, peers: other.peers });

  return {
    value: own.value,
    label: labelFor(own.value),
    pillars: own.pillars,
    readings,
    // What is missing from the primary set, which is the one that counts.
    missing: own.missing,
  };
}

/** The weights as the header prints them. */
export function weightsText(): string {
  return PILLARS.map((pillar) => `${pillar.label.toLowerCase()} ${pillar.weight}`).join(" · ");
}
