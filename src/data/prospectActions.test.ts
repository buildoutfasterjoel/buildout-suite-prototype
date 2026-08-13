import { beforeEach, describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import { useOwnerCredits } from './ownerCredits'
import { getProspectProperties } from './prospects'
import { getProspectOwnership } from './prospectOwners'
import {
  addProspectProperty,
  addProspectWithOwner,
  isInDatabase,
  saveProspectContact,
  visibleOwnerContacts,
} from './prospectActions'

const prospect = (i = 0) => getProspectProperties()[i]

describe('prospect → database', () => {
  beforeEach(() => useOwnerCredits.getState().reset())

  it('files a prospect record with no deal and no stage', () => {
    const p = prospect(0)
    expect(isInDatabase(p.id)).toBe(false)

    const added = addProspectProperty(p)
    expect(isInDatabase(p.id)).toBe(true)
    // Adding a property must never mint a deal for it.
    expect(added.status).toBeNull()
    expect(
      [...useDataStore.getState().listings.values()].some(
        (l) => l.propertyId === p.id,
      ),
    ).toBe(false)
  })

  it('is idempotent — the tile CTA and the flyout can both add the same record', () => {
    const p = prospect(1)
    const first = addProspectProperty(p)
    const size = useDataStore.getState().properties.size
    const second = addProspectProperty(p)
    expect(second.id).toBe(first.id)
    expect(useDataStore.getState().properties.size).toBe(size)
  })

  it('saves an owner contact linked to the property, creating the property if needed', () => {
    const p = prospect(2)
    const owner = getProspectOwnership(p).contacts[0]
    expect(isInDatabase(p.id)).toBe(false)

    const { contact, alreadySaved } = saveProspectContact(p, owner)
    expect(alreadySaved).toBe(false)
    // The dialog promises the property gets created — hold it to that.
    expect(isInDatabase(p.id)).toBe(true)
    expect(contact.propertyIds).toContain(p.id)
    expect(contact.ownedPropertyIds).toContain(p.id)
    expect(contact.source).toBe('Prospect by Buildout')
  })

  it('does not duplicate a contact already saved from the same record', () => {
    const p = prospect(3)
    const owner = getProspectOwnership(p).contacts[0]
    saveProspectContact(p, owner)
    const size = useDataStore.getState().contacts.size

    const again = saveProspectContact(p, owner)
    expect(again.alreadySaved).toBe(true)
    expect(useDataStore.getState().contacts.size).toBe(size)
  })

  it('adds the property without touching credits when owner data is declined', () => {
    const p = prospect(4)
    const before = useOwnerCredits.getState().balance
    const result = addProspectWithOwner(p, false)

    expect(result.contact).toBeNull()
    expect(result.creditSpent).toBe(false)
    expect(useOwnerCredits.getState().balance).toBe(before)
    expect(isInDatabase(p.id)).toBe(true)
  })

  it('spends one credit and saves the owner when owner data is included', () => {
    const p = prospect(5)
    const before = useOwnerCredits.getState().balance
    const result = addProspectWithOwner(p, true)

    expect(result.creditSpent).toBe(true)
    expect(useOwnerCredits.getState().balance).toBe(before - 1)
    expect(result.contact?.propertyIds).toContain(p.id)
  })

  it('re-adding an already-unlocked property costs nothing', () => {
    const p = prospect(6)
    addProspectWithOwner(p, true)
    const after = useOwnerCredits.getState().balance

    const again = addProspectWithOwner(p, true)
    expect(again.creditSpent).toBe(false)
    expect(useOwnerCredits.getState().balance).toBe(after)
  })
})

describe('lookup depth', () => {
  it('quick returns the owner of record with phone only', () => {
    const p = prospect(7)
    const quick = visibleOwnerContacts(p, 'quick')
    expect(quick).toHaveLength(1)
    expect(quick[0].emails).toEqual([])
    expect(quick[0].phones.length).toBeGreaterThan(0)
  })

  it('in-depth returns the full researched roster', () => {
    const p = prospect(7)
    const full = visibleOwnerContacts(p, 'in-depth')
    expect(full.length).toBeGreaterThan(1)
    expect(full[0].id).toBe(visibleOwnerContacts(p, 'quick')[0].id)
  })

  it('resolves the same owner every time, so a saved contact keeps its id', () => {
    const p = prospect(8)
    expect(getProspectOwnership(p)).toEqual(getProspectOwnership(p))
  })
})
