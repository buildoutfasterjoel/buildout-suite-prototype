/**
 * Assign and Transfer — the two faces of "give this relationship to someone".
 *
 * The four company switches decide who *owns* a record. Assign is the runtime
 * verb that produces the accountable person when the owner is the company,
 * because a company can't pick up the phone. Under broker ownership the verb
 * dissolves: handing a relationship to a colleague is a *transfer* of ownership
 * (the record changes books) — or just a share, which already exists.
 *
 * Both write the same field (`assignedTo` — the owner is derived from it), both
 * land an `assignment` row on the timeline, and both go through the rights
 * check. The UI adds the toast; the assistant's tool doesn't.
 */
import { assignContact, transferContact } from "#/data/actions";
import { getContact } from "#/data/store";
import { CURRENT_USER } from "#/data/teammates";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { useContactSession } from "#/components/contacts/useContactSession";
import type { TimelineEvent } from "#/components/contacts/timeline";

let seq = 0;

function record(
  contactId: string,
  title: string,
  body?: string,
): void {
  const c = getContact(contactId);
  if (!c) return;
  const event: TimelineEvent = {
    id: `assign-${contactId}-${Date.now()}-${seq}`,
    type: "assignment",
    actor: { name: CURRENT_USER.name, avatarUrl: CURRENT_USER.avatarUrl },
    contact: { name: contactFullName(c), id: c.id },
    timestamp: new Date().toISOString(),
    // Above every logged activity, so it sorts as the newest thing that happened.
    seq: 5_000_000 + seq++,
    title,
    body,
    source: "user",
  };
  useContactSession.getState().addSimEvent(contactId, event);
}

/** Route a company-owned record to a person (or nobody). Returns the new assignee name. */
export function assignContactTo(contactId: string, assigneeName: string | null): string | null {
  const before = getContact(contactId)?.assignedTo || null;
  const { contact } = assignContact(contactId, assigneeName, CURRENT_USER.name);
  if (!contact) return null;
  if (assigneeName) {
    record(
      contactId,
      before ? `Reassigned to ${assigneeName}` : `Assigned to ${assigneeName}`,
      before ? `Previously ${before}.` : undefined,
    );
  } else {
    record(contactId, "Unassigned", before ? `Previously ${before}.` : undefined);
  }
  return assigneeName;
}

/**
 * Move a broker-owned record into another broker's book. `keepAsContributor`
 * shares it back to the previous owner at Contributor in the same motion — the
 * old owner stays useful without pretending they still own anything.
 */
export function transferContactTo(
  contactId: string,
  newOwnerName: string,
  keepAsContributor: boolean,
): void {
  const before = getContact(contactId)?.assignedTo || null;
  const { contact } = transferContact(contactId, newOwnerName, keepAsContributor);
  if (!contact) return;
  record(
    contactId,
    `Ownership transferred to ${newOwnerName}`,
    [
      before ? `From ${before}'s book.` : undefined,
      keepAsContributor && before ? `${before} stays on as a Contributor.` : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined,
  );
}
