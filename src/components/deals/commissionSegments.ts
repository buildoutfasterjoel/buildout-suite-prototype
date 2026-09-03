import type { DealBroker } from "#/data/types";

/**
 * Breakdown chart colors — Blueprint token steps, in the fixed order the donut
 * draws them. Validated as a categorical palette (lightness band, chroma floor,
 * adjacent-pair separation under normal and CVD vision); re-run that check
 * before changing a value or reordering the slices.
 *
 * The two amounts that come off the top before the house splits anything share
 * the purple family, which is what makes them read as one group above the
 * brokers. The blue that used to carry the co-broke now belongs to the first
 * internal broker, since the named slices are what the eye is counting.
 */
export const DEDUCTIONS_COLOR = "#8833ea"; // purple-heart-600
export const OUTSIDE_COLOR = "#b885fa"; // purple-heart-400
export const UNALLOCATED_COLOR = "#e27400"; // harvest-gold-600

/**
 * One hue per internal broker, taken in list order — never cycled. A fourth
 * broker does not get a generated color; they fold into a single grey Other
 * row, because a donut whose slices repeat a hue lies about which slice is
 * whose.
 */
const INTERNAL_COLORS = ["#2968e7", "#00b8d9", "#00845b"]; // blue-600, seagull-500, mountain-meadow-700
const OTHER_BROKERS_COLOR = "#607490"; // storm-grey-500 — the residual bucket, deliberately unsaturated

export interface CommissionSegment {
	label: string;
	value: number;
	color: string;
}

/**
 * One slice per internal broker, in the order the Internal Commissions table
 * lists them.
 *
 * The breakdown used to draw the house's brokers as a single "Broker
 * Commission" slice, which answered how much stayed in the firm but not who it
 * went to — the question a broker reading their own voucher actually has.
 *
 * Brokers past the palette fold into one Other row rather than taking a
 * repeated hue. Their money is still counted, so the rows continue to sum to
 * `commissionAllocation().internal`.
 */
export function internalBrokerSegments(
	brokers: DealBroker[],
): CommissionSegment[] {
	const named = brokers.slice(0, INTERNAL_COLORS.length).map((b, i) => ({
		label: b.name,
		value: b.grossCommission,
		color: INTERNAL_COLORS[i],
	}));
	const rest = brokers.slice(INTERNAL_COLORS.length);
	if (rest.length === 0) return named;
	return [
		...named,
		{
			label: `${rest.length} Other Brokers`,
			value: rest.reduce((total, b) => total + b.grossCommission, 0),
			color: OTHER_BROKERS_COLOR,
		},
	];
}
