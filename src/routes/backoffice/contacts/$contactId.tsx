import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserSlash } from "@fortawesome/pro-regular-svg-icons";
import { getContactDetailClient } from "#/data/selectors";
import { ContactDetailTopBar } from "#/components/contacts/ContactDetailTopBar";
import { ContactOverviewColumn } from "#/components/contacts/ContactOverviewColumn";
import { ContactEngagementPanel } from "#/components/contacts/ContactEngagementPanel";
import { ContactTasksPanel } from "#/components/contacts/ContactTasksPanel";

export const Route = createFileRoute("/backoffice/contacts/$contactId")({
  component: ContactDetailPage,
  head: () => ({
    meta: [{ title: "Contact | Buildout Suite" }],
  }),
});

function ContactNotFound() {
  return (
    <div className="container py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={faUserSlash} aria-label="Contact not found" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Contact not found</Empty.Title>
          We couldn&apos;t find that person. They may have been removed, or the
          link is incorrect.
        </Empty.Content>
        <Empty.Actions>
          <Button
            variant="primary"
            nativeButton={false}
            render={<Link to="/backoffice/contacts" />}
          >
            Back to People
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

function ContactDetailPage() {
  const { contactId } = Route.useParams();
  const detail = getContactDetailClient(contactId);

  if (!detail) return <ContactNotFound />;

  const { contact, deals, openTaskCount } = detail;

  return (
    <div
      className="d-flex flex-column h-100 overflow-hidden p-4 gap-3 mx-auto w-100"
      style={{ maxWidth: "96rem" }}
    >
      {/* Fixed top bar */}
      <ContactDetailTopBar contact={contact} />

      {/* Full-height 3-column row; each column scrolls independently and the
          page itself never scrolls. */}
      <div className="d-flex gap-4 flex-grow-1 overflow-hidden">
        <div
          className="flex-shrink-0 h-100 overflow-auto"
          style={{ width: 360 }}
        >
          <ContactOverviewColumn contact={contact} deals={deals} />
        </div>
        <div className="flex-grow-1 h-100 overflow-auto">
          <ContactEngagementPanel contact={contact} deals={deals} />
        </div>
        <div
          className="flex-shrink-0 h-100 overflow-hidden"
          style={{ width: 340 }}
        >
          <ContactTasksPanel contact={contact} openTaskCount={openTaskCount} />
        </div>
      </div>
    </div>
  );
}
