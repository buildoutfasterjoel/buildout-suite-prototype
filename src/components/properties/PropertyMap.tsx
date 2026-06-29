import { lazy, Suspense, useEffect, useState } from "react";
import type { Listing } from "#/data/types";

// Leaflet touches `window` at module-load time, so it must never be imported on
// the server. Loading it lazily — and only after the client has mounted — keeps
// the dynamic import out of the SSR render path.
const PropertyMapInner = lazy(() => import("./PropertyMapInner"));

export function PropertyMap({ listings }: { listings: Listing[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const placeholder = (
    <div style={{ height: "100%", width: "100%" }} className="bg-body-secondary" />
  );

  if (!mounted) return placeholder;

  return (
    <Suspense fallback={placeholder}>
      <PropertyMapInner listings={listings} />
    </Suspense>
  );
}
