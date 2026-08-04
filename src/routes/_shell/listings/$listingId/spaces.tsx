import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faVectorSquare,
  faPlus,
  faAngleRight,
} from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getListing, getProperty } from "#/data/store";
import { buildingAvailability } from "#/data/buildingAvailability";
import { canAddSpaces, isLeaseParent } from "#/data/dealShape";
import { emptySpaceLeaseTerms } from "#/data/createListing";
import { updateDealMarketing } from "#/data/actions";
import type { SpaceLeaseTerms } from "#/data/types";
import { notify } from "#/lib/notify";
import { SpaceTermsSection } from "#/components/listings/edit/sections/SpaceTermsSection";
import { AddSpaceModal } from "#/components/deals/AddSpaceModal";
import { DealStageSelect } from "#/components/deals/DealStageSelect";

export const Route = createFileRoute("/_shell/listings/$listingId/spaces")({
  // `space` names which row opens on arrival — a space card on the pipeline
  // board links straight here rather than to a page of its own.
  validateSearch: (search: Record<string, unknown>): { space?: string } => ({
    ...(typeof search.space === "string" && search.space
      ? { space: search.space }
      : {}),
  }),
  component: SpacesTab,
});

function SpacesTab() {
  const { listingId } = Route.useParams();
  // Reactive: re-render when a child is added (store map is replaced).
  const version = useDataStore((s) => s.listings);
  void version;
  const listing = getListing(listingId);
  // Whether this deal has a Spaces tab at all — a top-level lease deal, regardless
  // of stage. Separate from canAddSpaces: a Lost shell still has this tab, it just
  // can't accept new spaces (see below).
  const leaseParent = isLeaseParent(listing);
  const canAddSpace = listing ? canAddSpaces(listing) : false;
  const { space: spaceParam } = Route.useSearch();
  const rows = [...buildingAvailability(listingId)].sort((a, b) =>
    a.label.localeCompare(b.label, "en", { numeric: true }),
  );
  const property = listing ? getProperty(listing.propertyId) : undefined;
  const [addOpen, setAddOpen] = useState(false);
  // Which rows are expanded. Controlled rather than left to each Collapsible so
  // the row's angle can point at its own state.
  // Seeded once, from the URL. Local state owns it afterwards, so a broker can
  // open several rows. Deterministic on server and client, so no hydration
  // mismatch. `buildingAvailability` is left unsorted for its marketing
  // consumers; the sort above keeps this page and the Vouchers index in step.
  const [openRows, setOpenRows] = useState<Set<string>>(
    () => new Set(spaceParam ? [spaceParam] : []),
  );
  const setRowOpen = (dealId: string, open: boolean) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (open) next.add(dealId);
      else next.delete(dealId);
      return next;
    });
  // Arriving at a *different* `?space=` while already on this roster reuses the
  // component, so the initialiser above never runs again — the AI rail's deal
  // cards make that a two-click journey. Additive on purpose: it opens the named
  // row without closing the ones the broker opened themselves.
  useEffect(() => {
    if (spaceParam) setRowOpen(spaceParam, true);
  }, [spaceParam]);

  // One working copy per space, behind that row's own Save/Cancel — the same
  // contract as the deal edit form, which holds a draft and commits it on Save.
  // The roster used to write straight through on every keystroke, so the two
  // editors for the same terms behaved differently and neither confirmed
  // anything had happened.
  //
  // Keyed by deal id rather than held per-row, because several rows can be open
  // at once. A draft deliberately survives collapsing the row: the header is a
  // big click target and silently discarding typing would be worse than keeping
  // it, so only Save and Cancel resolve a draft.
  // A draft covers both halves of a space's terms: the terms row, and the size,
  // which lives on `marketing.availableSqFt` rather than on the row (see
  // SpaceLeaseTerms). Save commits them together so the two cannot drift.
  type SpaceDraft = { terms: SpaceLeaseTerms; availableSqFt: number | null };
  const [drafts, setDrafts] = useState<Record<string, SpaceDraft>>({});
  const patchDraft = (dealId: string, base: SpaceDraft, patch: Partial<SpaceDraft>) =>
    setDrafts((prev) => ({ ...prev, [dealId]: { ...(prev[dealId] ?? base), ...patch } }));
  const clearDraft = (dealId: string) =>
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[dealId];
      return next;
    });
  const saveDraft = (dealId: string) => {
    const draft = drafts[dealId];
    if (!draft) return;
    updateDealMarketing(dealId, {
      spaceLeaseTerms: [draft.terms],
      // 0 rather than null: `DealMarketing.availableSqFt` is a number, and a
      // cleared field means "no size on record", which the gate reads as unmet.
      availableSqFt: draft.availableSqFt ?? 0,
    });
    clearDraft(dealId);
    notify({ title: "Space terms saved" });
  };

  if (!leaseParent) {
    return (
      <div className="p-4">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="Not eligible" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>
              Spaces are only for lease representation deals
            </Empty.Title>
            Only top-level landlord-rep lease deals can be split into spaces.
          </Empty.Content>
        </Empty>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="fs-6 fw-semibold mb-0">Spaces</h2>
        {canAddSpace && (
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <FontAwesomeIcon icon={faPlus} /> Add space
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="No spaces" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No spaces yet</Empty.Title>
            Add a space to spin an individual unit into its own deal. The
            building&apos;s marketing is shared by every space.
          </Empty.Content>
          {canAddSpace && (
            <Empty.Actions>
              <Button variant="primary" onClick={() => setAddOpen(true)}>
                <FontAwesomeIcon icon={faPlus} /> Add space
              </Button>
            </Empty.Actions>
          )}
        </Empty>
      ) : (
        <div className="d-flex flex-column gap-2">
          {rows.map((row) => {
            const child = getListing(row.dealId);
            const unit = property?.units.find((u) => u.id === row.unitId);
            if (!child || !unit || !property) return null;
            // What is on record: the terms row, plus the size from the space's
            // own marketing. `addSpaceToDeal` seeds that size from the unit, so an
            // untouched row already shows the suite's real square footage.
            const saved: SpaceDraft = {
              terms:
                child.marketing.spaceLeaseTerms?.[0] ??
                emptySpaceLeaseTerms(row.unitId),
              availableSqFt: child.marketing.availableSqFt || null,
            };
            // The row edits its draft when one exists and the stored values
            // otherwise, so an untouched row shows exactly what is persisted.
            const draft = drafts[row.dealId];
            const current = draft ?? saved;
            const dirty = draft != null;
            const rowOpen = openRows.has(row.dealId);
            return (
              <Collapsible
                key={row.dealId}
                className="border rounded"
                open={rowOpen}
                onOpenChange={(open) => setRowOpen(row.dealId, open)}
              >
                <div className="d-flex align-items-center gap-2 pe-3">
                  {/* The whole row header is the trigger — the terms editor below
                  is the row's main act, so clicking anywhere but the row's
                  controls expands it. */}
                  <Collapsible.Trigger
                    className="flex-grow-1 d-flex align-items-center gap-3 border-0 bg-transparent p-3 text-start text-body"
                    style={{ cursor: "pointer" }}
                  >
                    <span className="d-flex align-items-center gap-2 fw-semibold">
                      <FontAwesomeIcon
                        icon={faAngleRight}
                        className="text-muted"
                        style={{
                          transform: rowOpen ? "rotate(90deg)" : undefined,
                          transition: "transform 0.15s ease",
                        }}
                      />
                      {unit.label}
                      <span className="text-muted fw-normal">
                        {row.sqft.toLocaleString()} SF
                      </span>
                    </span>
                    <span className="d-flex align-items-center gap-3 ms-auto">
                      {/* A draft outlives collapsing the row, so say so here —
                          otherwise the unsaved edits are invisible once closed. */}
                      {dirty && !rowOpen && (
                        <span className="text-warning fw-normal">
                          Unsaved changes
                        </span>
                      )}
                      <span className="text-muted fw-normal">
                        {row.leaseRate != null
                          ? `$${row.leaseRate} ${row.leaseRateUnits}`
                          : "Rate TBD"}
                      </span>
                      <span className="text-muted fw-normal">
                        {row.availability}
                      </span>
                    </span>
                  </Collapsible.Trigger>
                  {/* Outside the Trigger on purpose: inside it, opening the
                      select would toggle the row. The gate it opens is the
                      globally-mounted GlobalStageGateModal, so no wiring here. */}
                  <DealStageSelect listing={child} />
                  <Button
                    variant="ghost"
                    nativeButton={false}
                    render={
                      <Link
                        to="/listings/$listingId/vouchers/$spaceId"
                        params={{ listingId, spaceId: row.dealId }}
                      />
                    }
                  >
                    Voucher
                  </Button>
                </div>
                <Collapsible.Content className="border-top p-3">
                  <SpaceTermsSection
                    unit={unit}
                    property={property}
                    terms={current.terms}
                    onChange={(patch) =>
                      patchDraft(row.dealId, saved, {
                        terms: { ...current.terms, ...patch },
                      })
                    }
                    availableSqFt={current.availableSqFt}
                    onAvailableSqFtChange={(v) =>
                      patchDraft(row.dealId, saved, { availableSqFt: v })
                    }
                  />
                  {/* Cancel ghost, Save primary, in that order — the same bar the
                      deal edit form ends with, so the two editors for these terms
                      behave identically. Disabled until something changes, since a
                      Save that does nothing teaches nothing. */}
                  <div className="d-flex justify-content-end align-items-center gap-2 border-top mt-3 pt-3">
                    {dirty && (
                      <span className="text-muted me-auto">Unsaved changes</span>
                    )}
                    <Button
                      variant="ghost"
                      disabled={!dirty}
                      onClick={() => clearDraft(row.dealId)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      disabled={!dirty}
                      onClick={() => saveDraft(row.dealId)}
                    >
                      Save
                    </Button>
                  </div>
                </Collapsible.Content>
              </Collapsible>
            );
          })}
        </div>
      )}

      <AddSpaceModal
        parentDealId={listingId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  );
}
