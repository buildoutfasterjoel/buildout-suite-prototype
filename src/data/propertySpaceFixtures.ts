import type { Property, PropertyType, PropertyUnit, UnitType } from './types'
import { isoDate } from './leaseSpaceFixtures'

/**
 * Named space fixtures on the *tracked* properties — records the company holds
 * with no deal on them — so the Property record's Spaces tab has every shape the
 * derived-availability helper can produce, on a fresh seed:
 *
 * | Role            | Shape                                   | Headline it produces        |
 * |-----------------|-----------------------------------------|-----------------------------|
 * | `zeroSpaces`    | `units: []`                             | none — today's header       |
 * | `singleOccupied`| one unit, sitting tenant                | `Occupied`                  |
 * | `uniformVacant` | four vacant units                       | `Vacant · 4 spaces`         |
 * | `density`       | 24 units over 6 floors, 16 occupied     | `Vacant · 8 of 24 spaces`   |
 *
 * The mixed shapes come from the lease shells in `leaseSpaceFixtures.ts` (107,
 * 102, 104), which carry deals. These four carry none on purpose: a property with
 * spaces and no lease assignment is what the "Create deal from this space"
 * no-shell flow needs, and a 24-suite tower with no deals is the honest density
 * case for an *asset* roster.
 *
 * Faker-free, like `leaseSpaceFixtures`: `generateDataset` keeps drawing after
 * this runs, so a single draw here would shift every downstream pinned value.
 *
 * Properties are picked by tracked index. The seed is deterministic, so the
 * indices are stable — but a change upstream in `generateDataset`'s draw order
 * would move them, which is why each fixture also *sets* the property's name:
 * tests and demos find a fixture by `PROPERTY_SPACE_FIXTURE_NAMES`, never by
 * index. The tracked indices chosen were verified commercial (retail,
 * hospitality, mixed-use, office); index 8 is Rosa Delgado's building and is
 * left alone.
 */
export type PropertySpaceFixtureRole = 'zeroSpaces' | 'singleOccupied' | 'uniformVacant' | 'density'

export const PROPERTY_SPACE_FIXTURE_NAMES: Record<PropertySpaceFixtureRole, string> = {
  zeroSpaces: 'Grand Suites',
  singleOccupied: 'Shoppes at Crossing',
  uniformVacant: 'The Quarter',
  density: 'Summit Office Park',
}

const TRACKED_INDEX: Record<PropertySpaceFixtureRole, number> = {
  zeroSpaces: 2,
  singleOccupied: 0,
  uniformVacant: 3,
  density: 6,
}

/** Sitting tenants for the density tower, in floor order. Fixed so the roster reads the same every seed. */
const DENSITY_TENANTS = [
  'Northwind Actuarial',
  'Copperline Studio',
  'Bellweather Legal',
  'Halcyon Health Partners',
  'Redoak Capital',
  'Marlowe & Finch',
  'Trellis Software',
  'Pinecrest Insurance',
  'Vantage Recruiting',
  'Sable Point Advisors',
  'Ironbridge Engineering',
  'Lumen Analytics',
  'Greenfield Logistics',
  'Orchard Dental Group',
  'Kestrel Media',
  'Wexford Title',
]

/** Which of the 24 density suites are vacant — scattered so vacancies interleave by floor. */
const DENSITY_VACANT = new Set([2, 5, 9, 12, 14, 18, 21, 23])

/** The seed's own property-type → unit-type mapping (`generateUnits`), restated faker-free. */
function unitTypeFor(propertyType: PropertyType): UnitType {
  if (propertyType === 'multifamily') return 'residential'
  if (propertyType === 'office' || propertyType === 'retail' || propertyType === 'industrial') {
    return propertyType
  }
  return 'other'
}

function unit(
  property: Property,
  role: PropertySpaceFixtureRole,
  n: number,
  fields: Pick<PropertyUnit, 'label' | 'sqft' | 'suite' | 'floor' | 'occupancy' | 'tenantName' | 'leaseExpiration'>,
): PropertyUnit {
  const unitType = unitTypeFor(property.propertyType)
  const commercial = unitType !== 'residential'
  return {
    id: `unit-fx-${role}-${n}`,
    unitType,
    beds: null,
    baths: null,
    ceilingHeight: commercial ? 12 : null,
    offices: commercial ? 2 : null,
    conferenceRooms: commercial ? 1 : null,
    furnished: false,
    saleHistory: [],
    ...fields,
  }
}

function claim(tracked: Property[], role: PropertySpaceFixtureRole): Property | undefined {
  const property = tracked[TRACKED_INDEX[role]]
  if (!property) return undefined
  property.name = PROPERTY_SPACE_FIXTURE_NAMES[role]
  property.slug = PROPERTY_SPACE_FIXTURE_NAMES[role].toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return property
}

export function applyPropertySpaceFixtures(tracked: Property[]): void {
  const zero = claim(tracked, 'zeroSpaces')
  if (zero) zero.units = []

  const single = claim(tracked, 'singleOccupied')
  if (single) {
    single.units = [
      unit(single, 'singleOccupied', 1, {
        label: 'Suite 100',
        suite: '100',
        floor: 1,
        sqft: single.buildingSqFt,
        occupancy: 'occupied',
        tenantName: 'Halvorsen Dental',
        leaseExpiration: isoDate(300),
      }),
    ]
  }

  const vacant = claim(tracked, 'uniformVacant')
  if (vacant) {
    const each = Math.round(vacant.buildingSqFt / 4)
    vacant.units = [1, 2, 3, 4].map((f) =>
      unit(vacant, 'uniformVacant', f, {
        label: `Suite ${f}00`,
        suite: `${f}00`,
        floor: f,
        sqft: f === 4 ? vacant.buildingSqFt - each * 3 : each,
        occupancy: 'vacant',
        tenantName: null,
        leaseExpiration: null,
      }),
    )
  }

  const tower = claim(tracked, 'density')
  if (tower) {
    const each = Math.round(tower.buildingSqFt / 24)
    let tenantIndex = 0
    tower.units = Array.from({ length: 24 }, (_, i) => {
      const floor = Math.floor(i / 4) + 1
      const bay = (i % 4) + 1
      const number = `${floor}0${bay}`
      const isVacant = DENSITY_VACANT.has(i)
      return unit(tower, 'density', i + 1, {
        label: `Suite ${number}`,
        suite: number,
        floor,
        sqft: i === 23 ? tower.buildingSqFt - each * 23 : each,
        occupancy: isVacant ? 'vacant' : 'occupied',
        tenantName: isVacant ? null : DENSITY_TENANTS[tenantIndex++ % DENSITY_TENANTS.length],
        // Expirations fan out across five years so the roster's lease-end column has spread.
        leaseExpiration: isVacant ? null : isoDate(120 + ((i * 97) % 1700)),
      })
    })
    tower.stories = Math.max(tower.stories, 6)
  }
}
