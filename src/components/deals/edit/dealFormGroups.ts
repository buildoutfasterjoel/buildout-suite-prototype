import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
	faGear,
	faFileContract,
	faChartLine,
} from "@fortawesome/pro-regular-svg-icons";
import type { DealShape } from "#/data/dealShape";

export type DealGroupId = "setup" | "terms" | "financials";

export type DealGroup = {
	id: DealGroupId;
	label: string;
	icon: IconDefinition;
};

/** Every group the Deal form can show, in display order. */
const ALL_GROUPS: DealGroup[] = [
	{ id: "setup", label: "Setup & Status", icon: faGear },
	{ id: "terms", label: "Transaction Terms", icon: faFileContract },
	{ id: "financials", label: "Financials", icon: faChartLine },
];

/**
 * The groups this deal actually shows. Lives beside the group list so a rule and
 * the group it governs cannot drift apart, and so the rules are testable without
 * rendering a form — the same split `visibleListingGroups` uses.
 *
 * `shape` alone decides both rules, which is why it is the only argument:
 * `dealShape` returns "sale" for exactly the listings whose `dealType` is not
 * "Lease", so the old `isSale = dealType !== "Lease"` test and `shape === "sale"`
 * select the same deals. A shell shows neither Terms nor Financials — its spaces
 * carry the transactions, so it has no price, no commission, and nothing to
 * close.
 */
export function visibleDealGroups(shape: DealShape): DealGroup[] {
	return ALL_GROUPS.filter((group) => {
		if (group.id === "terms") return shape !== "shell";
		if (group.id === "financials") return shape === "sale";
		return true;
	});
}
