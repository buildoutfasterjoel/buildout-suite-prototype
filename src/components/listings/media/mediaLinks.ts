import type { MediaLink } from "#/data/types";
import { buildingWide, ownedByUnit } from "#/data/unitScopedMarketing";

/**
 * The three named destinations, in display order.
 *
 * Links is deliberately separate from Visual Media even though the underlying
 * types overlap: Visual Media is a repeatable gallery of preset embeds, Links is
 * three specific destinations a broker fills in once each.
 */
export const LINK_KINDS: readonly { kind: MediaLink["kind"]; label: string }[] = [
  { kind: "video", label: "Video URL" },
  { kind: "matterport", label: "Matterport Link" },
  { kind: "virtualTour", label: "Virtual Tour Link" },
];

/**
 * The single link of a kind in a scope, if set.
 *
 * No building-wide fallback for a unit, unlike `mediaForUnit`: these render as
 * single-value fields, and inheriting the building's would make a suite look like
 * it had its own.
 */
export function linkInScope(
  all: MediaLink[],
  kind: MediaLink["kind"],
  unitId: string | null,
): MediaLink | undefined {
  const scoped = unitId ? ownedByUnit(all, unitId) : buildingWide(all);
  return scoped.find((l) => l.kind === kind);
}

/**
 * Set, replace or clear the one link of a kind in a scope.
 *
 * The model is a list so it needs no per-unit grain of its own, but the UI shows
 * exactly one row per kind — so this upserts rather than appends. Two records of
 * one kind in one scope would leave the second unreachable in the UI while still
 * sitting in the data.
 *
 * An empty or whitespace url removes the record rather than storing a blank,
 * so "cleared" and "never set" are the same state.
 */
export function upsertLink(
  all: MediaLink[],
  kind: MediaLink["kind"],
  unitId: string | null,
  url: string,
): MediaLink[] {
  const existing = linkInScope(all, kind, unitId);
  if (url.trim() === "") {
    return existing ? all.filter((l) => l.id !== existing.id) : all;
  }
  if (!existing) {
    return [...all, { id: `${unitId ?? "building"}-${kind}`, url, kind, unitId }];
  }
  return all.map((l) => (l.id === existing.id ? { ...l, url } : l));
}
