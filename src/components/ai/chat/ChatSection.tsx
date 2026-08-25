import { useEffect, useState, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight } from "@fortawesome/pro-regular-svg-icons";

/**
 * A finished piece of Otto's work, folded behind a one-line header — "Drafted an
 * email", "Recommended next actions", "Sent Email" (Figma nodes 193:5895,
 * 193:8991).
 *
 * This is what a tool chip *becomes*. The chip says "Drafting email ⟳" while the
 * call is in flight; the moment it lands, the chip is replaced by one of these,
 * open, carrying the artifact. Everything Otto has already done stays in the
 * transcript that way, at the weight of a line of prose rather than a stack of
 * cards.
 *
 * The header is deliberately quiet — muted body text and a 10px caret, no fill,
 * no border. It is a label, not a control surface; the artifact underneath is
 * the thing worth looking at.
 */
export function ChatSection({
  label,
  defaultOpen = true,
  collapsed = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  /**
   * Newer work of the same kind has landed below this section. Folds it shut —
   * one-way, so it won't fight a broker who reopens it to compare versions.
   */
  collapsed?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen && !collapsed);

  // Collapse on the signal rather than only at mount: the section being
  // superseded is usually the one already on screen.
  useEffect(() => {
    if (collapsed) setOpen(false);
  }, [collapsed]);

  return (
    // 12px open, 8px shut: the header sits closer to nothing than it does to a
    // artifact it's introducing (Figma 193:5894 vs 193:8991).
    <div className="d-flex flex-column" style={{ gap: open ? 12 : 8 }}>
      <button
        type="button"
        className="assistant-section__trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="assistant-section__caret">
          <FontAwesomeIcon icon={open ? faChevronDown : faChevronRight} />
        </span>
        <span>{label}</span>
      </button>
      {open && children}
    </div>
  );
}
