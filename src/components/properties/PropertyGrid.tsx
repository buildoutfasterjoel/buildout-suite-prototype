import { Link } from "@tanstack/react-router";
import {
  Empty,
  EmptyTitle,
  EmptyContent,
} from "@buildoutinc/blueprint-react/ui/Empty";
import type { Listing } from "#/data/types";
import { PropertyCard } from "./PropertyCard";

export function PropertyGrid({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100 p-8">
        <Empty>
          <EmptyTitle>No deals match your filters</EmptyTitle>
          <EmptyContent>
            Try clearing the search or adjusting the type, city, or status
            filters.
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div>
      <div className="row g-3">
        {listings.map((listing) => (
          <div key={listing.id} className="col-md-6 col-lg-4 col-xl-3">
            <Link
              to="/listings/$listingId"
              params={{ listingId: listing.id }}
              className="text-decoration-none text-reset d-block h-100"
            >
              <PropertyCard listing={listing} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
