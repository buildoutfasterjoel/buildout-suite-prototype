import { useDataStore } from './dataStore'
import { nurtureOnEngagement, type EngagementTrigger } from './contactStage'
import type { Contact, RelationshipStage } from './types'

/**
 * Contact-stage automation, data half.
 *
 * A cold or inquiry-sourced lead is only cold or inquired until somebody starts
 * working it, and having to remember to change the dropdown afterwards is how
 * the People module drifts out of true. So every surface that logs a touch or
 * creates a task reports the fact, and the stage keeps up on its own — see
 * `nurtureOnEngagement` for which triggers move which stage.
 *
 * The visible half (the timeline row explaining the move) lives with the
 * timeline in `useContactSession.recordEngagement`, which is what call sites
 * actually call.
 */

/**
 * Promote a contact to Nurturing if `trigger` starts a relationship, returning
 * the stage it moved from — or null when nothing moved (already nurturing, or on
 * a deal-derived stage, which outranks a touch).
 *
 * Deliberately does NOT write `lastContactedAt`: that field anchors the
 * synthesized timeline arc (see `timelineArcs.ts`), so writing it would silently
 * re-date the contact's whole history — the same rule `touchContactActivity`
 * follows. Storing `nurturing` outright is what makes the promotion stick:
 * `deriveRelationship` keeps a stored temperature for a contact with no deals,
 * so the next reconcile pass agrees instead of undoing it.
 */
export function promoteOnEngagement(
  contactId: string,
  trigger: EngagementTrigger,
): { contact: Contact; from: RelationshipStage } | null {
  const existing = useDataStore.getState().contacts.get(contactId)
  if (!existing) return null
  if (!nurtureOnEngagement(existing.relationship, trigger)) return null

  const contact: Contact = { ...existing, relationship: 'nurturing' }
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(contactId, contact)
    return { contacts }
  })
  useDataStore.getState().persist()
  return { contact, from: existing.relationship }
}
