import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import type { Listing, Property, PropertyUnit, SpaceLeaseTerms } from "#/data/types";
import { emptySpaceLeaseTerms } from "#/data/createListing";
import { updateDealMarketing } from "#/data/actions";
import { notify } from "#/lib/notify";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { SpaceTermsSection } from "#/components/listings/edit/sections/SpaceTermsSection";

/**
 * A space's own marketing form — the Listing slot's occupant for a space deal.
 *
 * These are exactly the fields that used to be edited inline on the building's
 * roster; the roster is a directory now, so this is their single home. Behind a
 * Save button, the same contract the deal edit form uses (`b1aad55`), rather
 * than writing through on every keystroke.
 *
 * Size is held separately from `terms` because it does not live on the terms
 * row: it is `marketing.availableSqFt` on the space's own deal, which is what the
 * publish gate and every display surface read. A `spaceSize` field on the row was
 * removed in `553282a` precisely because nothing read it — do not reintroduce it.
 */
export function SpaceDetails({
  space,
  property,
  unit,
}: {
  space: Listing;
  property: Property;
  unit: PropertyUnit;
}) {
  type Draft = { terms: SpaceLeaseTerms; availableSqFt: number | null };

  const saved: Draft = {
    terms: space.marketing.spaceLeaseTerms?.[0] ?? emptySpaceLeaseTerms(unit.id),
    availableSqFt: space.marketing.availableSqFt || null,
  };
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = draft ?? saved;
  const dirty = draft != null;

  const patch = (next: Partial<Draft>) =>
    setDraft((prev) => ({ ...(prev ?? saved), ...next }));

  const save = () => {
    if (!draft) return;
    updateDealMarketing(space.id, {
      spaceLeaseTerms: [draft.terms],
      // 0 rather than null: `DealMarketing.availableSqFt` is a number, and a
      // cleared field means "no size on record", which the gate reads as unmet.
      availableSqFt: draft.availableSqFt ?? 0,
    });
    setDraft(null);
    notify({ title: "Space details saved" });
  };

  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader title="Details" />

      <SpaceTermsSection
        unit={unit}
        property={property}
        terms={current.terms}
        onChange={(termsPatch) =>
          patch({ terms: { ...current.terms, ...termsPatch } })
        }
        availableSqFt={current.availableSqFt}
        onAvailableSqFtChange={(v) => patch({ availableSqFt: v })}
      />

      {/* Cancel ghost, Save primary — the same bar the deal edit form ends with,
          so the two forms behave identically. Disabled until something changes,
          since a Save that does nothing teaches nothing. */}
      <div className="d-flex justify-content-end align-items-center gap-2 border-top mt-3 pt-3">
        {dirty && <span className="text-muted me-auto">Unsaved changes</span>}
        <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(null)}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!dirty} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}
