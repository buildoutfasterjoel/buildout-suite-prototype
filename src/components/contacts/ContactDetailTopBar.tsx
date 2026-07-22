import { Link, useNavigate } from "@tanstack/react-router";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
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
 * was opened from. Renders only when stepping through a specific list or a
 * filtered set — not the full, unfiltered Contacts book. Navigation loops: past
 * either end wraps around to the other.
 */
function ContactListPager({ contactId }: { contactId: string }) {
  const navigate = useNavigate();
  const ids = useContactListNav((s) => s.ids);
  const source = useContactListNav((s) => s.source);
  const index = ids.indexOf(contactId);
  // Limit the pager to lists + filtered views; hide it for unfiltered Contacts.
  if (source?.variant === "all") return null;
  if (index === -1 || ids.length < 2) return null;

  const n = ids.length;
  const go = (i: number) =>
    void navigate({
      to: "/backoffice/contacts/$contactId",
      // Wrap around so the pager loops at either end.
      params: { contactId: ids[(i + n) % n] },
    });

  return (
    <div className="d-flex align-items-center gap-1 flex-shrink-0">
      <Tooltip>
        <Tooltip.Trigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous contact"
              onClick={() => go(index - 1)}
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </Button>
          }
        />
        <Tooltip.Content>Previous contact</Tooltip.Content>
      </Tooltip>
      <span className="text-muted text-nowrap" style={{ fontSize: 14 }}>
        {index + 1} of {ids.length}
      </span>
      <Tooltip>
        <Tooltip.Trigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next contact"
              onClick={() => go(index + 1)}
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </Button>
          }
        />
        <Tooltip.Content>Next contact</Tooltip.Content>
      </Tooltip>
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
