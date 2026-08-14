import { lazy, Suspense, useEffect, useState } from "react";
import "#/components/listings/edit/listingForm.scss";

// Leaflet touches `window` at module-load time, so it must never be imported on
// the server. Loading it lazily — and only after the client has mounted — keeps
// the dynamic import out of the SSR render path. Same shape as `PropertyMap`.
const CoordinatePickerMapInner = lazy(() => import("./CoordinatePickerMapInner"));

/**
 * A small square map beside the Latitude/Longitude pair: shows where the pin
 * currently sits, and drops it somewhere new on click.
 *
 * The map is a second way to edit the same two fields, not a separate source of
 * truth — every click reports back through `onPick` and the caller patches the
 * draft, so typing and clicking stay in agreement.
 */
export function CoordinatePickerMap({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const placeholder = (
    <div className="bg-body-secondary border rounded h-100 w-100" />
  );

  return (
    <div className="listing-form__coord-map">
      {mounted ? (
        <Suspense fallback={placeholder}>
          <CoordinatePickerMapInner lat={lat} lng={lng} onPick={onPick} />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}
