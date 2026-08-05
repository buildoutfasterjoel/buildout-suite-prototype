import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Event content clamped to `lines` (default 2), with a "Show more" / "Show less"
 * link that appears only when the content actually overflows. Every row's content
 * runs through this — one long note could otherwise set the height of the whole
 * feed, which makes the timeline impossible to scan.
 *
 * Takes children rather than a text prop so a row can clamp a bullet list or
 * several paragraphs as one block instead of line by line.
 */
export function ClampText({
  children,
  lines = 2,
}: {
  children: ReactNode;
  lines?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Only measure while clamped. Once expanded the element no longer overflows, so
  // re-measuring would hide the toggle and strand the reader in the expanded view
  // with no way back.
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setOverflows(el.scrollHeight - el.clientHeight > 1);
  }, [expanded]);

  useLayoutEffect(() => {
    measure();
    // One measurement on mount isn't enough. The web font lands *after* first
    // layout and changes how many lines the text takes, so text that ends up
    // fitting is measured mid-fallback-font and reports an overflow it doesn't
    // have — which is how every row came to show a "Show more" that did nothing.
    // The observer covers the other mover: the column's width.
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    const el = ref.current;
    const ro =
      el && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measure())
        : null;
    ro?.observe(el!);
    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [children, lines, measure]);

  return (
    <div className="tl-clamp">
      <div
        ref={ref}
        className="tl-clamp__text"
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: lines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
        }
      >
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          className="tl-link"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
