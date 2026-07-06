import { Link } from "@tanstack/react-router";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import { contactFullName } from "#/data/contacts";
import { initials as nameInitials } from "#/components/deals/dealDisplay";
import { RelationshipPill, SidePill } from "#/components/contacts/pills";

function medDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ContactDetailHeader({ contact }: { contact: Contact }) {
  return (
    <div className="bg-card border-bottom">
      <div className="container p-4">
        <Breadcrumb className="mb-2">
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
        <div className="d-flex align-items-start gap-3">
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <h4 className="fw-bold mb-0">{contactFullName(contact)}</h4>
          <div className="text-muted">
            {contact.title} · {contact.company}
          </div>
          <div className="text-muted fs-small mt-1">
            <span className="fw-semibold">Created:</span> {medDate(contact.createdAt)}
            {"  ·  "}
            <span className="fw-semibold">Last touch:</span> {contact.lastTouch}
          </div>
          <div className="d-flex align-items-center gap-2 mt-2">
            <RelationshipPill value={contact.relationship} />
            {contact.side && <SidePill value={contact.side} />}
          </div>
        </div>

        <div className="d-flex align-items-center gap-3 flex-shrink-0">
          <Tooltip>
            <Tooltip.Trigger
              render={
                <Avatar size="sm">
                  <Avatar.Fallback className="fw-semibold">
                    {nameInitials(contact.assignedTo)}
                  </Avatar.Fallback>
                </Avatar>
              }
            />
            <Tooltip.Content>Assigned to {contact.assignedTo}</Tooltip.Content>
          </Tooltip>
          <Button variant="outline">
            <FontAwesomeIcon icon={faLock} />
            Underwrite
          </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
