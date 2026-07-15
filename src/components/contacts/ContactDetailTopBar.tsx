import { Link } from "@tanstack/react-router";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShareNodes, faCaretDown } from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { AvatarGroup } from "#/components/properties/AvatarGroup";

/**
 * Fixed top bar for the contact detail page: breadcrumbs on the left, a share
 * control (collaborator avatars + a Share menu) on the right. The share menu is
 * scaffolded (non-functional) for this structural pass.
 */
export function ContactDetailTopBar({ contact }: { contact: Contact }) {
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
        <AvatarGroup seed={contactFullName(contact).length} />
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="outline" size="sm">
                <FontAwesomeIcon icon={faShareNodes} />
                Share
                <FontAwesomeIcon icon={faCaretDown} />
              </Button>
            }
          />
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item>Share with a teammate</DropdownMenu.Item>
            <DropdownMenu.Item>Copy link</DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item>Make private</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
    </div>
  );
}
