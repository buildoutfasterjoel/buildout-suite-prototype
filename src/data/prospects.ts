import { faker } from '@faker-js/faker'
import type { Property } from './types'
import { generateProperty } from './seed'

/**
 * Buildout Insights prospecting records.
 *
 * A prospect is a property record aggregated from public data that *isn't* in
 * your company's database yet. Modeled as a full `Property` rather than a
 * thinner shape, because the whole point of the flow is that adding one is a
 * plain `addProperty(record)` — the record you were looking at becomes the
 * record you own, same id, same fields, no conversion step.
 *
 * They live in a module cache rather than the store: they aren't yours until
 * you add them, so they must not be persisted, must not show up in Deals or
 * search, and must not move `SEED_VERSION`.
 */

/** Distinct from the dataset seed so prospect records never mirror your book. */
const PROSPECT_SEED = 90210773
const PROSPECT_COUNT = 140

let cache: Property[] | null = null

export function getProspectProperties(): Property[] {
  if (cache) return cache
  // Re-seeding the module-global faker is safe in both orders: `generateDataset`
  // opens with its own `faker.seed(SEED)`, so it can't inherit this stream, and
  // nothing else calls faker at runtime.
  faker.seed(PROSPECT_SEED)
  // `generateProperty` leaves `status` null, which is exactly right here: a
  // prospect has no deal, and adding one to your database doesn't create a
  // deal — it just files the record.
  cache = Array.from({ length: PROSPECT_COUNT }, () => generateProperty())
  return cache
}

/**
 * The headline count Insights advertises — the national record set behind the
 * filters, not the page of results. Fixed so it reads like a database size.
 */
export const INSIGHTS_RECORD_TOTAL = 154_004_938
