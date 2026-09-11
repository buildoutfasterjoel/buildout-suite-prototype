import {
  faFileContract,
  faRulerCombined,
  faUsers,
  faVectorSquare,
} from "@fortawesome/pro-regular-svg-icons";
import type { ReactNode } from "react";
import type { Listing, PropertyUnit } from "#/data/types";
import type { DetailsSection } from "#/components/common/RecordDetails";
import { spaceAvailability } from "#/data/dealShape";
import { formatMonthYear } from "#/components/deals/dealDisplay";
import { formatSqFt } from "./propertyDisplay";
import { formatAskingRent, UNIT_TYPE_LABELS } from "./propertySpaceDisplay";

const num = (n: number | null | undefined) => (n == null ? null : String(n));

/** The unit's own facts, in the same Buildout-style groups the property page uses. */
export function spaceDetailsSections(u: PropertyUnit): DetailsSection[] {
  return [
    {
      key: "space",
      title: "Space",
      icon: faVectorSquare,
      rows: [
        { label: "Label", value: u.label },
        { label: "Suite", value: u.suite },
        { label: "Floor", value: num(u.floor) },
        { label: "Type", value: UNIT_TYPE_LABELS[u.unitType] },
        { label: "Size", value: u.sqft > 0 ? formatSqFt(u.sqft) : null },
      ],
    },
    {
      key: "build-out",
      title: "Build-out",
      icon: faRulerCombined,
      rows: [
        { label: "Ceiling Height", value: u.ceilingHeight == null ? null : `${u.ceilingHeight} ft` },
        { label: "Offices", value: num(u.offices) },
        { label: "Conference Rooms", value: num(u.conferenceRooms) },
        { label: "Furnished", value: u.furnished ? "Yes" : "No" },
        { label: "Bedrooms", value: num(u.beds) },
        { label: "Bathrooms", value: num(u.baths) },
      ],
    },
    {
      key: "occupancy",
      title: "Occupancy",
      icon: faUsers,
      rows: [
        { label: "Occupancy", value: u.occupancy === "occupied" ? "Occupied" : "Vacant" },
        { label: "Tenant", value: u.tenantName },
        { label: "Lease Expires", value: u.leaseExpiration ? formatMonthYear(u.leaseExpiration) : null },
      ],
    },
  ];
}

/**
 * The commercial terms on the space's deal, **read-only** — these are the deal's
 * facts (spec §2.1) and the deal's Details form is their one editable home. The
 * caller passes the "Edit on deal" link as the section's action.
 */
export function spaceLeaseTermsSection(deal: Listing, action?: ReactNode): DetailsSection {
  const t = deal.marketing.spaceLeaseTerms?.[0];
  return {
    key: "lease-terms",
    title: "Lease Terms",
    icon: faFileContract,
    action,
    rows: [
      { label: "Availability", value: spaceAvailability(deal.status) },
      { label: "Asking Rent", value: t ? formatAskingRent(t.leaseRate, t.leaseRateUnits) : null },
      {
        label: "Available SF",
        value: deal.marketing.availableSqFt > 0 ? formatSqFt(deal.marketing.availableSqFt) : null,
      },
      { label: "Lease Term", value: t?.leaseTermMonths ? `${t.leaseTermMonths} months` : null },
      { label: "Min Divisible", value: t?.minDivisibleSqFt ? formatSqFt(t.minDivisibleSqFt) : null },
      { label: "Max Contiguous", value: t?.maxContiguousSqFt ? formatSqFt(t.maxContiguousSqFt) : null },
      { label: "Date Available", value: t?.dateAvailable ? formatMonthYear(t.dateAvailable) : null },
      { label: "Marketed Tenant Name", value: t?.tenantName?.trim() || null },
    ],
  };
}
