import { createFileRoute } from "@tanstack/react-router";
import { faUsers } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute("/_shell/listings/$listingId/contacts")({
  component: ContactsRoute,
});

function ContactsRoute() {
  const { listingId } = Route.useParams();
  if (!getStore().listings.get(listingId)) return null;
  return <DealPagePlaceholder title="Contacts" icon={faUsers} />;
}
