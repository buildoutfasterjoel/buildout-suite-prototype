import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { DealEditor } from "#/components/deals/edit/DealEditor";

export const Route = createFileRoute("/_shell/listings/$listingId/edit")({
  /** `?review=ingestion` arrives from the document-ingestion banner when the
   * first unresolved conflict is one this page owns. */
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
  // Reactive (not getStore()) so resolving an ingestion conflict — which patches
  // the listing mid-edit — clears that arbitration row and counts the badge down
  // immediately. The editor's drafts are seeded from this as initial state only.
  const listing = useDataStore((s) => s.listings.get(listingId));

  if (!listing) return null;

  return <DealEditor listing={listing} review={review} />;
}
