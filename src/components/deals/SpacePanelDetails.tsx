import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { getProperty, getStore } from "#/data/store";
import { spaceAvailability } from "#/data/dealShape";
import type { Contact, Listing } from "#/data/types";

/**
 * Deal > Details for a suite panel. Four headline facts (rescued from the deleted
 * PropertyMarketingHub), the tenant, and the brokers on this letting.
 *
 * Deliberately no landlord/seller: the owning party is known at the building level,
 * so repeating it on every suite is noise.
 */
export function SpacePanelDetails({ listing }: { listing: Listing }) {
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
            <Card.Header>
              <Card.Title className="fs-large fw-semibold mb-0">
                Tenant
              </Card.Title>
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
            <Card.Header>
              <Card.Title className="fs-large fw-semibold mb-0">
                Brokers
              </Card.Title>
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
    </div>
  );
}
