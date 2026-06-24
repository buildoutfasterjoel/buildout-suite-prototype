import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealContacts } from "#/components/deals/DealContacts";

export const Route = createFileRoute("/listings/$listingId/contacts")({
  component: ContactsRoute,
});

function ContactsRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <DealContacts listing={listing} />;
}
