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
