import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/pro-regular-svg-icons";
import { faCircleSmall } from "@fortawesome/pro-solid-svg-icons";
import type { PropertyStatus } from "#/data/types";
import {
  STATUS_LABELS,
  PROPERTY_STATUSES,
} from "#/components/properties/propertyDisplay";

/**
 * Per-stage chip palette (hex of Blueprint family tokens): a soft tinted
 * background + border, a dot in the mid shade, and dark same-family text.
 * Exported so other stage-colored elements (e.g. the property card's Deal
 * badge) can match the chip exactly.
 */
export const STAGE_CHIP_COLORS: Record<
  PropertyStatus,
  { bg: string; border: string; dot: string; text: string }
> = {
  proposal: { bg: "#fff3c5", border: "#ffbf1b", dot: "#fd9a00", text: "#481800" }, // harvest-gold
  active: { bg: "#dcebfd", border: "#63a8f7", dot: "#3f86f2", text: "#182753" }, // buildout-blue
  "under-contract": {
    bg: "#f2e8ff",
    border: "#b984fc",
    dot: "#9f55f7",
    text: "#360764",
  }, // purple-heart
  closed: { bg: "#cdfee5", border: "#25e29c", dot: "#00bc7d", text: "#003024" }, // mountain-meadow
  inactive: { bg: "#eceef2", border: "#8495ac", dot: "#62748e", text: "#22262f" }, // storm-grey
};

/**
 * The deal-stage chip: a soft, family-colored pill with a leading dot and a
 * trailing caret that opens a stage picker. Controlled — the caller owns what a
 * selection does (e.g. route it through `requestStageChange` to open the gate).
 */
export function DealStageChip({
  value,
  onChange,
  size = "md",
}: {
  value: PropertyStatus;
  onChange: (next: PropertyStatus) => void;
  /** "sm" renders a compact 20px-tall pill (4px side padding, 4px gap). */
  size?: "md" | "sm";
}) {
  const c = STAGE_CHIP_COLORS[value];
  const compact = size === "sm";
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <button
            type="button"
            className={`d-inline-flex align-items-center fw-semibold text-nowrap border ${compact ? "gap-1" : "gap-2"}`}
            style={{
              backgroundColor: c.bg,
              borderColor: c.border,
              color: c.text,
              borderRadius: 6,
              height: compact ? 20 : 28,
              padding: compact ? "0 4px" : "0 8px",
              fontSize: 14,
            }}
          >
            <FontAwesomeIcon
              icon={faCircleSmall}
              style={{ color: c.dot, fontSize: 14 }}
            />
            {STATUS_LABELS[value]}
            <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 12 }} />
          </button>
        }
      />
      <DropdownMenu.Content align="start">
        {PROPERTY_STATUSES.map((s) => (
          <DropdownMenu.Item key={s} onClick={() => onChange(s)}>
            <FontAwesomeIcon
              icon={faCircleSmall}
              style={{ color: STAGE_CHIP_COLORS[s].dot }}
              className="me-2"
            />
            {STATUS_LABELS[s]}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
