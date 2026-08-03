import type { ListingStage } from "#/data/types";
import { dealStageLabel, type DealShape } from "#/data/dealShape";
import { STATUS_COLORS } from "../properties/propertyDisplay";

/** Soft-colored pill with a status dot for the unified listing + deal stage. */
export function DealStageBadge({
  stage,
  shape = "sale",
}: {
  stage: ListingStage;
  shape?: DealShape;
}) {
  const color = STATUS_COLORS[stage];
  return (
    <span
      className="d-inline-flex align-items-center gap-2 fw-semibold text-nowrap"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        color,
        borderRadius: 6,
        padding: "3px 10px",
        fontSize: 12,
      }}
    >
      <span
        className="rounded-circle"
        style={{ width: 8, height: 8, backgroundColor: color }}
      />
      {dealStageLabel(stage, shape)}
    </span>
  );
}
