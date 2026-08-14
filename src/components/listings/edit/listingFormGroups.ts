import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faLocationDot,
  faBuilding,
  faTableCells,
  faMap,
  faLayerGroup,
  faNoteSticky,
  faSignPosts,
} from "@fortawesome/pro-regular-svg-icons";
import { propertyTypeEffects } from "#/data/listingFormLogic";
import type { DealType, PropertyType } from "#/data/types";

export type ListingGroupId =
  | "location"
  | "asset"
  | "units"
  | "lots"
  | "condos"
  | "marketing"
  | "notes";

export type ListingGroup = {
  id: ListingGroupId;
  label: string;
  icon: IconDefinition;
};

/** Every group the Listing form can show, in display order. */
const ALL_GROUPS: ListingGroup[] = [
  { id: "location", label: "Location", icon: faLocationDot },
  { id: "asset", label: "The Asset", icon: faBuilding },
  { id: "units", label: "Units", icon: faTableCells },
  { id: "lots", label: "Lots", icon: faMap },
  { id: "condos", label: "Condos", icon: faLayerGroup },
  { id: "marketing", label: "Marketing", icon: faSignPosts },
  { id: "notes", label: "Disclaimer & Notes", icon: faNoteSticky },
];

/** Whether the Land subgroup renders inside The Asset. */
export function showsLandSubgroup(propertyType: PropertyType): boolean {
  return propertyTypeEffects(propertyType).landSections;
}

/**
 * The groups this listing actually shows. Lives beside the group list so a rule
 * and the group it governs cannot drift apart, and so the rules are testable
 * without rendering a form — the same split `visibleNavGroups` uses in
 * `properties/dealNav.ts`.
 *
 * `units` is unconditional, matching the previous form: `UnitsSection` renders
 * its own Include/Syndicate switches whether or not a unit mix exists, so
 * gating it here would remove the only way to turn one on.
 */
export function visibleListingGroups(opts: {
  dealType: DealType;
  propertyType: PropertyType;
}): ListingGroup[] {
  return ALL_GROUPS.filter((group) => {
    if (group.id === "lots") return showsLandSubgroup(opts.propertyType);
    if (group.id === "condos") return opts.dealType === "Sale";
    return true;
  });
}
