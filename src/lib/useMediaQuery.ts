import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query from React.
 *
 * `useSyncExternalStore` rather than an effect + state: the server has no
 * `matchMedia`, so `getServerSnapshot` answers `false` during SSR and React
 * re-reads the real value on hydration instead of flashing the wrong layout and
 * warning about a mismatch.
 *
 * Layout that CSS can express should stay in CSS. Reach for this only when the
 * breakpoint changes the component *tree* — moving a card from one column into
 * another, say, which no media query can do.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * The contact detail page's breakpoint. Below this the three-column layout runs
 * out of room — the middle column gets too narrow to read a timeline row in —
 * so the right column's cards relocate (see the narrowLayout preference).
 */
export const CONTACT_NARROW_QUERY = "(max-width: 1279.98px)";

/**
 * Whether the contact page should use its narrow arrangement, given the viewport
 * and whether the assistant rail is taking its 380px.
 *
 * The rail counts as narrow outright, at any width. The page is capped at 96rem
 * and the rail comes off the top of that, so three columns never really survive
 * it — even at 1700px the middle column ends up clipping its own Log Activity
 * tab row. A width threshold was tried here first and let that case through.
 */
export function useContactNarrow(railOpen: boolean): boolean {
  const viewportNarrow = useMediaQuery(CONTACT_NARROW_QUERY);
  return viewportNarrow || railOpen;
}
