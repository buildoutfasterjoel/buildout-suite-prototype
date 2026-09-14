import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useHotkey } from "@tanstack/react-hotkeys";
import { readDevModeEnabled, useDevMode } from "./useDevMode";

/** Viewport coordinates of the bar's top-left corner once it has been dragged. */
export interface BarPosition {
  left: number;
  top: number;
}

interface Size {
  width: number;
  height: number;
}

/**
 * Keeps every edge of a `size` box inside `viewport`, `inset` px clear of the
 * edges. A box wider or taller than the viewport pins to the top-left inset
 * rather than going negative, so it can always be grabbed again.
 */
export function clampToViewport(
  pos: BarPosition,
  size: Size,
  viewport: Size,
  inset = 8,
): BarPosition {
  const maxLeft = Math.max(inset, viewport.width - size.width - inset);
  const maxTop = Math.max(inset, viewport.height - size.height - inset);
  return {
    left: Math.min(Math.max(inset, pos.left), maxLeft),
    top: Math.min(Math.max(inset, pos.top), maxTop),
  };
}

/** Anything on the bar that should keep its own click rather than start a drag. */
const INTERACTIVE = "button, a, input, select, textarea, [role='button']";

/**
 * The hidden dev-mode switch and the pink bar that announces it.
 *
 * ⌘⇧D (Ctrl+Shift+D off a Mac) toggles `useDevMode`. While it is on, a pink
 * bar labelled `dev_mode` sits in the bottom-left of the viewport, above
 * everything else on screen — it exists to sit over whatever is being
 * inspected, so it is portaled to `<body>` and its z-index outranks the
 * TanStack devtools trigger. Drag it anywhere it is in the way; it stays
 * inside the viewport and re-clamps if the window shrinks.
 *
 * Hosted once, in `AppShell`, next to the other global chords. Renders nothing
 * on the server and on the first client render: the store starts off and the
 * persisted choice is restored in an effect, so hydration can never disagree.
 */
export function DevModeBar() {
  const enabled = useDevMode((s) => s.enabled);
  const setEnabled = useDevMode((s) => s.setEnabled);
  const toggle = useDevMode((s) => s.toggle);

  useEffect(() => {
    const stored = readDevModeEnabled();
    if (stored !== useDevMode.getState().enabled) setEnabled(stored);
  }, [setEnabled]);

  // Fires from inside text fields too — Mod chords get that by default, but
  // the intent is worth stating: this is a global switch, not an editing key.
  useHotkey("Mod+Shift+D", () => toggle(), { ignoreInputs: false });

  if (!enabled) return null;
  return createPortal(<Bar />, document.body);
}

interface DragOrigin {
  pointerId: number;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
}

function Bar() {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<DragOrigin | null>(null);
  // `null` is the docked home in the bottom-left, positioned by CSS. A drag
  // switches the bar to explicit top/left coordinates for the rest of the
  // session; a reload docks it again.
  const [position, setPosition] = useState<BarPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const docked = position === null;

  // A bar parked near the right or bottom edge would be lost off-screen if
  // the window then shrank. Only listens while the bar has been moved — the
  // docked position is anchored to the corner and never needs it.
  useEffect(() => {
    if (docked) return;
    const onResize = () => {
      const el = ref.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      setPosition(
        (p) =>
          p &&
          clampToViewport(
            p,
            { width, height },
            { width: window.innerWidth, height: window.innerHeight },
          ),
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [docked]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Controls that land on the bar later keep their clicks; only bare bar
    // surface starts a drag.
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
    };
    // Capturing means move/up keep arriving here even when the pointer
    // outruns the bar, so no window listeners are needed.
    el.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || e.pointerId !== d.pointerId) return;
    const { width, height } = el.getBoundingClientRect();
    setPosition(
      clampToViewport(
        {
          left: d.originLeft + (e.clientX - d.startX),
          top: d.originTop + (e.clientY - d.startY),
        },
        { width, height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  };

  // Capture is released implicitly on pointerup/pointercancel, so there is
  // nothing to undo here beyond forgetting the origin.
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    setDragging(false);
  };

  const style: CSSProperties | undefined = position
    ? { left: position.left, top: position.top, bottom: "auto" }
    : undefined;

  return (
    <div
      ref={ref}
      className={`dev-mode-bar${docked ? " dev-mode-bar--docked" : ""}`}
      role="toolbar"
      aria-label="Dev mode"
      data-dragging={dragging || undefined}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <span className="dev-mode-bar__label">dev_mode</span>
    </div>
  );
}
