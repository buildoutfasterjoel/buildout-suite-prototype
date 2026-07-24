import type { CallTarget } from "./useCallStore";
import type { CallRecapSpecT } from "#/ai/generate/schemas";
import { createDeal, createTask, commitStageTransition, updateDealStage, deleteTask } from "#/data/actions";
import { emptyDraft } from "#/data/createListing";
import { getContact } from "#/data/store";
import { parseDueDate } from "#/ai/dueDate";
import { CURRENT_USER } from "#/data/teammates";

export interface HeroActions {
  dealId: string;
  dealName: string;
  movedToStage: "active";
  tourTaskId: string;
  tourDate: string;
  narration: string;
}

/** A hero call = the target owner carries an overnight signal (the arc's Marcus). */
export function isHeroCall(target: CallTarget | null): boolean {
  if (!target) return false;
  return !!getContact(target.contactId)?.signal;
}

export function heroNarration(dealName: string, tourDate: string): string {
  return (
    `I opened a new opportunity on ${dealName}, moved it into your pipeline, ` +
    `and put a tour on your calendar for ${tourDate}.`
  );
}

/** Auto-execute the hero recap extensions: open the opportunity on the owner's
 * (multifamily) property, advance it proposal→active, and schedule the Thursday
 * tour. Deterministic — runs regardless of API keys. Returns null if the target
 * isn't a hero or its contact/property can't be resolved. */
export function applyHeroRecapExtensions(
  input: { target: CallTarget; recap: CallRecapSpecT },
  opts: { now?: Date } = {},
): HeroActions | null {
  const { target, recap } = input;
  const contact = getContact(target.contactId);
  if (!contact || !contact.signal) return null;

  const propertyId = contact.propertyIds[0] ?? "";
  const dealName = recap.opportunity.name.trim() || target.entity || `${target.firstName}'s deal`;

  // 1. Open the opportunity on the owner's existing property (keeps it multifamily
  //    → underwriting-eligible in Phase 4C).
  const { deal } = createDeal({
    ...emptyDraft(),
    name: dealName,
    address: recap.opportunity.address,
    propertyId,
    propertyType: "multifamily",
    sellerContactId: contact.id,
    dealSide: "seller",
  });

  // 2. Move it into the pipeline (proposal → active), with a real history entry.
  commitStageTransition({
    dealId: deal.id,
    targetStage: "active",
    actor: CURRENT_USER.name,
    dealSide: "seller",
    sellerContactId: contact.id,
    publish: true,
  });

  // 3. Schedule the Thursday tour.
  const tourDate = parseDueDate("thursday", opts.now) ?? "";
  const { task } = createTask({
    name: `Tour ${dealName} with ${target.firstName}`,
    dueDate: tourDate,
    type: "tour",
    source: "deal",
    contactId: contact.id,
    dealId: deal.id,
  });

  return {
    dealId: deal.id,
    dealName,
    movedToStage: "active",
    tourTaskId: task.id,
    tourDate,
    narration: heroNarration(dealName, tourDate),
  };
}

/** Reverse the three writes (no hard deal-delete exists → move it off-ladder). */
export function undoHeroActions(actions: HeroActions): void {
  deleteTask(actions.tourTaskId);
  updateDealStage(actions.dealId, "inactive");
}
