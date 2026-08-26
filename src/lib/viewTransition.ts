import { flushSync } from "react-dom";

type ViewTransition = {
  ready: Promise<void>;
  finished: Promise<void>;
  updateCallbackDone: Promise<void>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransition;
};

/**
 * Run a state update inside a View Transition, so a layout change animates
 * instead of snapping.
 *
 * Used for changes that move a *whole panel* — the assistant rail expanding to
 * full screen and collapsing back. Animating that in CSS means animating the
 * width of a flex item while the page beside it collapses to nothing, which
 * reflows the page's own content every frame; the browser's snapshot-and-morph
 * costs no reflow at all and cross-fades the page out on the way.
 *
 * `flushSync` is what makes it work: `startViewTransition` snapshots the DOM,
 * calls this callback, then snapshots again — so the update has to commit
 * *inside* the callback. A plain `setState` would still be queued when the
 * second snapshot is taken, and the transition would animate nothing.
 *
 * Falls back to applying the update immediately: unsupported browsers, and
 * anyone who asked for reduced motion, get today's instant switch.
 */
export function withViewTransition(update: () => void): void {
  const doc = document as ViewTransitionDocument;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduced || typeof doc.startViewTransition !== "function") {
    update();
    return;
  }
  const transition = doc.startViewTransition(() => flushSync(update));
  // A skipped transition rejects its promises, and there is more than one way to
  // get skipped: a hidden tab (frames never run there), or a second toggle
  // landing while the first is still animating. The DOM change has been applied
  // regardless — that is what the callback did — so there is nothing to recover
  // from, and an unhandled rejection per impatient double-click is not a useful
  // thing to log.
  const ignore = () => {};
  void transition.ready?.catch(ignore);
  void transition.finished?.catch(ignore);
  void transition.updateCallbackDone?.catch(ignore);
}
