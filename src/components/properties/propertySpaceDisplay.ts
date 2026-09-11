import type { LeaseRateUnits, UnitType } from "#/data/types";
import type { SpaceStatus } from "#/data/propertySpaces";

/**
 * One colour per space status, on the stage tokens where the two coincide so a
 * space that is Available and its deal that is Active read as the same colour.
 * Vacant takes the pitching amber — "something could start here". Occupied is a
 * grey one step lighter than Lost / Not advertised so the two separate.
 *
 * The design call lives here and nowhere else: change a token, not a call site.
 */
export const SPACE_STATUS_COLORS: Record<SpaceStatus, string> = {
  Available: "var(--stage-active)",
  "Under Contract": "var(--stage-under-contract)",
  Leased: "var(--stage-closed)",
  "Not advertised": "var(--stage-inactive)",
  Vacant: "var(--stage-proposal)",
  Occupied: "var(--space-occupied)",
};

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  residential: "Residential",
  office: "Office",
  retail: "Retail",
  industrial: "Industrial",
  other: "Other",
};

const RATE_UNIT_SUFFIX: Record<LeaseRateUnits, string> = {
  "SF/Yr": "/SF/yr",
  "SF/Mo": "/SF/mo",
  Monthly: "/mo",
};

/** `$48.00/SF/yr`; null when there is no rate — the caller renders an em dash. */
export function formatAskingRent(rate: number | null, units: LeaseRateUnits): string | null {
  if (rate == null) return null;
  return `$${rate.toFixed(2)}${RATE_UNIT_SUFFIX[units]}`;
}
