import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
	faCircle,
	faCircleDot,
	faCircleHalfStroke,
	faEarthAmericas,
	faEyeSlash,
	faGlobe,
	faTowerBroadcast,
} from "@fortawesome/pro-regular-svg-icons";
import { SubGroup } from "#/components/listings/edit/FieldGroup";
import { SwitchRow } from "#/components/listings/edit/fieldWidgets";
import { channelsFor } from "#/data/listingFormLogic";
import type {
	DealMarketing,
	DealType,
	MarketingChannel,
	PropertyStatus,
	VisibilityTier,
} from "#/data/types";

const DISCONNECT_CHANNELS: MarketingChannel[] = ["Buildout Syndication Network"];

/** A marketing channel implies a fixed visibility tier (per the PRD) — there is
 * no separate Visibility Tier control; picking a channel derives it. */
const TIER_FOR_CHANNEL: Record<MarketingChannel, VisibilityTier> = {
	None: "Fully Private",
	"My Brokerage Website": "Semi-Public",
	"Buildout Syndication Network": "Fully Public",
};

/**
 * How far each tier reaches, drawn as a filling circle: empty for fully
 * private, half for private, filled for semi-public, a globe for fully public.
 * The badge is a readout of the chosen channel, never its own control — the
 * tier is derived, so there is nothing here to click.
 */
const TIER_ICON: Record<VisibilityTier, IconDefinition> = {
	"Fully Private": faCircle,
	// No channel maps to Private now that Buyer Network is gone, but the tier is
	// still in the `VisibilityTier` union, so the map has to stay total.
	Private: faCircleHalfStroke,
	"Semi-Public": faCircleDot,
	"Fully Public": faEarthAmericas,
};

/** What each channel does, in the broker's own terms rather than the system's. */
const CHANNEL_COPY: Record<
	MarketingChannel,
	{ icon: IconDefinition; description: string }
> = {
	None: {
		icon: faEyeSlash,
		description:
			"I want to market directly to my own contacts (network) or nowhere at this time.",
	},
	"My Brokerage Website": {
		icon: faGlobe,
		description:
			"I want to increase exposure and market on my company's website using the Buildout plugin.",
	},
	"Buildout Syndication Network": {
		icon: faTowerBroadcast,
		description:
			"I want to maximize exposure to all parties via Buildout's available sale listing sites.",
	},
};

/**
 * Listing page — Marketing Channels. Sale reads/writes `saleMarketingChannel`,
 * Lease reads/writes `leaseMarketingChannel`, and both mirror into the legacy
 * `marketingChannel` field on every change so older readers keep working.
 *
 * Every channel is offered while a deal is still in play, because setup happens
 * before a deal goes active and that is when a broker decides where the listing
 * should go once it is live. Closed and Lost collapse to None — see
 * `channelsFor`.
 *
 * The choice is a row of cards rather than a row of buttons. Four channels that
 * each need a sentence of explanation and carry a different privacy consequence
 * are not a toggle: the old pills named the channels but said nothing about what
 * picking one would do, and the tier they imply was invisible until saved.
 *
 * Built on `RadioGroup` (same pattern as `AssignRolesPanel`) so this stays one
 * choice out of N to a screen reader and to the keyboard, with the card doing
 * the drawing. The radio itself is hidden — the mock marks selection with the
 * accent alone — so the card carries a `:focus-within` ring instead, or keyboard
 * focus would land somewhere invisible.
 *
 * Emits subgroups only — `ListingFormEditor` owns the group heading.
 */
export function MarketingVisibilitySection({
	dealType,
	status,
	marketing,
	patchMarketing,
}: {
	dealType: DealType;
	status: PropertyStatus;
	marketing: DealMarketing;
	patchMarketing: (p: Partial<DealMarketing>) => void;
}) {
	const channels = channelsFor(status);
	const current =
		(dealType === "Sale"
			? marketing.saleMarketingChannel
			: marketing.leaseMarketingChannel) ??
		marketing.marketingChannel ??
		"None";

	const pick = (c: MarketingChannel) =>
		patchMarketing(
			dealType === "Sale"
				? {
						saleMarketingChannel: c,
						marketingChannel: c,
						visibilityTier: TIER_FOR_CHANNEL[c],
					}
				: {
						leaseMarketingChannel: c,
						marketingChannel: c,
						visibilityTier: TIER_FOR_CHANNEL[c],
					},
		);

	const showDisconnectWarning = DISCONNECT_CHANNELS.includes(current);

	return (
		<SubGroup label="Channels">
			<RadioGroup
				value={current}
				onValueChange={(v) => v && pick(v as MarketingChannel)}
				className="d-flex flex-column gap-2"
			>
				{channels.map((c) => {
					const checked = c === current;
					const tier = TIER_FOR_CHANNEL[c];
					const { icon, description } = CHANNEL_COPY[c];
					return (
						// eslint-disable-next-line jsx-a11y/label-has-associated-control
						<label
							key={c}
							className={`listing-form__channel-card bg-card d-flex align-items-center gap-3 border rounded p-3 ${
								checked ? "listing-form__channel-card--selected" : ""
							}`}
						>
							<RadioGroup.Item value={c} className="visually-hidden" />
							<span
								className={`listing-form__channel-icon d-flex align-items-center justify-content-center rounded flex-shrink-0 ${
									checked ? "listing-form__channel-icon--selected" : "text-body-secondary"
								}`}
							>
								<FontAwesomeIcon icon={icon} />
							</span>
							<span className="flex-grow-1" style={{ minWidth: 0 }}>
								<span className="d-block fw-semibold">{c}</span>
								<span className="d-block text-muted fs-small">
									{description}
								</span>
							</span>
							<span className="d-flex align-items-center gap-2 flex-shrink-0 fs-small text-body-secondary">
								<FontAwesomeIcon icon={TIER_ICON[tier]} />
								{tier}
							</span>
						</label>
					);
				})}
			</RadioGroup>

			{showDisconnectWarning && (
				<p className="text-danger fs-small mb-0">
					Changing away from this channel will disconnect the listing from the
					network it currently syndicates to.
				</p>
			)}

			<SwitchRow
				label="Hide from Non-Listing Brokers"
				checked={marketing.hideFromNonListingBrokers ?? false}
				onChange={(v) => patchMarketing({ hideFromNonListingBrokers: v })}
			/>
		</SubGroup>
	);
}
