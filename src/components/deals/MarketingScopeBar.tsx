import { Link, useParams, useSearch } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/pro-regular-svg-icons";
import { getListing, getProperty } from "#/data/store";
import { getChildDeals } from "#/data/leaseSpaces";

/**
 * Shown on a shell's marketing tabs when the broker arrived from one of its
 * spaces. Renders nothing otherwise, so it is safe to mount unconditionally
 * above every tab's `<Outlet />`.
 */
export function MarketingScopeBar() {
  const { listingId } = useParams({ from: "/_shell/listings/$listingId" });
  // Loose read: most routes under this layout declare no `from` param at all,
  // so this can't be typed against a single route's search schema.
  const rawSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const from = typeof rawSearch.from === "string" ? rawSearch.from : undefined;
  if (!from) return null;

  const child = getListing(from);
  if (!child || child.parentDealId !== listingId) return null;

  const property = getProperty(child.propertyId);
  const unit = property?.units.find((u) => u.id === child.unitId);
  const spaceCount = getChildDeals(listingId).length;

  return (
    <div className="d-flex align-items-center justify-content-between gap-3 border-bottom px-4 py-2">
      <span className="text-muted">
        Property marketing · shared by {spaceCount}{" "}
        {spaceCount === 1 ? "space" : "spaces"}
      </span>
      <Link
        to="/listings/$listingId/property-marketing"
        params={{ listingId: from }}
        className="d-flex align-items-center gap-2 text-decoration-none"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
        Back to {unit?.label ?? "the space"}
      </Link>
    </div>
  );
}
