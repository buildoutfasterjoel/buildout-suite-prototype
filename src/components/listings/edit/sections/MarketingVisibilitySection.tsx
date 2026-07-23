import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { faEye } from "@fortawesome/pro-regular-svg-icons";
import { SwitchRow } from "#/components/listings/edit/fieldWidgets";
import { Section } from "#/components/listings/listingWidgets";
import { leaseChannelsFor, saleChannelsFor } from "#/data/listingFormLogic";
import type {
	DealMarketing,
	DealType,
	MarketingChannel,
	PropertyStatus,
} from "#/data/types";

const DISCONNECT_CHANNELS: MarketingChannel[] = [
	"Buildout Syndication Network",
	"Buildout Buyer Network",
];

/**
 * Listing tab — Marketing Visibility. Status-gated channel picker (Sale reads/
 * writes `saleMarketingChannel`, Lease reads/writes `leaseMarketingChannel`),
 * mirrored into the legacy `marketingChannel` field on every change so older
 * readers of that field keep working. Always rendered — the channel options
 * available simply narrow as `status` moves along the deal lifecycle.
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
	const channels =
		dealType === "Sale" ? saleChannelsFor(status) : leaseChannelsFor(status);
	const current =
		(dealType === "Sale"
			? marketing.saleMarketingChannel
			: marketing.leaseMarketingChannel) ?? "None";

	const pick = (c: MarketingChannel) =>
		patchMarketing(
			dealType === "Sale"
				? { saleMarketingChannel: c, marketingChannel: c }
				: { leaseMarketingChannel: c, marketingChannel: c },
		);

	const showDisconnectWarning = DISCONNECT_CHANNELS.includes(current);

	return (
		<Section title="Marketing Visibility" icon={faEye}>
			<div className="d-flex flex-column gap-2">
				<div className="d-flex flex-wrap gap-2">
					{channels.map((c) => (
						<Button
							key={c}
							type="button"
							variant={c === current ? "primary" : "outline"}
							size="sm"
							onClick={() => pick(c)}
						>
							{c}
						</Button>
					))}
				</div>
				{dealType === "Sale" && (
					<p className="text-muted mb-0" style={{ fontSize: 13 }}>
						Investment Type becomes required when "Buildout Buyer Network" is
						selected.
					</p>
				)}
				{showDisconnectWarning && (
					<p className="text-danger mb-0" style={{ fontSize: 13 }}>
						Changing away from this channel will disconnect the listing from the
						network it currently syndicates to.
					</p>
				)}
			</div>

			<div style={{ maxWidth: 360 }}>
				<SwitchRow
					label="Hide from Non-Listing Brokers"
					checked={marketing.hideFromNonListingBrokers ?? false}
					onChange={(v) => patchMarketing({ hideFromNonListingBrokers: v })}
				/>
			</div>
		</Section>
	);
}
