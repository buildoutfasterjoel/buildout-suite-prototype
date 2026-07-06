import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserSlash } from "@fortawesome/pro-regular-svg-icons";
import { getContactDetail } from "#/lib/contacts";
import { ContactDetailHeader } from "#/components/contacts/ContactDetailHeader";
import { ContactDetailsCard } from "#/components/contacts/ContactDetailsCard";
import { ContactEngagementPanel } from "#/components/contacts/ContactEngagementPanel";
import { ContactDealsPanel } from "#/components/contacts/ContactDealsPanel";

export const Route = createFileRoute("/backoffice/contacts/$contactId")({
  component: ContactDetailPage,
  loader: ({ params }) => getContactDetail({ data: { id: params.contactId } }),
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
  const detail = Route.useLoaderData();

  if (!detail) return <ContactNotFound />;

  const { contact, deals, openTaskCount } = detail;

  return (
    <div className="d-flex flex-column h-100 overflow-auto">
      <ContactDetailHeader contact={contact} />

      <div className="container py-4">
        <div className="row g-4">
          <div className="col-12 col-lg-3">
            <ContactDetailsCard contact={contact} deals={deals} />
          </div>
          <div className="col-12 col-lg-6">
            <ContactEngagementPanel contact={contact} deals={deals} />
          </div>
          <div className="col-12 col-lg-3">
            <ContactDealsPanel
              contact={contact}
              deals={deals}
              openTaskCount={openTaskCount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
