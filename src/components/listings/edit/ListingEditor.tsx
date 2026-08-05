import { useEffect, useRef, useState } from "react";
import { Link, useBlocker } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Dialog } from "@buildoutinc/blueprint-react/ui/Dialog";
import type { DealMarketing, Listing, Property, RentRollRow } from "#/data/types";
import { resolveIngestionConflict, updateDeal } from "#/data/actions";
import { updateProperty } from "#/data/store";
import { notify } from "#/lib/notify";
import { ListingFormEditor } from "#/components/listings/edit/ListingFormEditor";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { listingSavePatch, propertySavePatch } from "#/components/deals/edit/savePatches";
import { reseedDraft } from "#/components/deals/edit/reseedDraft";
import { PendingPublishBanner } from "#/components/deals/edit/PendingPublishBanner";
import {
	conflictRowId,
	countConflictsFor,
	IngestionConflictProvider,
} from "#/components/deals/ingestionConflictContext";
import {
	conflictKeysOn,
	firstUnresolvedOn,
	otherPage,
} from "#/components/deals/ingestionRouting";

/**
 * Marketing → Listing: the listing's own field data, editable in place. This is
 * the form that used to be the Listing tab of `/edit`; the website editor reads
 * the same data from a separate section.
 *
 * Save only, by design — a nav section has nowhere for Cancel to return to, and
 * navigating away already discards. Save is disabled until something changes, so
 * the bar says "nothing to save" rather than sitting there dead. Because there's
 * no Cancel, an accidental sidebar click is the only way to lose a dirty edit —
 * `useBlocker` below catches that and asks first.
 */
