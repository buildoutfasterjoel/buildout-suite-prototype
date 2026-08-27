import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare } from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/**
 * One record, one line: a colored glyph badge, a title, and a muted meta line.
 *
 * Extracted from the omni menu so the assistant rail can show the same row for
 * the same records (Figma 276:20447 deal, 276:20455 contact). A contact found by
 * search and a contact Otto just looked up are the same object, and they were
 * being drawn two different ways — the menu's tight 36px row, and in the rail a
 * full deal card with a photo, a stage chip and a price. Same record, same row.
 *
 * The badge colour carries the record type, which is why the rail's cards can
 * drop the "Contact" / "Deal" label the menu shows on the right and put the
 * way-out affordance there instead.
 */
export type RecordIconVariant = "contact" | "property" | "deal" | "ai";

/** The 36px colored icon badge that leads each row. */
export function RecordRowIcon({
  variant,
  icon,
}: {
  variant: RecordIconVariant;
  icon: IconDefinition;
}) {
  return (
    <span className={`omni-item__icon omni-item__icon--${variant}`}>
      <FontAwesomeIcon icon={icon} />
    </span>
  );
}

/** Title over meta, both truncating. `title` takes a node so the menu can pass
 * its highlighted match markup and the rail can pass a plain string. */
export function RecordRowLabel({ title, meta }: { title: ReactNode; meta?: ReactNode }) {
  return (
    <span className="omni-item__label">
      <span className="omni-item__title text-truncate">{title}</span>
      {meta && <span className="omni-item__meta text-truncate">{meta}</span>}
    </span>
  );
}

/**
 * The record row as a standalone card — bordered, on its own, with an
 * external-link glyph where the menu puts its type label.
 *
 * A real `<Link>`, not a button: this is the kind of card a broker cmd-clicks to
 * read the record without losing the conversation that produced it. `onOpen` is
 * the escape hatch for a destination that isn't a URL — a property card lands on
 * the Deals grid and has to apply a filter first, which is a handler's job.
 */
export function RecordCard({
  variant,
  icon,
  title,
  meta,
  link,
  onOpen,
}: {
  variant: RecordIconVariant;
  icon: IconDefinition;
  title: string;
  meta?: string;
  /** Router destination, as `dealCardLinkProps` and friends produce it. */
  link?: { to: string; params?: Record<string, string> };
  onOpen?: () => void;
}) {
  const inner = (
    <>
      <RecordRowIcon variant={variant} icon={icon} />
      <RecordRowLabel title={title} meta={meta} />
      <span className="omni-item__go" aria-hidden="true">
        <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
      </span>
    </>
  );
  const className = "omni-item omni-item--card";

  if (link) {
    return (
      // `as never` on the route params, the same cast every other card surface
      // uses: the destination is computed (a space deal nests under its
      // building), so it can't be checked against the route tree here.
      <Link {...(link as { to: string })} className={className as never}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onOpen}>
      {inner}
    </button>
  );
}
