import { Link } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faFile,
  faFilePdf,
  faFileSpreadsheet,
} from "@fortawesome/pro-regular-svg-icons";
import type { TimelineAttachment } from "#/components/contacts/timeline";

/** Pick a file-type icon from the attachment's extension. */
function attachmentIcon(name: string) {
  if (/\.pdf$/i.test(name)) return faFilePdf;
  if (/\.(xlsx?|csv)$/i.test(name)) return faFileSpreadsheet;
  return faFile;
}

/**
 * One attached document: type glyph, name over a size/format line, and a
 * download affordance. A deal-linked attachment (e.g. a sent BOV) opens that
 * deal's document editor instead.
 */
export function AttachmentChip({ attachment }: { attachment: TimelineAttachment }) {
  const inner = (
    <>
      <FontAwesomeIcon
        icon={attachmentIcon(attachment.name)}
        className="tl-attach__icon"
      />
      <span className="tl-attach__label">
        <span className="tl-attach__name">{attachment.name}</span>
        {attachment.meta && <span className="tl-attach__meta">{attachment.meta}</span>}
      </span>
      <FontAwesomeIcon icon={faDownload} className="tl-attach__end" />
    </>
  );
  return attachment.dealId ? (
    <Link
      to="/editor/$listingId"
      params={{ listingId: attachment.dealId }}
      search={{ focus: "underwriting" }}
      className="tl-attach__chip tl-attach__chip--link"
    >
      {inner}
    </Link>
  ) : (
    <div className="tl-attach__chip">{inner}</div>
  );
}

