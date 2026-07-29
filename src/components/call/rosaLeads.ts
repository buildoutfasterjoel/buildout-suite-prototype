import type { Contact, ContactSource } from "#/data/types";
import { getContact, getListingsForProperty } from "#/data/store";
import { createContact } from "#/data/actions";
import { SIM_LEAD_ID_PREFIX } from "#/data/dataStore";
import { notify } from "#/lib/notify";

/**
 * The beat after Rosa's listing goes live: the market answers.
 *
 * Activating the Delgado Building deal drops three inbound buyers onto its
 * Leads list — which is also what makes the deal card's "Leads" quick link
 * appear on Rosa's contact page. From there the broker calls the list; the
 * **last** lead (`DELGADO_BUYER_LEAD_ID`) is the eventual buyer, and logging
 * his call arms the LOI email (see rosaLoi.ts).
 *
 * The ids are stable rather than generated so the beat is idempotent on replay,
 * and they carry `SIM_LEAD_ID_PREFIX` so `resetRosaDemoState` clears the leads
 * out of the book on a hard refresh.
 */

interface LeadFixture {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  source: ContactSource;
  notes: string;
  tags: string[];
  /**
   * The inquiry that put them in the book, in their own voice — this is the row
   * that opens their timeline, so it's where each lead's character (and, for the
   * buyer, the LOI that follows) is set up.
   */
  inquiry: { message: string; channel: string };
}

/**
 * Order matters — the Leads table lists them in this order, and the run down
 * the list ends on the buyer.
 */
export const DELGADO_LEAD_FIXTURES: LeadFixture[] = [
  {
    id: `${SIM_LEAD_ID_PREFIX}delgado-boyle`,
    firstName: "Curtis",
    lastName: "Boyle",
    company: "Boyle Capital Group",
    title: "Acquisitions Director",
    email: "curtis.boyle@boylecapital.com",
    phone: "(312) 555-0184",
    source: "Manual entry",
    notes:
      "Syndicator raising a value-add fund. Came in off the listing website and wants the full T-12 before he will talk price.",
    tags: ["Investor"],
    inquiry: {
      channel: "Buildout site",
      message:
        "Saw this go live. We're deploying a value-add fund and 48 units is right in our range. Send the OM and the trailing twelve — I don't price off stated occupancy.",
    },
  },
  {
    id: `${SIM_LEAD_ID_PREFIX}delgado-whitfield`,
    firstName: "Dana",
    lastName: "Whitfield",
    company: "Northline Equity Partners",
    title: "Principal",
    email: "dana.whitfield@northlineequity.com",
    phone: "(312) 555-0219",
    source: "Referral",
    notes:
      "1031 buyer on a 45-day identification clock. Moves fast, but trades price for certainty — and wants a rate-lock contingency.",
    tags: ["Investor", "1031"],
    inquiry: {
      channel: "LoopNet",
      message:
        "I'm in a 1031 with 45 days left to identify, so I'll be quick either way. Need the rent roll and whether your seller would carry a rate-lock contingency. I pay for certainty, not for a discount.",
    },
  },
  {
    id: `${SIM_LEAD_ID_PREFIX}delgado-trejo`,
    firstName: "Marcus",
    lastName: "Trejo",
    company: "Trejo Residential Group",
    title: "Managing Partner",
    email: "marcus@trejoresidential.com",
    phone: "(312) 555-0257",
    source: "Manual entry",
    notes:
      "Local operator — owns four workforce buildings within a mile and buys to hold. The kind of buyer Rosa asked for.",
    tags: ["Local", "Operator"],
    inquiry: {
      channel: "Buildout site",
      message:
        "I own four buildings within a mile of this one. I don't need the marketing package — I need to know what the owner actually wants, and whether they care who ends up with it. Call me any time.",
    },
  },
];

/** Every scripted Delgado lead id, for reset and membership checks. */
export const DELGADO_LEAD_IDS = DELGADO_LEAD_FIXTURES.map((l) => l.id);

/**
 * The last lead in the list — the eventual buyer. Logging his call is what
 * arms the LOI email.
 */
export const DELGADO_BUYER_LEAD_ID =
  DELGADO_LEAD_FIXTURES[DELGADO_LEAD_FIXTURES.length - 1].id;

/**
 * Land the three inbound leads on the property, linked so the deal's Leads tab
 * (and the deal card's Leads quick link) picks them up. Each one carries an
 * inquiry on the deal, which is what puts an "Inquired about The Delgado
 * Building" row — linked to the deal — at the top of their timeline; they are in
 * the book *because* they inquired. Idempotent: leads that already exist are
 * left alone, and a fully-seeded property is a no-op — so the activation watcher
 * can fire more than once without stacking duplicates.
 *
 * Returns the leads created by *this* call (empty when nothing was needed).
 */
export function seedDelgadoLeads(propertyId: string): Contact[] {
  const deal = getListingsForProperty(propertyId)[0];
  const created: Contact[] = [];
  for (const fixture of DELGADO_LEAD_FIXTURES) {
    if (getContact(fixture.id)) continue;
    const { contact } = createContact({
      id: fixture.id,
      firstName: fixture.firstName,
      lastName: fixture.lastName,
      company: fixture.company,
      title: fixture.title,
      email: fixture.email,
      phone: fixture.phone,
      // They're buying, not selling — the seller side is Rosa's.
      role: "buyer",
      propertyIds: [propertyId],
      inquiredListingIds: deal ? [deal.id] : undefined,
      inquiryDetails: deal
        ? { [deal.id]: { ...fixture.inquiry, date: new Date().toISOString() } }
        : undefined,
      source: fixture.source,
      notes: fixture.notes,
      tags: fixture.tags,
    });
    created.push(contact);
  }
  return created;
}

/**
 * Seed the leads for a deal that just went live and report it. Called by
 * `RosaLeadsWatcher` when the deal on Rosa's building commits to Active.
 */
export function onDelgadoDealActivated(propertyId: string): Contact[] {
  const created = seedDelgadoLeads(propertyId);
  if (created.length === 0) return created;
  const deal = getListingsForProperty(propertyId)[0];
  notify({
    title: `${created.length} new leads`,
    description: deal
      ? `${deal.name} — inbound since the listing went live.`
      : "Inbound since the listing went live.",
  });
  return created;
}
