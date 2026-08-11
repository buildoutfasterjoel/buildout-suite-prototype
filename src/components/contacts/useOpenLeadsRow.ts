import { useNavigate } from "@tanstack/react-router";
import { spaceLeadsTarget } from "#/components/deals/dealCardLink";

/**
 * Opens the Leads list where this listing's inquiries actually appear: the
 * space's own filtered Leads when the listing is a space, otherwise the
 * building's. Shared by the three cards that click through from an inquiry or a
 * deal to Leads, so the branch on `spaceLeadsTarget` lives in one place instead
 * of being copied into each card.
 *
 * `q` is optional because the deal-card CTA (View Leads on an active deal)
 * opens the list unfiltered, while the inquiry cards pre-search it to the
 * contact.
 */
export function useOpenLeadsRow(listingId: string, q?: string): () => void {
  const navigate = useNavigate();
  return () => {
    const space = spaceLeadsTarget(listingId);
    const search = q === undefined ? {} : { q };
    void (space
      ? navigate({
          to: "/listings/$listingId/spaces/$spaceId/leads",
          params: space,
          search,
        })
      : navigate({
          to: "/listings/$listingId/leads",
          params: { listingId },
          search,
        }));
  };
}
