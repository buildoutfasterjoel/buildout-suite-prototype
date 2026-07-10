import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DemographicRing } from "#/data/listingDemographics";

const MILES_TO_METERS = 1609.34;
const RING_COLOR = "#2563eb";

function centerPinIcon(): L.DivIcon {
  return L.divIcon({
    className: "property-map-pin",
    html: `<span style="
      display:block;width:18px;height:18px;
      background:${RING_COLOR};
      border:2px solid #fff;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 1px 4px rgba(0,0,0,.4);"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
  });
}

/** Fits the map to the largest ring's radius, refitting whenever rings change. */
function FitToRings({
  center,
  maxRadiusMiles,
}: {
  center: [number, number];
  maxRadiusMiles: number;
}) {
  const map = useMap();
  useEffect(() => {
    const latOffset = maxRadiusMiles / 69;
    const lngOffset = maxRadiusMiles / (69 * Math.cos((center[0] * Math.PI) / 180));
    map.fitBounds(
      [
        [center[0] - latOffset, center[1] - lngOffset],
        [center[0] + latOffset, center[1] + lngOffset],
      ],
      { padding: [24, 24] },
    );
  }, [center, maxRadiusMiles, map]);
  return null;
}

export default function DemographicsMapInner({
  center,
  rings,
}: {
  center: { lat: number; lng: number };
  rings: DemographicRing[];
}) {
  const point: [number, number] = [center.lat, center.lng];
  const maxRadiusMiles = Math.max(0.1, ...rings.map((r) => r.radiusMiles));

  // Largest ring first so smaller rings layer on top with a stronger fill.
  const sortedRings = useMemo(
    () => [...rings].sort((a, b) => b.radiusMiles - a.radiusMiles),
    [rings],
  );

  return (
    <MapContainer
      center={point}
      zoom={13}
      scrollWheelZoom
      className="border rounded"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToRings center={point} maxRadiusMiles={maxRadiusMiles} />
      {sortedRings.map((ring, i) => (
        <Circle
          key={ring.id}
          center={point}
          radius={ring.radiusMiles * MILES_TO_METERS}
          pathOptions={{
            color: RING_COLOR,
            weight: 1.5,
            fillColor: RING_COLOR,
            fillOpacity: 0.06 + (i / Math.max(1, sortedRings.length - 1)) * 0.14,
          }}
        />
      ))}
      <Marker position={point} icon={centerPinIcon()} />
    </MapContainer>
  );
}
