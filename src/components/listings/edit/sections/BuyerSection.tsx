import { faHandshake } from "@fortawesome/pro-regular-svg-icons";
import {
	SelectField,
	TextField,
} from "#/components/listings/edit/fieldWidgets";
import { Section } from "#/components/listings/listingWidgets";
import { getStore } from "#/data/store";
import type { DealMarketing, DealType, PropertyStatus } from "#/data/types";

/**
 * Listing tab — Buyer. Only meaningful once a Sale deal is Under Contract;
 * the caller (`ListingFormEditor`) gates rendering (and its preceding
 * `<Separator/>`) on `showBuyerSection(dealType, status)` so there's never an
 * orphan separator when this section is hidden.
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
		<Section title="Buyer" icon={faHandshake}>
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
		</Section>
	);
}
