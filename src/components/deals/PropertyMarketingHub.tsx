import { Link } from "@tanstack/react-router";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import {
  faFileLines,
  faGlobe,
  faEnvelope,
  faMapLocationDot,
  faTableCells,
  faRulerCombined,
  faArrowUpRightFromSquare,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { getListing, getProperty } from "#/data/store";
import { getChildDeals } from "#/data/leaseSpaces";
import { spaceAvailability } from "#/data/dealShape";
import type { Listing } from "#/data/types";

/**
 * The six surfaces that exist only on the building. Same order as the
 * sidebar. `to` is a literal per-route path (rather than built from a
 * template string) so the typed router can validate it against the known
 * route table.
 */
const SHARED = [
  {
    label: "Documents",
    to: "/listings/$listingId/documents" as const,
    icon: faFileLines,
  },
  {
    label: "Website",
    to: "/listings/$listingId/website" as const,
    icon: faGlobe,
  },
  {
    label: "Email",
    to: "/listings/$listingId/email" as const,
    icon: faEnvelope,
  },
  {
    label: "Demographics",
    to: "/listings/$listingId/demographics" as const,
    icon: faMapLocationDot,
  },
  {
    label: "Grids",
    to: "/listings/$listingId/grids" as const,
    icon: faTableCells,
  },
  {
    label: "Plans",
    to: "/listings/$listingId/plans" as const,
    icon: faRulerCombined,
  },
] satisfies { label: string; to: string; icon: IconDefinition }[];

/**
 * Read-only hub on a space deal explaining that marketing is shared at the
 * building level, showing how this space appears in that shared marketing,
 * and linking out to the shell's own marketing surfaces. No inputs anywhere
 * on this page — the space's own terms are edited on its own edit form.
 */
export function PropertyMarketingHub({ listing }: { listing: Listing }) {
  const shellId = listing.parentDealId;
  const shell = shellId ? getListing(shellId) : undefined;
  const property = getProperty(listing.propertyId);
  if (!shellId || !shell || !property) return null;

  const spaceCount = getChildDeals(shellId).length;
  const terms = listing.marketing.spaceLeaseTerms?.[0];
  const unit = property.units.find((u) => u.id === listing.unitId);

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

  return (
    <div className="p-4 d-flex flex-column gap-4">
      <Alert severity="info" withIcon>
        <FontAwesomeIcon icon={faCircleInfo} />
        <Alert.Title>Marketing lives on the building</Alert.Title>
        Marketing for {property.name} is shared across all {spaceCount}{" "}
        {spaceCount === 1 ? "space" : "spaces"}. Changes affect every space.
      </Alert>

      <section>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h2 className="fs-6 fw-semibold mb-0">
            How {unit?.label ?? "this space"} appears
          </h2>
          <Button
            variant="secondary"
            nativeButton={false}
            render={
              <Link
                to="/listings/$listingId/edit"
                params={{ listingId: listing.id }}
              />
            }
          >
            Edit space terms
          </Button>
        </div>
        <dl className="row mb-0">
          {facts.map(([label, value]) => (
            <div key={label} className="col-6 col-md-3 mb-2">
              <dt className="text-muted fw-normal">{label}</dt>
              <dd className="fw-semibold mb-0">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="fs-6 fw-semibold mb-2">Shared property marketing</h2>
        <div className="d-flex flex-column gap-1">
          {SHARED.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              params={{ listingId: shellId }}
              search={{ from: listing.id }}
              className="d-flex align-items-center justify-content-between gap-3 border rounded p-3 text-decoration-none text-body"
            >
              <span className="d-flex align-items-center gap-2">
                <FontAwesomeIcon icon={s.icon} className="text-muted" />
                {s.label}
              </span>
              <span className="text-muted d-flex align-items-center gap-2">
                Open <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
