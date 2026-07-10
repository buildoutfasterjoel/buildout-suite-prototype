import { lazy, Suspense, useEffect, useState } from "react";
import type { DemographicRing } from "#/data/listingDemographics";

// Leaflet touches `window` at module-load time, so it must never be imported on
// the server. Loading it lazily — and only after the client has mounted — keeps
// the dynamic import out of the SSR render path (same pattern as PropertyMap.tsx).
const DemographicsMapInner = lazy(() => import("./DemographicsMapInner"));

export function DemographicsMap({
  center,
  rings,
}: {
  center: { lat: number; lng: number };
  rings: DemographicRing[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const placeholder = (
    <div style={{ height: "100%", width: "100%" }} className="bg-body-secondary rounded" />
  );

  if (!mounted) return placeholder;

  return (
    <Suspense fallback={placeholder}>
      <DemographicsMapInner center={center} rings={rings} />
    </Suspense>
  );
}
