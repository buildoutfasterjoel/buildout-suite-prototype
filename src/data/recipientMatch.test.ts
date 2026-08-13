import { describe, expect, it } from 'vitest'
import type { Contact } from './types'
import { matchRecipient } from './recipientMatch'

const contact = (over: Partial<Contact>): Contact =>
  ({
    id: 'c1',
    firstName: 'Earl',
    lastName: 'Pettigrew',
    email: 'earl@pettigrewholdings.com',
    ...over,
  }) as Contact

const earl = contact({})
const other = contact({ id: 'c2', firstName: 'Ruth', lastName: 'Solano', email: 'ruth@solano.com' })
const book = [other, earl]

describe('matchRecipient', () => {
  it('matches a bare address', () => {
    expect(matchRecipient('earl@pettigrewholdings.com', book)?.id).toBe('c1')
  })

  it('matches the address inside a Name <addr> line, ignoring case', () => {
    expect(matchRecipient('Earl Pettigrew <EARL@pettigrewholdings.com>', book)?.id).toBe('c1')
  })

  it('matches a secondary address', () => {
    const withExtra = contact({ id: 'c3', emails: ['e.pettigrew@holdings.co'] })
    expect(matchRecipient('e.pettigrew@holdings.co', [withExtra])?.id).toBe('c3')
  })

  it('falls back to the display name when the generated address is invented', () => {
    // The case that actually shows up: the model writes the conventional
    // first.last address, which no seeded contact carries.
    expect(matchRecipient('Earl Pettigrew <earl.pettigrew@pettigrewholdings.com>', book)?.id).toBe(
      'c1',
    )
  })

  it('matches a name-only recipient', () => {
    expect(matchRecipient('Ruth Solano', book)?.id).toBe('c2')
  })

  it('strips quotes around a display name', () => {
    expect(matchRecipient('"Ruth Solano" <nope@example.com>', book)?.id).toBe('c2')
  })

  it('returns undefined when neither address nor name is in the book', () => {
    expect(matchRecipient('Investors List <investors@example.com>', book)).toBeUndefined()
    expect(matchRecipient('', book)).toBeUndefined()
  })

  it('prefers an address match over a name match', () => {
    // Same person's name on one record, the searched-for address on another.
    const nameTwin = contact({ id: 'twin', email: 'someone.else@example.com' })
    const addressOwner = contact({ id: 'addr', firstName: 'E.', lastName: 'P.' })
    expect(
      matchRecipient('Earl Pettigrew <earl@pettigrewholdings.com>', [nameTwin, addressOwner])?.id,
    ).toBe('addr')
  })
})
