import type { CSSProperties } from "react";
import { Placeholder } from "@buildoutinc/blueprint-react/ui/Placeholder";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock } from "@fortawesome/pro-regular-svg-icons";

/**
 * The two ways a private contact's details hide from a Managing Director who
 * can see the record exists but hasn't been granted access.
 *
 * `HiddenValue` stands where a single value would be — an email, a phone, a
 * field, a table cell — as a muted rectangle of roughly the value's width. It
 * borrows the skeleton-loader shape on purpose: the reader already knows that
 * shape means "there's something here you're not seeing yet".
 *
 * `HiddenBlock` stands where a list or a feed would be, and says why.
 */
export function HiddenValue({
  width = "60%",
  height = 14,
  className = "",
  style,
}: {
  width?: number | string;
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Placeholder
      className={`rounded d-inline-block align-middle ${className}`}
      style={{ width, height, opacity: 0.35, ...style }}
      aria-label="Hidden — private contact"
    />
  );
}

/** A stack of hidden lines, for a details panel or a briefing body. */
export function HiddenLines({ widths }: { widths: Array<number | string> }) {
  return (
    <div className="d-flex flex-column gap-2" aria-label="Hidden — private contact">
      {widths.map((w, i) => (
        <HiddenValue key={i} width={w} />
      ))}
    </div>
  );
}

export function HiddenBlock({
  what,
  plural = true,
}: {
  /** "Timeline", "Deals", "Listing Inquiries", … — the section's own name. */
  what: string;
  /** Verb agreement: "Deals are hidden" vs "Timeline is hidden". */
  plural?: boolean;
}) {
  return (
    <div className="hidden-block d-flex align-items-start gap-2 rounded bg-storm-grey-50 px-3 py-3 text-muted">
      <FontAwesomeIcon icon={faLock} className="mt-1 flex-shrink-0" />
      <span>
        {what} {plural ? "are" : "is"} hidden because this is a private contact.
      </span>
    </div>
  );
}
