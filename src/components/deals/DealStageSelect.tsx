import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import type { Listing, ListingStage } from "#/data/types";
import { availableStages, dealShape, dealStageLabel } from "#/data/dealShape";
import { STATUS_COLORS } from "#/components/properties/propertyDisplay";
import { requestStageChange } from "#/components/deals/useStageGate";

/** Colored dot + stage label. Shared by the trigger and every item so the two can't drift. */
function StageLabel({ stage, label }: { stage: ListingStage; label: string }) {
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <span
        className="rounded-circle"
        style={{ width: 8, height: 8, backgroundColor: STATUS_COLORS[stage] }}
      />
      {label}
    </span>
  );
}

/**
 * The deal-stage control: a dot-and-label select whose options are the deal's own
 * ladder. One component so every surface that changes a stage looks and behaves
 * identically — the building's page header and a suite panel's header both mount
 * this rather than each rolling their own.
 *
 * Takes the whole listing and derives both the ladder (via `dealShape`) and the
 * transition from it, so a caller cannot accidentally pass a shape that disagrees
 * with the deal. Selecting a stage routes through `requestStageChange`, which opens
 * the stage gate and refuses any target outside the shape's ladder.
 */
export function DealStageSelect({ listing }: { listing: Listing }) {
  const shape = dealShape(listing);

  return (
    // Blueprint's Select.Trigger is a Bootstrap `.form-select`, which is width:100%.
    // Dropped straight into a flex row it fills the row and crushes whatever sits
    // beside it. This content-sized, non-shrinking wrapper is what keeps the trigger
    // at its own width, so callers can place it in a row without knowing that.
    <div className="d-flex flex-shrink-0">
      <Select
        value={listing.status}
        onValueChange={(v) => {
          if (v && v !== listing.status) {
            requestStageChange(listing.id, v as ListingStage);
          }
        }}
      >
        <Select.Trigger style={{ minWidth: 168 }}>
          <span className="d-inline-flex align-items-center gap-2">
            <span
              className="rounded-circle"
              style={{
                width: 8,
                height: 8,
                backgroundColor: STATUS_COLORS[listing.status],
              }}
            />
            <Select.Value>
              {(v) => dealStageLabel(v as ListingStage, shape)}
            </Select.Value>
          </span>
        </Select.Trigger>
        <Select.Content>
          {availableStages(shape).map((s) => (
            <Select.Item key={s} value={s}>
              <StageLabel stage={s} label={dealStageLabel(s, shape)} />
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </div>
  );
}
