import type { CallTarget } from "./useCallStore";
import type { CallRecapSpecT } from "#/ai/generate/schemas";
import { createDeal, createTask, updateDealStage, deleteTask } from "#/data/actions";
import { emptyDraft } from "#/data/createListing";
import { getContact } from "#/data/store";
import { parseDueDate } from "#/ai/dueDate";

export interface HeroActions {
  dealId: string;
  dealName: string;
  createdStage: "proposal";
  followUpTaskId: string;
  followUpDate: string;
  narration: string;
}

/** A hero call = the target owner carries an overnight signal (the arc's Marcus). */
export function isHeroCall(target: CallTarget | null): boolean {
  if (!target) return false;
  return !!getContact(target.contactId)?.signal;
}

export function heroNarration(dealName: string): string {
  return (
    `I opened a new opportunity on ${dealName} and put a task on your list to prep the BOV.`
  );
}

/** Auto-execute the hero recap extensions: open the opportunity on the owner's
 * (multifamily) property at `proposal` (activation is a later closing beat) and
 * schedule a follow-up task to prep the BOV. Deterministic — runs regardless of
 * API keys. Returns null if the target isn't a hero or its contact/property
 * can't be resolved. */
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
  //    → underwriting-eligible in Phase 4C). Stays at proposal — activation is a
  //    later closing beat, not part of the recap.
  const { deal } = createDeal({
    ...emptyDraft(),
    name: dealName,
    address: recap.opportunity.address,
    propertyId,
    propertyType: "multifamily",
    sellerContactId: contact.id,
    dealSide: "seller",
  });

  // 2. Schedule a follow-up task to prep the BOV.
  const followUpDate = parseDueDate("thursday", opts.now) ?? "";
  const { task } = createTask({
    name: `Prep the BOV for ${dealName}`,
    dueDate: followUpDate,
    type: "deal",
    source: "deal",
    contactId: contact.id,
    dealId: deal.id,
  });

  return {
    dealId: deal.id,
    dealName,
    createdStage: "proposal",
    followUpTaskId: task.id,
    followUpDate,
    narration: heroNarration(dealName),
  };
}

/** Reverse the writes (no hard deal-delete exists → move it off-ladder). */
export function undoHeroActions(actions: HeroActions): void {
  deleteTask(actions.followUpTaskId);
  updateDealStage(actions.dealId, "inactive");
}
