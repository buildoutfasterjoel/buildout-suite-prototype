import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/pro-regular-svg-icons";

/**
 * The task completion checkbox (Figma "TaskCheckbox"). States: Default, Hover
 * (reveals a gray checkmark), CheckAnim, CheckAnimEnd, and Checked.
 *
 * Checking runs a short sequence before the completion is committed, so the
 * task reads as *completed* rather than just vanishing:
 *
 *   1. `anim`   — the box grows and tilts on a green fill with a white check
 *   2. `settle` — it springs back to its base shape, still green
 *   3. `fade`   — green fades to the gray Checked state
 *   4. commit   — `onToggle` fires, and the row disappears (or restyles)
 *
 * Unchecking is immediate — the ceremony is only for finishing something. Under
 * `prefers-reduced-motion` the sequence is skipped entirely.
 */

/** How long each phase of the completion sequence holds, in ms. */
const PHASE_MS = { anim: 200, settle: 320, fade: 340 } as const;

type Phase = "idle" | "anim" | "settle" | "fade";

export function TaskCheckbox({
  checked,
  onToggle,
  className,
}: {
  checked: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<number[]>([]);

  // Drop pending timers if the row unmounts mid-sequence (e.g. a filter change).
  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  const handleClick = () => {
    // Ignore repeat clicks while the sequence is playing.
    if (phase !== "idle") return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (checked || reduced) {
      onToggle();
      return;
    }
    const at = (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, ms));
    };
    setPhase("anim");
    at(PHASE_MS.anim, () => setPhase("settle"));
    at(PHASE_MS.anim + PHASE_MS.settle, () => setPhase("fade"));
    at(PHASE_MS.anim + PHASE_MS.settle + PHASE_MS.fade, () => {
      setPhase("idle");
      onToggle();
    });
  };

  // `fade` renders the Checked look — the green-to-gray transition is the fade.
  const state =
    phase === "idle" ? (checked ? "checked" : "unchecked") : phase === "fade" ? "checked" : phase;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? "Mark task incomplete" : "Mark task complete"}
      className={`task-checkbox${className ? ` ${className}` : ""}`}
      data-state={state}
      onClick={handleClick}
    >
      {/* Always mounted: the hover state reveals it by color, not by insertion. */}
      <FontAwesomeIcon icon={faCheck} />
    </button>
  );
}
