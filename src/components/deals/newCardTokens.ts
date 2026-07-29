import {
  faUser,
  faUserQuestion,
  faSignHanging,
  faDollarSign,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { Contact, DealSide, DealType, Listing, PropertyStatus } from "#/data/types";

/**
 * Palettes for the redesigned deal / property cards (Figma "deal-tile" set).
 *
 * These are hex values of Blueprint family tokens, matching how
 * `STAGE_CHIP_COLORS` already records the current chip palette — the theme
 * doesn't expose these families as CSS custom properties, so the token name
 * rides along in a comment on each entry.
 */

/** The solid dot in the new stage chip — `circle-small`, one shade per stage. */
export const STAGE_DOT: Record<PropertyStatus, string> = {
  proposal: "#fd9a00", // harvest-gold/500
  active: "#3f86f2", // buildout-blue/500
  "under-contract": "#9f55f7", // purple-heart/500
  closed: "#00bc7d", // mountain-meadow/500
  inactive: "#62748e", // storm-grey/500
};

/**
 * The link glyph on the property card's "Deal" badge, per the deal's stage.
 * Pitching sits a shade darker than its chip dot (harvest-gold/600 vs /500) so
 * the small 10px glyph still reads against the badge's white fill.
 */
export const LINKED_DEAL_ICON: Record<PropertyStatus, string> = {
  proposal: "#e27400", // harvest-gold/600
  active: "#3f86f2", // buildout-blue/500
  "under-contract": "#9f55f7", // purple-heart/500
  closed: "#00bc7d", // mountain-meadow/500
  inactive: "#62748e", // storm-grey/500
};

/**
 * Which side of the table the broker is on. A Sale reads Seller/Buyer and a
 * Lease reads Landlord/Tenant — the same mapping the board card already uses —
 * and the palette splits by side, not by deal type: representing the supply
 * side is seagull, the demand side mountain-meadow.
 */
const SIDE_PALETTE: Record<
  DealSide,
  {
    bg: string;
    color: string;
    icon: IconDefinition;
    Sale: { label: string; tooltip: string };
    Lease: { label: string; tooltip: string };
  }
> = {
  seller: {
    bg: "#cefaff", // seagull/100
    color: "#063346", // seagull/950
    icon: faSignHanging,
    Sale: { label: "Seller", tooltip: "Seller rep - take property to market" },
    Lease: { label: "Landlord", tooltip: "Landlord rep - lease space to tenants" },
  },
  buyer: {
    bg: "#cdfee5", // mountain-meadow/100
    color: "#003024", // mountain-meadow/950
    icon: faDollarSign,
    Sale: { label: "Buyer", tooltip: "Buyer rep - find a property to buy" },
    Lease: { label: "Tenant", tooltip: "Tenant rep - find space to lease" },
  },
};

export interface SideBadgeSpec {
  label: string;
  /** Spells out what representing this side actually means on this deal type. */
  tooltip: string;
  bg: string;
  color: string;
  icon: IconDefinition;
}

export function sideBadge(side: DealSide, dealType: DealType): SideBadgeSpec {
  const p = SIDE_PALETTE[side];
  return {
    label: p[dealType].label,
    tooltip: p[dealType].tooltip,
    bg: p.bg,
    color: p.color,
    icon: p.icon,
  };
}

/**
 * How the contact whose page we're on relates to this deal. `inquired` is the
 * weak connection — they're on the deal's Leads list rather than a named party —
 * and it's the one case that reads as a filled primary badge, because it's the
 * one that means "not yours yet".
 */
export type DealRelationship = "owner" | "buyer" | "tenant" | "inquired";

export interface RelationshipBadgeSpec {
  label: string;
  bg: string;
  color: string;
  icon: IconDefinition;
}

const RELATIONSHIP_BADGE: Record<DealRelationship, RelationshipBadgeSpec> = {
  // badge/muted/secondary — the settled, "this is your party" look.
  owner: { label: "Owner", bg: "#eceef2", color: "#22262f", icon: faUser },
  buyer: { label: "Buyer", bg: "#eceef2", color: "#22262f", icon: faUser },
  tenant: { label: "Tenant", bg: "#eceef2", color: "#22262f", icon: faUser },
  // badge/muted/primary — filled, so an unworked inquiry stands out in a stack.
  inquired: {
    label: "Inquired",
    bg: "#62748e", // badge/muted/primary/bg
    color: "#f6f7f9", // badge/muted/primary/color
    icon: faUserQuestion,
  },
};

export function relationshipBadge(r: DealRelationship): RelationshipBadgeSpec {
  return RELATIONSHIP_BADGE[r];
}

/**
 * Derive the contact's relationship to a deal from the deal graph. A named
 * seller on a property they're linked to is its owner; a named buyer/tenant is
 * that; anyone else showing on this card got here through an inquiry.
 */
export function dealRelationshipFor(
  contact: Contact,
  listing: Listing,
): DealRelationship {
  if (listing.sellerContactIds.includes(contact.id)) return "owner";
  if (listing.tenantContactIds.includes(contact.id)) return "tenant";
  if (listing.buyerContactIds.includes(contact.id)) return "buyer";
  return "inquired";
}

/** The tooltip on the relationship badge — says why this card is on this page. */
export function relationshipTooltip(
  r: DealRelationship,
  name: string,
  inquiredOn: string | null,
): string {
  switch (r) {
    case "owner":
      return `${name} owns the property`;
    case "buyer":
      return `${name} is the buyer on this deal`;
    case "tenant":
      return `${name} is the tenant on this deal`;
    case "inquired":
      return inquiredOn
        ? `${name} inquired on ${inquiredOn}`
        : `${name} inquired on this listing`;
  }
}
