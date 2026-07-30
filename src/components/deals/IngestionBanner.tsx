import { Link } from "@tanstack/react-router";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleInfo,
  faCircleCheck,
  faTriangleExclamation,
} from "@fortawesome/pro-duotone-svg-icons";
import { faSpinnerThird } from "@fortawesome/pro-regular-svg-icons";
import { INGESTION_STAGES, unresolvedCount } from "#/data/ingestion";
import { dismissIngestion } from "#/data/actions";
import type { Listing } from "#/data/types";

/**
 * Aligns the banner with the overview column's own gutter (the page header uses
 * `px-4`, the planner `p-4`) so it reads as part of that panel rather than a
 * full-width bar across the top of the page. Vertical spacing comes from the
 * header's and planner's padding, so there is none of its own.
 */
const BANNER_CLASS = "mx-4";

/**
 * The document-ingestion banner, sitting under the Overview title inside the
 * overview column. A pure reader of `listing.ingestion` — the IngestionWatcher in
 * the AppShell owns the run, so this stays correct whether the broker watched it
 * or came back later.
 */
export function IngestionBanner({ listing }: { listing: Listing }) {
  const ingestion = listing.ingestion;
  if (!ingestion) return null;

  if (ingestion.status === "processing") {
    const stage = INGESTION_STAGES[ingestion.stage];
    return (
      <Alert severity="info" withIcon className={BANNER_CLASS}>
        <FontAwesomeIcon icon={faCircleInfo} />
        <Alert.Title className="d-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faSpinnerThird} spin />
          {stage.label}
        </Alert.Title>
        <div className="d-flex flex-column gap-1">
          <span>{stage.detail}</span>
          <span className="text-muted fs-small">
            {ingestion.documents.join(" · ")}
          </span>
        </div>
      </Alert>
    );
  }

  if (ingestion.status === "needs-review") {
    const remaining = unresolvedCount(ingestion);
    return (
      <Alert severity="warning" withIcon className={BANNER_CLASS}>
        <FontAwesomeIcon icon={faTriangleExclamation} />
        <Alert.Title>
          {remaining} {remaining === 1 ? "field needs" : "fields need"} your
          confirmation
        </Alert.Title>
        <div className="d-flex flex-column align-items-start gap-2">
          <span>
            Buildout filled {ingestion.filledCount} fields from your documents.
            These disagree with what&rsquo;s on record — confirm them to finish.
          </span>
          <Button
            variant="primary"
            size="sm"
            nativeButton={false}
            render={
              <Link
                to="/listings/$listingId/edit"
                params={{ listingId: listing.id }}
                search={{ review: "ingestion" }}
              />
            }
          >
            Review fields
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    // The icon stays a direct child — the theme absolutely positions it via
    // `.alert-icon > svg`. Dismiss sits to the right of the copy rather than
    // stacked under it, which keeps this success state one row shorter.
    <Alert severity="success" withIcon className={BANNER_CLASS}>
      <FontAwesomeIcon icon={faCircleCheck} />
      <div className="d-flex align-items-center justify-content-between gap-3">
        <div>
          <Alert.Title>
            Buildout filled {ingestion.filledCount} fields
          </Alert.Title>
          <span>
            Everything we found in your documents is on the deal. It&rsquo;s
            ready to publish once you review the generated documents.
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="flex-shrink-0"
          onClick={() => dismissIngestion(listing.id)}
        >
          Dismiss
        </Button>
      </div>
    </Alert>
  );
}
