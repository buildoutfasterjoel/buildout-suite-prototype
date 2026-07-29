import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { DealMarketingEditor } from "#/components/deals/DealMarketingEditor";

export const Route = createFileRoute("/_shell/listings/$listingId/edit")({
  /** `?review=ingestion` arrives from the document-ingestion banner and opens
   * the editor on the tab holding the first unresolved conflict. */
  validateSearch: (
    search: Record<string, unknown>,
  ): { review?: "ingestion" } => ({
    review: search.review === "ingestion" ? "ingestion" : undefined,
  }),
  component: EditRoute,
});

function EditRoute() {
  const { listingId } = Route.useParams();
  const { review } = Route.useSearch();
  // Reactive selectors (not getStore()) so resolving an ingestion conflict —
  // which patches the listing mid-edit — clears that arbitration row and counts
  // the tab badge down immediately. Same convention as the sibling routes; the
  // editor's own working copy is seeded from these as initial state only, so a
  // re-render never discards the broker's unsaved edits.
  const listing = useDataStore((s) => s.listings.get(listingId));
  const property = useDataStore((s) =>
    s.properties.get(listing?.propertyId ?? ""),
  );

  if (!listing || !property) return null;

  return (
    <DealMarketingEditor
      listing={listing}
      property={property}
      review={review}
    />
  );
}
