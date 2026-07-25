import type { Contact, Listing, Property } from "#/data/types";
import { createDeal } from "#/data/actions";
import { emptyDraft } from "#/data/createListing";
import { ROSA_FINANCIAL_DOCS } from "./rosaDocs";

/**
 * The "AI scanned the docs" payoff: create the deal the progress modal was
 * reading toward. Opens on the owner's building at `proposal`, prefilled from
 * the property record and carrying the T-12 + rent roll as documents (the same
 * files Rosa emailed), so the story stays consistent from email → deal.
 */
export function createRosaProposalDeal(
  contact: Contact,
  property: Property,
): { deal: Listing } {
  return createDeal({
    ...emptyDraft(),
    name: property.name,
    address: [property.street, property.city, property.state]
      .filter(Boolean)
      .join(", "),
    propertyId: property.id,
    propertyType: property.propertyType,
    dealType: "Sale",
    listingPrice: property.askingPrice,
    commissionPct: 5,
    availableSqFt: property.buildingSqFt,
    description: `Sale of ${property.name}, underwritten from the owner's T12 and rent roll.`,
    dealSide: "seller",
    sellerContactId: contact.id,
    initialStage: "proposal",
    documents: ROSA_FINANCIAL_DOCS.map(({ name, size }) => ({
      id: crypto.randomUUID(),
      name,
      size,
      uploadedAt: new Date().toISOString(),
    })),
  });
}
