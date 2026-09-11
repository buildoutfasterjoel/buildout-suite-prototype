import { getProperty, getStore } from "#/data/store";
import { leaseShellForProperty } from "#/data/propertySpaces";
import { addSpaceToDeal } from "#/data/leaseSpaces";
import { useCreateDeal } from "#/data/useCreateDeal";
import { STATUS_LABELS } from "./propertyDisplay";

export type CreateDealFromSpaceOutcome =
  /** A child deal was started on the property's lease shell; navigate to it. */
  | { kind: "started"; shellId: string; spaceId: string }
  /** No lease shell exists; the Create Deal modal was opened pre-scoped to this space. */
  | { kind: "modal" }
  /** A landlord-rep lease exists but cannot take a space (Closed, Lost…). */
  | { kind: "blocked"; reason: string }
  | { kind: "missing" };

/**
 * Why a space cannot start a deal right now, or null when it can. Read before
 * rendering the button so it can be disabled with the reason in a tooltip.
 *
 * Only a landlord-rep lease that `canAddSpaces` rejected blocks — it exists but
 * is past taking a space. No lease at all is not a block: that case opens the
 * Create Deal modal instead (see `createDealFromSpace`).
 */
export function createDealBlockedReason(propertyId: string): string | null {
  if (!getProperty(propertyId)) return null;
  if (leaseShellForProperty(propertyId)) return null;
  const stuck = [...getStore().listings.values()].find(
    (l) =>
      l.propertyId === propertyId &&
      l.parentDealId == null &&
      l.dealType === "Lease" &&
      l.dealSide === "seller",
  );
  if (!stuck) return null;
  return `This building's lease assignment is ${STATUS_LABELS[stuck.status]}. Reopen it to add spaces.`;
}

/**
 * "Create deal from this space." A space deal is always a child of the
 * building's lease shell (`dealShape`), so:
 *
 * - **A shell exists and can take a space** → `addSpaceToDeal`, the same call
 *   the deal directory's *Start a deal* makes. The caller navigates to the new
 *   child's Details.
 * - **No lease assignment on the property yet** → open the Create Deal modal
 *   locked to Lease with the whole building as its scope, carrying this unit; on
 *   completion the modal adds the space to the deal it just created. Two
 *   records, one flow, nothing created silently — the landlord and the broker
 *   are the broker's to pick, not the seed's.
 * - **A landlord-rep lease exists but is Closed/Lost** → blocked, with the reason.
 */
export function createDealFromSpace(propertyId: string, unitId: string): CreateDealFromSpaceOutcome {
  const property = getProperty(propertyId);
  if (!property) return { kind: "missing" };

  const shell = leaseShellForProperty(propertyId);
  if (shell) {
    const created = addSpaceToDeal(shell.id, unitId);
    if (!created) return { kind: "missing" };
    return { kind: "started", shellId: shell.id, spaceId: created.deal.id };
  }

  const reason = createDealBlockedReason(propertyId);
  if (reason) return { kind: "blocked", reason };

  useCreateDeal.getState().openFor({ property, lockLease: true, spaceUnitId: unitId });
  return { kind: "modal" };
}
