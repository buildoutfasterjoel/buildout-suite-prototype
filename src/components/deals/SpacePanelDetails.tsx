import { useState } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/pro-regular-svg-icons";
import { getProperty, getStore } from "#/data/store";
import { spaceAvailability } from "#/data/dealShape";
import type { Contact, Listing } from "#/data/types";

/**
 * The two party lists the panel can add to. Neither write path exists yet — there is
 * no add-contact-to-deal action in the data layer, and brokers have no roster to pick
 * from — so the buttons state their intent rather than pretending.
 *
 * `blurb` is deliberately specific about what the real flow will do, so a click during
 * a demo reads as "not built yet" and not as "broken".
 */
const PENDING_ADDS = {
  tenant: {
    title: "Add tenant",
    blurb:
      "This will link an existing contact to this space as its tenant. Linking one here also satisfies the tenant requirement on the Under Contract gate, which is the only place a tenant can be attached today.",
  },
  broker: {
    title: "Add broker",
    blurb:
      "This will add a broker to this space's commission split. Brokers have no shared roster yet, so the real flow needs a short form — name, role, split, and whether they are internal or outside.",
  },
} as const;

type PendingAdd = keyof typeof PENDING_ADDS;

/**
 * Deal > Details for a suite panel. Four headline facts (rescued from the deleted
 * PropertyMarketingHub), the tenant, and the brokers on this letting.
 *
 * Deliberately no landlord/seller: the owning party is known at the building level,
 * so repeating it on every suite is noise.
 */
export function SpacePanelDetails({ listing }: { listing: Listing }) {
  const [pending, setPending] = useState<PendingAdd | null>(null);
  const property = getProperty(listing.propertyId);
  const { contacts } = getStore();
  const terms = listing.marketing.spaceLeaseTerms?.[0];

  const tenants = listing.tenantContactIds
    .map((id) => contacts.get(id))
    .filter((c): c is Contact => c != null);

  const brokers = [...listing.internalBrokers, ...listing.outsideBrokers];

  const facts: [string, string][] = [
    [
      "Lease rate",
      terms?.leaseRate != null
        ? `$${terms.leaseRate} ${terms.leaseRateUnits}`
        : "—",
    ],
    [
      "Available",
      listing.marketing.availableSqFt
        ? `${listing.marketing.availableSqFt.toLocaleString()} SF`
        : "—",
    ],
    [
      "Term",
      terms?.leaseTermMonths != null ? `${terms.leaseTermMonths} months` : "—",
    ],
    ["Availability", spaceAvailability(listing.status)],
  ];

  if (!property) return null;

  return (
    <div className="d-flex flex-column gap-4">
      <dl className="row mb-0">
        {facts.map(([label, value]) => (
          <div key={label} className="col-6 col-md-3 mb-2">
            <dt className="text-muted fw-normal">{label}</dt>
            <dd className="fw-semibold mb-0">{value}</dd>
          </div>
        ))}
      </dl>

      {/* The two party lists sit side by side: they answer one question together —
          who is on this letting — and stacking them pushed the brokers below the
          fold in a panel that is already tall. `align-items-stretch` on the row
          keeps both cards the same height whichever list is longer. */}
      <div className="row g-3 align-items-stretch">
        <div className="col-12 col-lg-6">
          <Card className="h-100">
            <Card.Header className="d-flex align-items-center justify-content-between gap-2">
              <Card.Title className="fs-large fw-semibold mb-0">
                Tenant
              </Card.Title>
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0"
                onClick={() => setPending("tenant")}
              >
                <FontAwesomeIcon icon={faPlus} />
                Add tenant
              </Button>
            </Card.Header>
            <Card.Body>
              {tenants.length === 0 ? (
                <p className="text-muted mb-0">No tenant linked yet.</p>
              ) : (
                <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
                  {tenants.map((t) => (
                    <li
                      key={t.id}
                      className="d-flex flex-column"
                      style={{ minWidth: 0 }}
                    >
                      <span className="fw-semibold text-truncate">
                        {`${t.firstName} ${t.lastName}`.trim()}
                      </span>
                      {t.company && (
                        <span className="text-muted fs-small text-truncate">
                          {t.company}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>
        </div>

        <div className="col-12 col-lg-6">
          <Card className="h-100">
            <Card.Header className="d-flex align-items-center justify-content-between gap-2">
              <Card.Title className="fs-large fw-semibold mb-0">
                Brokers
              </Card.Title>
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0"
                onClick={() => setPending("broker")}
              >
                <FontAwesomeIcon icon={faPlus} />
                Add broker
              </Button>
            </Card.Header>
            <Card.Body>
              {brokers.length === 0 ? (
                <p className="text-muted mb-0">No brokers on this space.</p>
              ) : (
                <ul className="list-unstyled mb-0 d-flex flex-column gap-2">
                  {brokers.map((b) => (
                    <li
                      key={b.id}
                      className="d-flex align-items-baseline gap-2"
                      style={{ minWidth: 0 }}
                    >
                      <span
                        className="d-flex flex-column"
                        style={{ minWidth: 0 }}
                      >
                        <span className="fw-semibold text-truncate">
                          {b.name}
                        </span>
                        <span className="text-muted fs-small text-truncate">
                          {b.role}
                        </span>
                      </span>
                      <span className="text-muted ms-auto flex-shrink-0">
                        {b.commissionSplitPct}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* One modal for both buttons — the only thing that differs is the copy, and
          two near-identical modals would drift the moment either is wired up. */}
      <Modal
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <Modal.Content centered>
          <Modal.Header>
            <Modal.Title>
              {pending ? PENDING_ADDS[pending].title : ""}
            </Modal.Title>
            <Modal.Description>Not wired up yet.</Modal.Description>
          </Modal.Header>
          <Modal.Body>
            <p className="mb-0">{pending ? PENDING_ADDS[pending].blurb : ""}</p>
          </Modal.Body>
          <Modal.Footer>
            <Modal.Close render={<Button variant="primary">Got it</Button>} />
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </div>
  );
}