export function ListingEditor({
	listing,
	property,
	/** When "ingestion", scroll to the first conflicting field this page owns. */
	review,
}: {
	listing: Listing;
	property: Property;
	review?: "ingestion";
}) {
	const [marketing, setMarketing] = useState<DealMarketing>(listing.marketing);
	const [propertyDraft, setPropertyDraft] = useState<Property>(property);
	const [rentRoll, setRentRollState] = useState<RentRollRow[]>(
		listing.financials.rentRoll,
	);
	const [internalNotes, setInternalNotes] = useState(listing.internalNotes);
	const [dirty, setDirty] = useState(false);

	// Every broker-facing edit marks the draft dirty. The ingestion re-seed below
	// deliberately does not: it brings the draft *to* what is stored, so there is
	// nothing new to save.
	const patchMarketing = (patch: Partial<DealMarketing>) => {
		setMarketing((m) => ({ ...m, ...patch }));
		setDirty(true);
	};
	const patchProperty = (patch: Partial<Property>) => {
		setPropertyDraft((p) => ({ ...p, ...patch }));
		setDirty(true);
	};
	const setRentRoll = (v: RentRollRow[]) => {
		setRentRollState(v);
		setDirty(true);
	};
	const patchInternalNotes = (v: string) => {
		setInternalNotes(v);
		setDirty(true);
	};

	// A nav section you can navigate off of at any time, with no Cancel to make
	// that an explicit choice — so an unsaved edit is one misclick away from
	// silently vanishing in a form this long. Block navigation while dirty and
	// let the broker choose: `reset()` stays on the page, `proceed()` discards
	// and continues. Saving is deliberately not one of the dialog's actions —
	// it stays a guard, not a second Save surface.
	const blocker = useBlocker({
		shouldBlockFn: () => dirty,
		// `enableBeforeUnload` defaults to `true` and the native beforeunload
		// prompt never consults `shouldBlockFn` — it only reads this flag. Tie it
		// to `dirty` too, or a reload/close on a clean form shows the browser's
		// "Leave site?" prompt for no reason.
		enableBeforeUnload: () => dirty,
		withResolver: true,
	});

	// An ingestion run can commit while the broker is already in this form, writing
	// marketing straight to the store — values this draft snapshotted at mount, so
	// saving would silently revert them. Re-seed on that ONE transition out of
	// `processing`, and only for keys untouched since mount.
	const ingestionStatus = listing.ingestion?.status;
	const previousIngestionStatus = useRef(ingestionStatus);
	const mountedListing = useRef(listing);
	useEffect(() => {
		const previous = previousIngestionStatus.current;
		previousIngestionStatus.current = ingestionStatus;
		if (previous !== "processing" || ingestionStatus === "processing") return;
		const base = mountedListing.current;
		setMarketing((d) => reseedDraft(d, base.marketing, listing.marketing));
	}, [ingestionStatus, listing]);

	const conflicts = listing.ingestion?.conflicts ?? [];
	const conflictCount = countConflictsFor(conflicts, conflictKeysOn("listing"));
	const conflictsElsewhere = countConflictsFor(
		conflicts,
		conflictKeysOn(otherPage("listing")),
	);

	// Review mode: bring the first disputed field this page owns into view. Mount
	// only, held in a ref so re-renders as conflicts resolve cannot yank the page
	// around mid-edit. Effects do not run during SSR; the `document` guard covers
	// the rest.
	const scrollTarget = useRef(
		review === "ingestion" ? firstUnresolvedOn(conflicts, "listing") : null,
	);
	useEffect(() => {
		const fieldKey = scrollTarget.current;
		if (!fieldKey || typeof document === "undefined") return;
		document
			.getElementById(conflictRowId(fieldKey))
			?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, []);

	const save = () => {
		// `listing` and `property` are the route's reactive store records, not draft
		// snapshots — so the patches keep the gate-owned marketing keys, the
		// seed/creation-only occupancy snapshot, and the property's `units` exactly
		// as stored, even if they moved while this form was open. See savePatches.ts.
		updateDeal(listing.id, listingSavePatch(listing, { marketing, internalNotes, rentRoll }));
		updateProperty(property.id, propertySavePatch(property, propertyDraft));
		setDirty(false);
		notify({ title: "Listing saved" });
	};

	const saveButton = (
		<Button variant="primary" disabled={!dirty} onClick={save}>
			Save
		</Button>
	);

	return (
		<IngestionConflictProvider
			conflicts={conflicts}
			onResolve={(fieldKey, side) =>
				resolveIngestionConflict(listing.id, fieldKey, side)
			}
		>
			<div className="d-flex flex-column gap-6 p-4">
				<PendingPublishBanner listing={listing} />

				<ListingPageHeader
					title="Listing"
					actions={
						<>
							{conflictCount > 0 && (
								<Badge variant="outline" className="ingestion-conflict__badge">
									{conflictCount}
								</Badge>
							)}
							{saveButton}
						</>
					}
				/>
				{conflictCount === 0 && conflictsElsewhere > 0 && (
					<p className="text-muted fs-small mb-0">
						{conflictsElsewhere} unresolved{" "}
						{conflictsElsewhere === 1 ? "conflict" : "conflicts"} remain on{" "}
						<Link
							to="/listings/$listingId/edit"
							params={{ listingId: listing.id }}
							search={{ review: "ingestion" }}
						>
							the Deal page
						</Link>
						.
					</p>
				)}

				<ListingFormEditor
					dealType={listing.dealType}
					status={listing.status}
					marketing={marketing}
					patchMarketing={patchMarketing}
					property={propertyDraft}
					patchProperty={patchProperty}
					rentRoll={rentRoll}
					setRentRoll={setRentRoll}
					internalNotes={internalNotes}
					setInternalNotes={patchInternalNotes}
				/>

				<div className="d-flex justify-content-end align-items-center gap-2 border-top pt-4">
					{dirty && <span className="text-muted me-auto">Unsaved changes</span>}
					{saveButton}
				</div>
			</div>

			<Dialog
				open={blocker.status === "blocked"}
				onOpenChange={(open) => {
					if (!open) blocker.reset?.();
				}}
			>
				<Dialog.Portal>
					<Dialog.Overlay />
					<Dialog.Content>
						<Dialog.Header>
							<Dialog.Title>Leave without saving?</Dialog.Title>
						</Dialog.Header>
						<Dialog.Body>
							<p className="mb-0">
								This listing has changes that haven&rsquo;t been saved. If you
								leave now, they will be lost.
							</p>
						</Dialog.Body>
						<Dialog.Footer>
							<Dialog.Cancel variant="outline">Stay</Dialog.Cancel>
							<Button variant="destructive" onClick={() => blocker.proceed?.()}>
								Leave without saving
							</Button>
						</Dialog.Footer>
					</Dialog.Content>
				</Dialog.Portal>
			</Dialog>
		</IngestionConflictProvider>
	);
}
