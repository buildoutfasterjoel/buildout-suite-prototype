import { useEffect, useRef, useState } from "react";
import { advanceReveal, sliceToWord } from "./revealText";

/** True when the viewer has asked their OS for less animation. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Pace out an assistant reply as it arrives. See `revealText.ts` for why this
 * exists and why it runs in every environment rather than only on Amplify.
 *
 * `animate` is read **once, at mount**, deliberately. A live turn mounts while
 * the request is in flight and reveals; every message already on screen when
 * the transcript loads mounts complete and renders complete. Re-reading it
 * later would make a finished reply snap to full the moment `isLoading`
 * flipped, cutting off the very animation this is for.
 */
export function useRevealedText(
  full: string,
  animate: boolean,
): { text: string; done: boolean; revealing: boolean } {
  // Captured at mount — see above. Reduced motion opts out entirely.
  const animating = useRef(animate && !prefersReducedMotion());
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const fullRef = useRef(full);
  fullRef.current = full;

  useEffect(() => {
    if (!animating.current) return;
    if (countRef.current >= full.length) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      countRef.current = advanceReveal(countRef.current, fullRef.current.length, dt);
      setCount(countRef.current);
      // Stop once caught up rather than spinning a frame loop forever. More
      // text arriving changes `full`, which re-runs this effect and starts a
      // fresh loop — so the animation resumes without anything polling for it.
      if (countRef.current < fullRef.current.length) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [full]);

  if (!animating.current) return { text: full, done: true, revealing: false };

  const done = count >= full.length;
  return { text: done ? full : sliceToWord(full, Math.floor(count)), done, revealing: true };
}
