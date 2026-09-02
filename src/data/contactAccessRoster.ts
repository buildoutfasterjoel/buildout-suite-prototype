/**
 * Who can be handed a task on a contact: whoever has access to it — the
 * accountable person (the assignee, from whom the owner is derived) plus
 * everyone it's shared with. Used by the contact detail's task assignees and
 * the Add Task modal. Falls back to the protagonist for a record with no
 * resolvable assignee, so the list is never empty.
 */
import { useDataStore } from './dataStore'
import { CURRENT_USER, findTeammate, teammateIdByName, type Teammate } from './teammates'

export function accessRosterFor(contactId: string): Teammate[] {
  const s = useDataStore.getState()
  const contact = s.contacts.get(contactId)
  const assigneeId = contact ? teammateIdByName(contact.assignedTo) : undefined
  const head = (assigneeId && findTeammate(assigneeId)) || CURRENT_USER
  const seen = new Set<string>()
  const roster: Teammate[] = []
  for (const m of [head, ...(s.contactShares.get(contactId) ?? []).map((sh) => sh.member)]) {
    if (!seen.has(m.id)) {
      seen.add(m.id)
      roster.push(m)
    }
  }
  return roster
}
