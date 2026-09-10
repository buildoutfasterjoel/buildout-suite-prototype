import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/pro-regular-svg-icons";
import {
  BACK_OFFICE_HREFS,
  MARKETING_GATED_HREFS,
  MARKETING_HREFS,
} from "#/components/properties/dealNav";
import type { Listing } from "#/data/types";
import { canOpenDeal } from "./dealAccess";
import { useDealAccess } from "./useDealAccess";
import { useMarketingReadiness } from "./useMarketingReadiness";
import { dealShape } from "#/data/dealShape";

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
 *  - A URL into a half the viewer cannot see — typed, bookmarked, or linked —
 *    sends them to the Overview, which belongs to neither half and is therefore
 *    always theirs. `visibleNavGroups` drops those items from the sidebar, but a
 *    URL walks straight past a sidebar.
 *
 * It carries a third, unrelated wall for the same reason — a sidebar cannot stop
 * a URL. A deal missing the content its marketing output is built from
 * (`useMarketingReadiness`) sends every gated section to the Listing form, which
 * is where that content is entered. Access says *may you*; readiness says *is
 * there anything to render*. They are answered together only because they share
 * the redirect.
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
  const { ready } = useMarketingReadiness(listing);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const section = pathname.startsWith(`${basePath}/`)
    ? pathname.slice(basePath.length + 1).split("/")[0]
    : "";
  const blocked =
    (access.backOffice === "none" && BACK_OFFICE_HREFS.includes(section)) ||
    (access.marketing === "none" && MARKETING_HREFS.includes(section)) ||
    // A shell has no voucher of its own — `backOffice` there means "may open the
    // Vouchers index", not "may see money". `visibleNavGroups` already drops
    // these two items for a shell, and this is the URL that walks past it.
    (dealShape(listing) === "shell" &&
      (section === "financials" || section === "financial-documents"));
  // Sent to the Listing form, not the Overview: the Overview is where an
  // access redirect lands because it belongs to neither half, but an unready
  // deal is being sent somewhere to *do* something, and the form is the only
  // page that clears the gate.
  const unready = !ready && MARKETING_GATED_HREFS.includes(section);

  useEffect(() => {
    if (blocked) void navigate({ to: `${basePath}/overview`, replace: true });
    else if (unready) void navigate({ to: `${basePath}/listing`, replace: true });
  }, [blocked, unready, basePath, navigate]);

  if (!canOpenDeal(access)) return <NoAccess listing={listing} />;
  if (blocked || unready) return null;
  return <>{children}</>;
}
