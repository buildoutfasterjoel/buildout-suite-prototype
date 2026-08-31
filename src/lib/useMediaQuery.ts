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
 * How much page width the docked assistant rail takes: its 380px box plus the
 * 8px inset the app shell floats it on. Mirrors `$rail-width + $rail-inset` in
 * `main.scss` — keep the two in sync.
 *
 * That is the app-mode figure. Classic nav has no inset to float on, so there
 * the rail costs 380 and this over-counts by 8px. Deliberately the app-mode
 * number rather than a per-mode pair: over-counting drops to two columns 8px
 * earlier than it strictly must, which errs toward the readable layout, and one
 * constant is worth more here than 8px of reach.
 */
export const RAIL_TOTAL_WIDTH = 388;

/**
 * The contact detail page's breakpoint (the Blueprint `xl` token). Below this
 * the three-column layout runs out of room — the middle column gets too narrow
 * to read a timeline row in — so the right column's cards relocate (see the
 * narrowLayout preference).
 */
export const CONTACT_NARROW_QUERY = "(max-width: 1279.98px)";

/**
 * The same threshold shifted by the docked rail's width: with 388px gone to
 * the rail, the viewport must be that much wider before three columns fit.
 */
export const CONTACT_NARROW_RAILED_QUERY = `(max-width: ${1280 + RAIL_TOTAL_WIDTH - 0.02}px)`;

/**
 * Whether the contact page should use its narrow arrangement, given the
 * viewport and whether the assistant rail is taking its 388px.
 *
 * The rail doesn't force narrow outright — it shifts the breakpoint by its own
 * width, so the question is always "does what's left fit three columns?". A
 * 1920px monitor keeps all three columns with the rail open; a 1440px laptop
 * drops to two.
 *
 * An earlier attempt at a width threshold here appeared to fail (three columns
 * clipped even at 1700px with the rail open), but the real culprit was the
 * page cap: it pulled in to 72rem whenever the rail opened, which made three
 * columns impossible at ANY monitor size. The cap now follows the column
 * count instead (see the contact detail route), so the threshold works.
 *
 * Both queries stay subscribed so toggling the rail flips the answer
 * synchronously instead of tearing down and re-arming a listener.
 */
export function useContactNarrow(railOpen: boolean): boolean {
  const viewportNarrow = useMediaQuery(CONTACT_NARROW_QUERY);
  const railedNarrow = useMediaQuery(CONTACT_NARROW_RAILED_QUERY);
  return railOpen ? railedNarrow : viewportNarrow;
}
