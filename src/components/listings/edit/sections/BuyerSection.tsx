import { SubGroup } from "#/components/listings/edit/FieldGroup";
import {
	SelectField,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import { getStore } from "#/data/store";
import type { DealMarketing, DealType, PropertyStatus } from "#/data/types";

/**
 * Listing page — Buyer. Only meaningful once a Sale deal is Under Contract;
 * the caller (`ListingFormEditor`) gates rendering on
 * `showBuyerSection(dealType, status)`.
 *
 * Emits subgroups only — `ListingFormEditor` owns the group heading.
 */
export function BuyerSection({
	marketing,
	patchMarketing,
}: {
	dealType: DealType;
	status: PropertyStatus;
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
}) {
	const contacts = [...getStore().contacts.values()];
	const contactIds = contacts.map((c) => c.id);
	const contactLabels = Object.fromEntries(
		contacts.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()]),
	);

	return (
		<SubGroup label="Buyer">
			<SelectField
				label="Buyer"
				value={marketing.buyerContactId ?? ""}
				options={["", ...contactIds]}
				labels={{ "": "Select a contact…", ...contactLabels }}
				onChange={(v) => patchMarketing({ buyerContactId: v || null })}
			/>
			<TextField
				label="Referral Source"
				value={marketing.referralSource ?? ""}
				onChange={(v) => patchMarketing({ referralSource: v })}
			/>
		</SubGroup>
	);
}
