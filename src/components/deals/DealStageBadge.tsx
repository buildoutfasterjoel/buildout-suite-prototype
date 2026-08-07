import type { ListingStage } from "#/data/types";
import { dealStageLabel, type DealShape } from "#/data/dealShape";
import { STATUS_COLORS } from "../properties/propertyDisplay";

/**
 * The pill every status badge is built from: a 10%-tint fill of `color` with the
 * text in `color` itself, and a leading dot.
 *
 * Extracted so a badge that is deliberately *not* a stage — a suite's occupancy —
 * can match this geometry exactly without borrowing the ladder's meaning. Such a
 * badge passes `dot={false}`: the dot is the mark of a deal sitting somewhere on
 * the ladder, and a suite nobody is working is not on it.
 */
export function StatusPill({
  color,
  dot = true,
  fontSize = 12,
  children,
}: {
  color: string;
  dot?: boolean;
  /** Defaults to the 12px a badge sitting on a dense card wants. Pass 14 to sit
   *  flush with body copy — e.g. beside a full-size stage control in a row. */
  fontSize?: number;
  children: React.ReactNode;
}) {
  return (
    <span
      className="d-inline-flex align-items-center gap-2 fw-semibold text-nowrap"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        color,
        borderRadius: 6,
        padding: "3px 10px",
        fontSize,
      }}
    >
      {dot && (
        <span
          className="rounded-circle"
          style={{ width: 8, height: 8, backgroundColor: color }}
        />
      )}
      {children}
    </span>
  );
}

/**
 * Soft-colored pill with a status dot for the unified listing + deal stage.
 *
 * The static twin of `DealStageSelect`: same `STATUS_COLORS` token per stage, so
 * a stage read off a card and the same stage read off the dropdown in a page
 * header are the same colour and the same word.
 */
export function DealStageBadge({
  stage,
  shape = "sale",
}: {
  stage: ListingStage;
  shape?: DealShape;
}) {
  return (
    <StatusPill color={STATUS_COLORS[stage]}>
      {dealStageLabel(stage, shape)}
    </StatusPill>
  );
}
