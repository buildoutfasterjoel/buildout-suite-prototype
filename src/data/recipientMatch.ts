import type { Contact } from '#/data/types'

/** The two halves of a `Name <addr@host>` recipient line, either of which may be absent. */
function splitRecipient(raw: string): { name: string; address: string } {
  const angled = raw.match(/^(.*)<([^>]+)>\s*$/)
  if (angled) {
    return { name: angled[1].trim().replace(/^"|"$/g, ''), address: angled[2].trim() }
  }
  const bare = raw.trim()
  // No angle brackets: an @ makes it an address, anything else reads as a name.
  return bare.includes('@') ? { name: '', address: bare } : { name: bare, address: '' }
}

/**
 * Resolve an email recipient line to the contact it refers to.
 *
 * Matches on the address first, then falls back to the display name. The name
 * fallback is doing real work, not covering an edge case: recipient lines on
 * AI-written drafts are generated, and the model reaches for the conventional
 * `first.last@company.com` while seeded contacts carry addresses like
 * `earl@pettigrewholdings.com` (heroes) or a faker address that follows no
 * pattern at all. The name is the half the model gets right.
 *
 * Returns undefined when nothing matches — for a list send there's no single
 * contact to find, which is a legitimate answer, not a failure.
 */
export function matchRecipient(raw: string, contacts: Contact[]): Contact | undefined {
  const { name, address } = splitRecipient(raw)
  const wanted = address.toLowerCase()

  if (wanted) {
    for (const c of contacts) {
      if (c.email?.toLowerCase() === wanted) return c
      if (c.emails?.some((e) => e.toLowerCase() === wanted)) return c
    }
  }

  const wantedName = name.toLowerCase()
  if (wantedName) {
    for (const c of contacts) {
      if (`${c.firstName} ${c.lastName}`.trim().toLowerCase() === wantedName) return c
    }
  }

  return undefined
}
