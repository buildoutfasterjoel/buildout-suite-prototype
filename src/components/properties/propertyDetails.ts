import {
  faBuilding,
  faCircleDollar,
  faCube,
  faLocationDot,
  faSignHanging,
  faUsers,
} from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import type { DetailsSection } from "#/components/common/RecordDetails";
import { formatPrice, formatPct, formatSqFt, STATUS_LABELS, TYPE_LABELS } from "./propertyDisplay";

const num = (n: number | null | undefined) => (n == null || n === 0 ? null : String(n));
const money = (n: number | null | undefined) => (n == null || n === 0 ? null : formatPrice(n));
const sqft = (n: number | null | undefined) => (n == null || n === 0 ? null : formatSqFt(n));

/**
 * The property's facts in Buildout's own groups — Property Overview, Location,
 * Listing Status, Building Attributes, Occupancy, Financials — and its row
 * order, so a broker who knows the product's property page reads this one
 * without relearning where anything is. Empty values stay as rows (`--`).
 */
export function propertyDetailsSections(p: Property): DetailsSection[] {
  return [
    {
      key: "overview",
      title: "Property Overview",
      icon: faCube,
      rows: [
        { label: "Property Type", value: TYPE_LABELS[p.propertyType] },
        { label: "Property Subtype", value: p.propertySubtype },
        { label: "Property Name", value: p.name },
        { label: "Year Built", value: num(p.yearBuilt) },
        { label: "Year Last Renovated", value: num(p.yearRenovated) },
        { label: "Lot Size", value: sqft(p.lotSqFt) },
      ],
    },
    {
      key: "location",
      title: "Location",
      icon: faLocationDot,
      rows: [
        { label: "Address", value: p.street },
        { label: "City", value: p.city },
        { label: "State", value: p.state },
        { label: "County", value: p.county },
        { label: "Zip", value: p.zip },
        { label: "Submarket", value: p.submarket },
        { label: "Zoning", value: p.zoning },
        { label: "APN", value: p.apn },
      ],
    },
    {
      key: "listing-status",
      title: "Listing Status",
      icon: faSignHanging,
      rows: [{ label: "Status", value: p.status ? STATUS_LABELS[p.status] : null }],
    },
    {
      key: "building",
      title: "Building Attributes",
      icon: faBuilding,
      rows: [
        { label: "Building Size", value: sqft(p.buildingSqFt) },
        { label: "Building Class", value: p.buildingClass },
        { label: "Stories", value: num(p.stories) },
        { label: "Number of Buildings", value: num(p.numberOfBuildings) },
        { label: "Number of Units", value: num(p.residentialUnits ?? p.units.length) },
        { label: "Parking Spaces", value: num(p.parkingSpaces) },
      ],
    },
    {
      key: "occupancy",
      title: "Occupancy",
      icon: faUsers,
      rows: [{ label: "Occupancy %", value: p.occupancyPct > 0 ? `${p.occupancyPct}%` : null }],
    },
    {
      key: "financials",
      title: "Financials",
      icon: faCircleDollar,
      rows: [
        { label: "Asking Price", value: money(p.askingPrice) },
        { label: "Assessed Value", value: money(p.assessedTaxValue) },
        { label: "NOI", value: money(p.noi) },
        // Stored as a fraction (0.061), shown as a percent — the prospect flyout's convention.
        { label: "Cap Rate", value: p.capRate > 0 ? formatPct(p.capRate * 100) : null },
        { label: "Tax Amount", value: money(p.taxAmount) },
        { label: "Tax Year", value: num(p.taxYear) },
      ],
    },
  ];
}
