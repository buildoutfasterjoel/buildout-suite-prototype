import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown } from "@fortawesome/pro-regular-svg-icons";
import { faCircleSmall } from "@fortawesome/pro-solid-svg-icons";
import type { PropertyStatus } from "#/data/types";
import { availableStages, dealStageLabel, type DealShape } from "#/data/dealShape";
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
  shape = "sale",
}: {
  value: PropertyStatus;
  onChange: (next: PropertyStatus) => void;
  shape?: DealShape;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <button
            type="button"
            className="deal-tile__stage-chip"
            aria-label={`Deal stage: ${dealStageLabel(value, shape)}`}
          >
            <FontAwesomeIcon
              icon={faCircleSmall}
              className="deal-tile__stage-dot"
              style={{ color: STAGE_DOT[value] }}
            />
            {dealStageLabel(value, shape)}
            <FontAwesomeIcon
              icon={faCaretDown}
              className="deal-tile__stage-caret"
            />
          </button>
        }
      />
      <DropdownMenu.Content align="start">
        {availableStages(shape).map((s) => (
          <DropdownMenu.Item key={s} onClick={() => onChange(s)}>
            <FontAwesomeIcon
              icon={faCircleSmall}
              style={{ color: STAGE_DOT[s] }}
              className="me-2"
            />
            {dealStageLabel(s, shape)}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
