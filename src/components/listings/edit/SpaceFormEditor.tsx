import {
	faFileInvoiceDollar,
	faFileSignature,
	faVectorSquare,
} from "@fortawesome/pro-regular-svg-icons";
import { FieldGroup } from "#/components/common/recordForm/FieldGroup";
import { SpaceExpensesSection } from "#/components/listings/edit/sections/SpaceExpensesSection";
import { SpaceIdentitySection } from "#/components/listings/edit/sections/SpaceIdentitySection";
import { SpaceLeaseTermsSection } from "#/components/listings/edit/sections/SpaceLeaseTermsSection";
import type { Property, SpaceLeaseTerms } from "#/data/types";

/**
 * The space Details page's form body: The Space, Lease Terms, Expenses.
 *
 * The same shell the Listing and Deal forms use — a group is an icon and a title
 * over a stack of cluster tiles, and each group's long tail is a collapsed
 * disclosure at the end of it. This replaced one flat run of ~60 fields whose
 * only structure was comment dividers, plus a single "Show/Hide Additional
 * Fields" accordion holding 25 unrelated ones.
 *
 * Three groups, not the Listing form's seven, because a space answers three
 * questions and no more: what the suite is, what it leases for, and what the
 * tenant pays on top. No `spaceFormGroups` module to go with them — the Listing
 * form has one because its group visibility turns on deal type and property
 * type and those rules are worth testing without rendering; every group here is
 * unconditional, and only the Industrial *cluster* varies.
 *
 * Receives the working copy and its patcher, so it never owns state of its own —
 * `SpaceDetails` holds the draft and the Save contract.
 */
export function SpaceFormEditor({
	property,
	terms,
	onChange,
	availableSqFt,
	onAvailableSqFtChange,
}: {
	property: Property;
	terms: SpaceLeaseTerms;
	onChange: (patch: Partial<SpaceLeaseTerms>) => void;
	/** The space's size, from `marketing.availableSqFt` on its deal. */
	availableSqFt: number | null;
	onAvailableSqFtChange: (value: number | null) => void;
}) {
	// `gap-6` (24px) — the group tier, matching ListingFormEditor and DealEditor.
	return (
		<div className="d-flex flex-column gap-6">
			<FieldGroup title="The Space" icon={faVectorSquare}>
				<SpaceIdentitySection
					property={property}
					terms={terms}
					onChange={onChange}
					availableSqFt={availableSqFt}
					onAvailableSqFtChange={onAvailableSqFtChange}
				/>
			</FieldGroup>

			<FieldGroup title="Lease Terms" icon={faFileSignature}>
				<SpaceLeaseTermsSection terms={terms} onChange={onChange} />
			</FieldGroup>

			<FieldGroup title="Expenses" icon={faFileInvoiceDollar}>
				<SpaceExpensesSection terms={terms} onChange={onChange} />
			</FieldGroup>
		</div>
	);
}
