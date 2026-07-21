import { Link, useNavigate } from "@tanstack/react-router";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faUsers,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { useContactListNav } from "#/components/contacts/useContactListNav";

/**
 * Prev/next pager with an "N of M" index, mirroring the source list the contact
 * was opened from. Renders only when the current contact belongs to a tracked
 * list; each arrow steps to the adjacent contact in that list.
 */
function ContactListPager({ contactId }: { contactId: string }) {
  const navigate = useNavigate();
  const ids = useContactListNav((s) => s.ids);
  const index = ids.indexOf(contactId);
  if (index === -1 || ids.length < 2) return null;

  const go = (i: number) =>
    void navigate({
      to: "/backoffice/contacts/$contactId",
      params: { contactId: ids[i] },
    });

  return (
    <div className="d-flex align-items-center gap-1 flex-shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous contact"
        disabled={index <= 0}
        onClick={() => go(index - 1)}
      >
        <FontAwesomeIcon icon={faChevronLeft} />
      </Button>
      <span className="text-muted text-nowrap" style={{ fontSize: 14 }}>
        {index + 1} of {ids.length}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next contact"
        disabled={index >= ids.length - 1}
        onClick={() => go(index + 1)}
      >
        <FontAwesomeIcon icon={faChevronRight} />
      </Button>
    </div>
  );
}

/**
 * Fixed top bar for the contact detail page: a list pager + breadcrumbs.
 *
 * The breadcrumb root adapts to the source list — "Contacts", "Contacts
 * (Filtered)", or the list's (truncated) name — and clicking it restores that
 * exact view on the People page (see useContactListNav). Sharing now lives
 * entirely in the contact hero, so the top bar carries no share control.
 */
export function ContactDetailTopBar({ contact }: { contact: Contact }) {
  const source = useContactListNav((s) => s.source);
  const rootLabel = source?.label ?? "Contacts";

  return (
    <div className="d-flex align-items-center justify-content-between gap-3">
      <div className="d-flex align-items-center gap-3" style={{ minWidth: 0 }}>
        <ContactListPager contactId={contact.id} />

        <Breadcrumb className="contact-detail-breadcrumb">
          <Breadcrumb.List>
            <Breadcrumb.Item>
              <Breadcrumb.Link
                render={
                  <Link
                    to="/backoffice/contacts"
                    onClick={() => useContactListNav.getState().requestRestore()}
                  />
                }
              >
                <span className="d-inline-flex align-items-center gap-2">
                  <FontAwesomeIcon icon={faUsers} />
                  <span
                    className="d-inline-block text-truncate"
                    style={{ maxWidth: 220 }}
                    title={rootLabel}
                  >
                    {rootLabel}
                  </span>
                </span>
              </Breadcrumb.Link>
            </Breadcrumb.Item>
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
              <Breadcrumb.Page>{contactFullName(contact)}</Breadcrumb.Page>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
      </div>

    </div>
  );
}
