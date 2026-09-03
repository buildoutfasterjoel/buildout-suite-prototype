import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/pro-regular-svg-icons";
import { BACK_OFFICE_HREFS } from "#/components/properties/dealNav";
import type { Listing } from "#/data/types";
import { canOpenDeal } from "./dealAccess";
import { useDealAccess } from "./useDealAccess";

function NoAccess({ listing }: { listing: Listing }) {
  return (
    <div className="container py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={faLock} aria-label="No access" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>You don&apos;t have access to this deal</Empty.Title>
          Your role works from what is shared with you, and “{listing.name}” has
          not been shared. Ask someone on the deal team to share it.
        </Empty.Content>
        <Empty.Actions>
          <Button variant="primary" nativeButton={false} render={<Link to="/listings" />}>
            Back to Deals
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

/**
 * The privacy wall around a deal's sections.
 *
 * Two jobs, and the sidebar can do neither of them:
 *
 *  - A viewer with no access at all sees why instead of the deal. Hiding nav
 *    items would still leave the page itself readable underneath.
 *  - A back-office URL typed, bookmarked or linked by someone shared into
 *    marketing only sends them to the Overview. `visibleNavGroups` drops those
 *    items from the sidebar, but a URL walks straight past a sidebar.
 *
 * The redirect renders nothing while it runs, rather than the section behind a
 * queued navigation: a voucher that flashes for one frame has still been shown.
 */
export function DealAccessGate({
  listing,
  basePath,
  children,
}: {
  listing: Listing;
  /** URL prefix the section href follows, no trailing slash — as the sidebar takes it. */
  basePath: string;
  children: React.ReactNode;
}) {
  const access = useDealAccess(listing);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const section = pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length + 1).split("/")[0]
    : "";
  const blocked =
    access.backOffice === "none" && BACK_OFFICE_HREFS.includes(section);

  useEffect(() => {
    if (blocked) void navigate({ to: `${basePath}/overview`, replace: true });
  }, [blocked, basePath, navigate]);

  if (!canOpenDeal(access)) return <NoAccess listing={listing} />;
  if (blocked) return null;
  return <>{children}</>;
}
