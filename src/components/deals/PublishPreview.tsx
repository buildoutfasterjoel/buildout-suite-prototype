import type { ReactNode } from "react";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faFile,
  faImages,
  faSparkle,
} from "@fortawesome/pro-regular-svg-icons";
import { faTriangleExclamation } from "@fortawesome/pro-duotone-svg-icons";
import type { Listing, Property } from "#/data/types";
import {
  REQUIRED_FIELD_LABEL,
  unsatisfiedRequired,
  type GateConfig,
  type GateFormState,
} from "#/data/stageGates";
import { buildPublishPreview, type PreviewRow } from "#/data/publishPreview";

function Row({ row }: { row: PreviewRow }) {
  const missing = row.status === "missing";
  return (
    <>
      <dt className="col-4 fw-normal text-muted">{row.label}</dt>
      <dd className={`col-8 mb-1 ${missing ? "text-warning-emphasis" : ""}`}>
        {missing ? (
          <span className="d-inline-flex align-items-center gap-2">
            <span className="fst-italic">Not set</span>
            {/* Badge supports only primary | secondary | outline. */}
            <Badge variant="outline">Required</Badge>
          </span>
        ) : (
          (row.value ?? "—")
        )}
      </dd>
    </>
  );
}

/**
 * The listing as it will appear once published — shown in place of the publish
 * gate's field form. Content gaps are surfaced as flagged rows the broker fixes
 * in the marketing editor; the document-review attestation and the listing dates
 * stay actionable here, since neither has an editor equivalent.
 */
export function PublishPreview({
  deal,
  property,
  config,
  form,
  reviewedDocIds,
  onToggleReviewed,
  dateFields,
}: {
  deal: Listing;
  property: Property | undefined;
  config: GateConfig;
  form: GateFormState;
  reviewedDocIds: Set<string>;
  onToggleReviewed: (docId: string, reviewed: boolean) => void;
  dateFields: ReactNode;
}) {
  const model = buildPublishPreview(deal, property, form, config);
  // Every gating requirement, not just the ones with a row in `model.sections` —
  // `aiDocsReviewed` and the two listing dates gate `canConfirm` too, but have no
  // row of their own.
  const gapLabels = unsatisfiedRequired(config, form).map((f) => REQUIRED_FIELD_LABEL[f]);

  return (
    <div className="d-flex flex-column gap-3">
      {gapLabels.length > 0 && (
        <Alert severity="warning" withIcon>
          {/* `withIcon` only reserves the gutter — the icon must be a direct child. */}
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <Alert.Title>
            {gapLabels.length} {gapLabels.length === 1 ? "item needs" : "items need"}{" "}
            attention before this goes live
          </Alert.Title>
          {gapLabels.join(", ")}
        </Alert>
      )}

      {model.sections.map((section) => (
        <div key={section.id} className="border rounded p-3 bg-body-tertiary">
          <div className="fw-semibold mb-2">{section.title}</div>
          <dl className="row g-0 mb-0">
            {section.rows.map((row) => (
              <Row key={row.label} row={row} />
            ))}
          </dl>
        </div>
      ))}

      {dateFields}

      <div className="border rounded p-3 bg-body-tertiary">
        <div className="fw-semibold mb-2 d-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faImages} className="text-muted" />
          Media
          <span className="text-muted fw-normal fs-small">
            {model.photos.length}
          </span>
        </div>
        <div className="d-flex gap-2 overflow-x-auto">
          {model.photos.map((src, i) => (
            /* `listingGallery` leads with the deal's hero photo, so index 0 is
               the image already shown on the deal card — flag it as primary. */
            <div
              key={src}
              className="position-relative flex-shrink-0"
              style={{ width: 108, height: 72 }}
            >
              <img
                src={src}
                alt={
                  i === 0
                    ? `${deal.name} primary listing photo`
                    : `${deal.name} listing photo ${i + 1}`
                }
                className="rounded border w-100 h-100"
                style={{ objectFit: "cover" }}
              />
              {i === 0 && (
                <Badge
                  variant="primary"
                  className="position-absolute top-0 start-0 m-1 fs-xs"
                >
                  Primary
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded p-3 bg-body-tertiary">
        <div className="fw-semibold mb-2 d-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faFile} className="text-muted" />
          Documents
        </div>
        {model.documents.length === 0 ? (
          <div className="text-muted">No documents on this deal.</div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {model.documents.map((doc) =>
              doc.aiGenerated ? (
                <div
                  key={doc.id}
                  className="d-flex align-items-center justify-content-between gap-2"
                >
                  <label
                    className="d-flex align-items-center gap-2 mb-0"
                    style={{ cursor: "pointer" }}
                  >
                    <Checkbox
                      checked={reviewedDocIds.has(doc.id)}
                      onCheckedChange={(c) => onToggleReviewed(doc.id, c === true)}
                    />
                    <span className="flex-grow-1">{doc.name}</span>
                    <Badge variant="secondary">
                      <FontAwesomeIcon icon={faSparkle} />
                      Review
                    </Badge>
                  </label>
                  <a
                    href={`/listings/${deal.id}/documents`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-nowrap"
                  >
                    Open <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                  </a>
                </div>
              ) : (
                <div key={doc.id} className="d-flex align-items-center gap-2">
                  <span className="flex-grow-1">{doc.name}</span>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
