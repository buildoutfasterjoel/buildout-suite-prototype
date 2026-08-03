import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
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

      <Separator />

      <section>
        <h3 className="fs-6 fw-semibold mb-2">Tenant</h3>
        {tenants.length === 0 ? (
          <p className="text-muted mb-0">No tenant linked yet.</p>
        ) : (
          <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
            {tenants.map((t) => (
              <li key={t.id} className="d-flex align-items-center gap-2">
                <span className="fw-semibold">
                  {`${t.firstName} ${t.lastName}`.trim()}
                </span>
                {t.company && <span className="text-muted">{t.company}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="fs-6 fw-semibold mb-2">Brokers</h3>
        {brokers.length === 0 ? (
          <p className="text-muted mb-0">No brokers on this space.</p>
        ) : (
          <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
            {brokers.map((b) => (
              <li key={b.id} className="d-flex align-items-center gap-2">
                <span className="fw-semibold">{b.name}</span>
                <span className="text-muted">{b.role}</span>
                <span className="text-muted ms-auto">
                  {b.commissionSplitPct}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
