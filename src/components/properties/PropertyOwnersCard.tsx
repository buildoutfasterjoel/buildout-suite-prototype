import { Link } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/pro-regular-svg-icons";
import type { Comp, Contact } from "#/data/types";
import { formatPrice } from "./propertyDisplay";

function initials(c: Contact): string {
  return `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase();
}

export function PropertyOwnersCard({
  contacts,
  comps,
}: {
  contacts: Contact[];
  comps: Comp[];
}) {
  return (
    <div className="d-flex flex-column gap-4">
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <Card.Title className="fs-6 d-inline-flex align-items-center gap-2">
            Contacts
            <Badge variant="secondary" appearance="muted" className="fs-xs">{contacts.length}</Badge>
          </Card.Title>
          {contacts.length === 0 ? (
            <span className="text-muted fs-small">No contacts linked to this property yet.</span>
          ) : (
            contacts.map((c) => (
              <Link
                key={c.id}
                to="/backoffice/contacts/$contactId"
                params={{ contactId: c.id }}
                className="text-decoration-none text-reset d-flex align-items-center gap-2"
              >
                <Avatar size="sm">
                  <Avatar.Fallback className="fw-semibold">
                    {initials(c) || <FontAwesomeIcon icon={faUser} />}
                  </Avatar.Fallback>
                </Avatar>
                <span className="d-flex flex-column" style={{ minWidth: 0 }}>
                  <span className="text-truncate">{c.firstName} {c.lastName}</span>
                  <span className="text-muted fs-small text-truncate">
                    {[c.role, c.company].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            ))
          )}
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <Card.Title className="fs-6 d-inline-flex align-items-center gap-2">
            Comps
            <Badge variant="secondary" appearance="muted" className="fs-xs">{comps.length}</Badge>
          </Card.Title>
          {comps.length === 0 ? (
            <span className="text-muted fs-small">No comps recorded.</span>
          ) : (
            comps.slice(0, 6).map((comp) => (
              <div key={comp.id} className="d-flex justify-content-between gap-2 fs-small">
                <span className="text-truncate">
                  {comp.compType === "sale" ? "Sale" : "Lease"} · {comp.sellerOrLandlordName}
                </span>
                <span className="text-muted flex-shrink-0">
                  {comp.salePrice ? formatPrice(comp.salePrice) : comp.leaseRate ? `$${comp.leaseRate}/SF` : "—"}
                </span>
              </div>
            ))
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
