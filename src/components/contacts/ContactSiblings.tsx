import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink, faUserGroup } from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import { siblingRelationships } from "#/data/contactRelationships";
import { accountableName, type ContactRights } from "#/data/contactViewerAccess";
import { linkContactsAsPerson } from "#/data/actions";
import { checkContactRight, rightsForContactId } from "#/components/contacts/contactRights";
import { useVisibleContacts } from "#/components/contacts/useVisibleContacts";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { notify } from "#/lib/notify";

/**
 * The hero's "one person, many relationships" line. Says which other brokers
 * hold a relationship with this same human — linked ones as a fact, suspected
 * ones (same email or phone, not yet linked) as a question with a Link action.
 *
 * Runs over the visible book only, so a private record in someone else's book
 * never announces itself here. Linking is a change to both records, so the
 * action shows only when the viewer may edit both; otherwise it names who to
 * ask. No merge — two histories stay two histories.
 */
export function ContactSiblings({
  contact,
  rights,
}: {
  contact: Contact;
  rights: ContactRights;
}) {
  const { contacts: visible } = useVisibleContacts();
  const siblings = useMemo(() => siblingRelationships(contact, visible), [contact, visible]);
  if (siblings.linked.length === 0 && siblings.suspected.length === 0) return null;

  const holder = (other: Contact) => {
    const r = rightsForContactId(other.id);
    return r ? accountableName(r.ownership) : other.assignedTo;
  };

  return (
    <div className="d-flex flex-column gap-1 mt-1">
      {siblings.linked.map((other) => (
        <span key={other.id} className="d-inline-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faUserGroup} className="text-muted" />
          <span>
            Also known to <span className="fw-semibold">{holder(other)}</span> as a separate
            relationship ·{" "}
            <Link
              to="/backoffice/contacts/$contactId"
              params={{ contactId: other.id }}
              className="fw-semibold"
            >
              View
            </Link>
          </span>
        </span>
      ))}
      {siblings.suspected.map((other) => {
        const who = holder(other);
        const canLink = rights.canEdit && checkContactRight(other.id, "canEdit").ok;
        return (
          <span key={other.id} className="d-inline-flex align-items-center gap-2 flex-wrap">
            <FontAwesomeIcon icon={faUserGroup} className="text-muted" />
            <span>
              May be the same person as{" "}
              <Link
                to="/backoffice/contacts/$contactId"
                params={{ contactId: other.id }}
                className="fw-semibold"
              >
                {contactFullName(other)}
              </Link>{" "}
              in <span className="fw-semibold">{who}</span>&apos;s book.
            </span>
            {canLink ? (
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        linkContactsAsPerson(contact.id, other.id);
                        notify({
                          title: "Linked as the same person",
                          description: `${contactFullName(contact)} and ${contactFullName(
                            other,
                          )} are now two relationships with one person. Both histories stay as they are.`,
                        });
                      }}
                    >
                      <FontAwesomeIcon icon={faLink} />
                      Link
                    </Button>
                  }
                />
                <Tooltip.Content style={{ maxWidth: 260 }}>
                  Mark these two records as the same person. Nothing merges — each keeps its
                  owner, history and privacy.
                </Tooltip.Content>
              </Tooltip>
            ) : (
              <span className="text-muted">Ask {who} to link them.</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
