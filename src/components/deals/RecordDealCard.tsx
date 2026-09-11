import { useNavigate } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { requestStageChange } from "#/components/deals/useStageGate";
import { NewDealCard } from "#/components/deals/NewDealCard";
import { dealCardLinkProps } from "#/components/deals/dealCardLink";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";

/**
 * The redesigned deal card on a *record* page — a property or a space — where
 * there is no contact to relate the deal to. `NewContactDealCard` is its sibling
 * on a contact's record: same `NewDealCard` presentation, minus the relationship
 * badge and the contact-specific call to action. Clicking opens the deal; the
 * stage chip moves it through the usual gate.
 */
export function RecordDealCard({ listingId }: { listingId: string }) {
  const navigate = useNavigate();
  // Whole map, not `.get()`: a shell's rollup badge counts its children, which
  // changes without touching the shell's own object.
  const listings = useDataStore((s) => s.listings);
  const listing = listings.get(listingId);
  if (!listing) return null;

  return (
    <div
      onClick={(e) => {
        if (shouldIgnoreRowClick(e)) return;
        void navigate(dealCardLinkProps(listing));
      }}
    >
      <NewDealCard
        listing={listing}
        onStageChange={(next) => requestStageChange(listingId, next)}
      />
    </div>
  );
}
