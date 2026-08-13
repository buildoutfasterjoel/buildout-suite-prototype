import { lazy, Suspense, useEffect, useState } from "react";
import type { Property } from "#/data/types";

// Leaflet touches `window` at module-load time, so it must never be imported on
// the server. Loading it lazily — and only after the client has mounted — keeps
// the dynamic import out of the SSR render path.
const PropertyRecordMapInner = lazy(() => import("./PropertyRecordMapInner"));

export function PropertyRecordMap({
  properties,
  selectedId,
  onSelect,
}: {
  properties: Property[];
  selectedId: string | null;
  onSelect: (propertyId: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const placeholder = (
    <div
      style={{ height: "100%", width: "100%" }}
      className="bg-body-secondary rounded"
    />
  );

  if (!mounted) return placeholder;

  return (
    <Suspense fallback={placeholder}>
      <PropertyRecordMapInner
        properties={properties}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </Suspense>
  );
}
