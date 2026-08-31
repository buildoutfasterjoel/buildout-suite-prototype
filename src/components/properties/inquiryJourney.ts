import type { Inquiry } from "./inquiryRow";

/**
 * What a lead has done outside the app, in the order they do it. The panel
 * renders this as a progress bar, so the order is the display order.
 */
export const JOURNEY_STAGES = [
  "Public Documents",
  "Created Profile",
  "Verified Email",
  "Low Documents",
  "Medium Documents",
  "High Documents",
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

/**
 * Index of the furthest stage this inquiry has reached.
 *
 * This is a funnel, so the gates are walked in order and the first unmet one
 * stops the walk — a stage is never marked complete because a *later* fact
 * happens to hold. Two things go wrong otherwise: the bar shows a gap (High
 * Documents filled, Verified Email not), which reads as a rendering bug; and
 * the bar contradicts the Account Status row sitting two inches below it.
 *
 * The cost is a lead who holds High access while capped at Created Profile.
 * That is the honest reading — access granted, gate not passed — and the panel
 * names the unmet gate as "Next", so it explains itself.
 */
export function journeyReach(inquiry: Inquiry): number {
  // Stage 0 needs no gate: they reached the public documents by inquiring.
  if (!inquiry.createdProfile) return 0;
  if (!inquiry.verified) return 1;
  // Verified email carries Low access with it — there is no "no access" state,
  // so clearing the email gate always lands on stage 3 and stage 2 is never a
  // resting place.
  if (inquiry.accessLevel === "Low") return 3;
  if (inquiry.accessLevel === "Medium") return 4;
  return 5;
}

export type JourneyProgress = {
  /** Index of the furthest stage reached. */
  reach: number;
  /** Stages complete, i.e. `reach + 1`. */
  complete: number;
  total: number;
  /** Percentage complete, for the Progress bar. */
  pct: number;
  /** The stage they are standing on. */
  current: JourneyStage;
  /** The stage they have yet to reach, or null when the journey is done. */
  next: JourneyStage | null;
};

export function journeyProgress(inquiry: Inquiry): JourneyProgress {
  const reach = journeyReach(inquiry);
  const total = JOURNEY_STAGES.length;
  const complete = reach + 1;
  return {
    reach,
    complete,
    total,
    pct: Math.round((complete / total) * 100),
    current: JOURNEY_STAGES[reach],
    next: reach + 1 < total ? JOURNEY_STAGES[reach + 1] : null,
  };
}
