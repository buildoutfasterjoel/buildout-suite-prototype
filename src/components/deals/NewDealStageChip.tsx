import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown } from "@fortawesome/pro-regular-svg-icons";
import { faCircleSmall } from "@fortawesome/pro-solid-svg-icons";
import type { PropertyStatus } from "#/data/types";
import {
  STATUS_LABELS,
  PROPERTY_STATUSES,
} from "#/components/properties/propertyDisplay";
import { STAGE_DOT } from "#/components/deals/newCardTokens";

/**
 * The redesigned deal-stage chip: a neutral outlined pill where only the dot
 * carries the stage color, instead of the tinted-per-stage fill of
 * `DealStageChip`. Reads quieter next to the side and relationship badges, which
 * are the colored elements on the new card.
 *
 * Controlled, same contract as the chip it replaces — the caller decides what a
 * selection does (typically `requestStageChange`, which opens the gate).
 */
export function NewDealStageChip({
  value,
  onChange,
}: {
  value: PropertyStatus;
  onChange: (next: PropertyStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <button
            type="button"
            className="deal-tile__stage-chip"
            aria-label={`Deal stage: ${STATUS_LABELS[value]}`}
          >
            <FontAwesomeIcon
              icon={faCircleSmall}
              className="deal-tile__stage-dot"
              style={{ color: STAGE_DOT[value] }}
            />
            {STATUS_LABELS[value]}
            <FontAwesomeIcon
              icon={faCaretDown}
              className="deal-tile__stage-caret"
            />
          </button>
        }
      />
      <DropdownMenu.Content align="start">
        {PROPERTY_STATUSES.map((s) => (
          <DropdownMenu.Item key={s} onClick={() => onChange(s)}>
            <FontAwesomeIcon
              icon={faCircleSmall}
              style={{ color: STAGE_DOT[s] }}
              className="me-2"
            />
            {STATUS_LABELS[s]}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
