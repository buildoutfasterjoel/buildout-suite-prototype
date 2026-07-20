import { useLayoutEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/pro-regular-svg-icons";

/**
 * Body text clamped to `lines` (default 2). When the content actually overflows
 * that height, a "Show more" / "Show less" toggle appears — styled like the
 * timeline's "View full thread" link. Used for the missed-call voicemail
 * transcript, which can run long.
 */
export function ClampText({ text, lines = 2 }: { text: string; lines?: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measure against the clamped height regardless of the current expanded
    // state so the toggle stays visible once revealed.
    setOverflows(el.scrollHeight - el.clientHeight > 1);
  }, [text, lines]);

  return (
    <div className="tl-clamp">
      <p
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
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          className={`tl-convo__more ${expanded ? "is-open" : ""}`}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Show more"}
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      )}
    </div>
  );
}
