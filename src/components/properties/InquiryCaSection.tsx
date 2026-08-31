import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpFromBracket,
  faCircleCheck,
  faFilePdf,
  faTrash,
} from "@fortawesome/pro-regular-svg-icons";
import { updateInquiry } from "#/data/actions";
import { type Inquiry, caFileNameFor } from "./inquiryRow";

function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/**
 * The confidentiality agreement on one inquiry.
 *
 * The upload is a prototype gesture — there is no file picker and no bytes.
 * Pressing it names a plausible file, stamps today and flips the inquiry to
 * signed, which is the whole of what the demo needs to show.
 *
 * CA status is not new vocabulary: the Inquiries toolbar already ships a
 * "CA Status — Signed / Not Signed" filter that had nothing behind it.
 */
export function InquiryCaSection({ inquiry }: { inquiry: Inquiry }) {
  const upload = () =>
    updateInquiry(inquiry.id, inquiry.listingId, {
      caSigned: true,
      caFileName: caFileNameFor(inquiry.name),
      caSignedAt: today(),
    });

  const remove = () =>
    updateInquiry(inquiry.id, inquiry.listingId, {
      caSigned: false,
      caFileName: undefined,
      caSignedAt: undefined,
    });

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
        <div className="fw-semibold fs-large">Confidentiality Agreement</div>
        <Badge
          variant={inquiry.caSigned ? "primary" : "secondary"}
          appearance="muted"
        >
          {inquiry.caSigned ? (
            <>
              <FontAwesomeIcon icon={faCircleCheck} />
              Signed
            </>
          ) : (
            "Not signed"
          )}
        </Badge>
      </div>

      {inquiry.caFileName ? (
        <div className="d-flex align-items-center gap-2 rounded border p-2">
          <FontAwesomeIcon icon={faFilePdf} className="text-danger" />
          <div style={{ minWidth: 0 }}>
            <div className="fw-semibold text-truncate">
              {inquiry.caFileName}
            </div>
            <div className="text-muted fs-small">
              Signed {inquiry.caSignedAt}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ms-auto"
            aria-label="Remove the signed CA"
            onClick={remove}
          >
            <FontAwesomeIcon icon={faTrash} />
          </Button>
        </div>
      ) : (
        <div className="inquiry-ca__dropzone rounded border p-3 text-center">
          {/* Signed with no document means a broker marked it by hand. Saying
              "no signed CA" there contradicts the Signed badge above it. */}
          <div className="text-muted mb-2">
            {inquiry.caSigned
              ? "Marked signed outside the app — no document on file."
              : "No signed CA on file for this inquiry."}
          </div>
          <Button variant="outline" onClick={upload}>
            <FontAwesomeIcon icon={faArrowUpFromBracket} />
            Upload signed CA
          </Button>
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between gap-3 border-bottom py-2 mt-2">
        <span className="text-muted">Mark CA as signed</span>
        <Switch
          checked={inquiry.caSigned}
          onCheckedChange={(c) =>
            updateInquiry(inquiry.id, inquiry.listingId, {
              caSigned: c === true,
              // Marking it signed by hand records the date but names no file:
              // the broker took the agreement outside the app.
              ...(c === true
                ? { caSignedAt: inquiry.caSignedAt ?? today() }
                : { caFileName: undefined, caSignedAt: undefined }),
            })
          }
          aria-label={`Mark the CA signed for ${inquiry.name}`}
        />
      </div>
    </div>
  );
}
