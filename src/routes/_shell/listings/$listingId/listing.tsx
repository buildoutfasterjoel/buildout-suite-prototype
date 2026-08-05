import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { ListingEditor } from "#/components/listings/edit/ListingEditor";

export const Route = createFileRoute("/_shell/listings/$listingId/listing")({
  /** `?review=ingestion` arrives from the document-ingestion banner when the
   * first unresolved conflict is one this page owns. */
  validateSearch: (
    search: Record<string, unknown>,
  ): { review?: "ingestion" } => ({
    review: search.review === "ingestion" ? "ingestion" : undefined,
  }),
  component: ListingRoute,
});

function ListingRoute() {
  const { listingId } = Route.useParams();
  const { review } = Route.useSearch();
  // Reactive selectors (not getStore()) so resolving an ingestion conflict —
  // which patches the listing mid-edit — clears that arbitration row and counts
  // the badge down immediately. The editor's drafts are seeded from these as
  // initial state only, so a re-render never discards unsaved edits.
  const listing = useDataStore((s) => s.listings.get(listingId));
  const property = useDataStore((s) =>
    s.properties.get(listing?.propertyId ?? ""),
  );

  if (!listing || !property) return null;

  return <ListingEditor listing={listing} property={property} review={review} />;
}
