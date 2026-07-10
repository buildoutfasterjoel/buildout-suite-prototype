import { useState } from "react";
import type { Listing } from "#/data/types";
import {
  getDefaultRings,
  getInitialLastRefreshed,
  type DemographicRing,
} from "#/data/listingDemographics";
import { ListingPageHeader } from "./ListingPageHeader";
import { DemographicsMapCard } from "./demographics/DemographicsMapCard";
import { DemographicsTable } from "./demographics/DemographicsTable";

/** Radius-ring map + categorized demographic data table for a listing's marketing package. */
export function ListingDemographics({ listing }: { listing: Listing }) {
  const [savedRings, setSavedRings] = useState<DemographicRing[]>(getDefaultRings);
  const [draftRings, setDraftRings] = useState<DemographicRing[]>(getDefaultRings);
  const [hiddenRowIds, setHiddenRowIds] = useState<Record<string, boolean>>({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() =>
    getInitialLastRefreshed(listing.id),
  );
  const [refreshNonce, setRefreshNonce] = useState(0);

  function handleSaveRings() {
    setSavedRings(draftRings);
  }

  function handleRefresh() {
    setRefreshNonce((n) => n + 1);
    setLastRefreshedAt(new Date().toISOString());
  }

  function handleToggleRow(rowId: string, hidden: boolean) {
    setHiddenRowIds((prev) => ({ ...prev, [rowId]: hidden }));
  }

  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader title="Demographics" />

      <DemographicsMapCard
        center={{ lat: listing.lat, lng: listing.lng }}
        savedRings={savedRings}
        draftRings={draftRings}
        onDraftRingsChange={setDraftRings}
        onSave={handleSaveRings}
        lastRefreshedAt={lastRefreshedAt}
        onRefresh={handleRefresh}
      />

      <DemographicsTable
        listingId={listing.id}
        rings={savedRings}
        refreshNonce={refreshNonce}
        hiddenRowIds={hiddenRowIds}
        onToggleRow={handleToggleRow}
      />
    </div>
  );
}
