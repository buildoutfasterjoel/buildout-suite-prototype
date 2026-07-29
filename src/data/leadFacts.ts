import { pickFor } from "#/components/properties/propertyDisplay";

/**
 * Lead status isn't on `Contact`, so it's derived from the id. Shared because
 * two surfaces show it for the same contact on the same deal — the Leads tab
 * and the client report — and they have to agree.
 */
export const LEAD_STATUSES = [
  "No Status",
  "New",
  "Engaged",
  "Contacted",
  "Qualified",
];

export function leadStatusFor(contactId: string): string {
  return pickFor(LEAD_STATUSES, contactId, "lead-status");
}
