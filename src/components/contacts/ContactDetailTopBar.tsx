import { Link } from "@tanstack/react-router";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import type { Contact } from "#/data/types";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { ContactAccessAvatars } from "#/components/contacts/ContactAccessAvatars";
import type { ContactSharesApi } from "#/components/contacts/useContactShares";

/**
 * Fixed top bar for the contact detail page: breadcrumbs on the left, a share
 * control (collaborator avatars + a Share button) on the right. The Share button
 * opens the sharing modal (owned by the route so the hero can open it too).
 */
export function ContactDetailTopBar({
  contact,
  access,
  onOpenShare,
}: {
  contact: Contact;
  access: ContactSharesApi;
  onOpenShare: () => void;
}) {
  return (
    <div className="d-flex align-items-center justify-content-between gap-3">
      <Breadcrumb>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link render={<Link to="/backoffice/contacts" />}>
              People
            </Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page>{contactFullName(contact)}</Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb>

      <div className="d-flex align-items-center gap-2 flex-shrink-0">
        <Button variant="outline" size="sm" onClick={onOpenShare}>
          <ContactAccessAvatars
            shares={access.shares}
            className="contact-share-avatars"
          />
          Share
        </Button>
      </div>
    </div>
  );
}
