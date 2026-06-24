import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Listing } from "#/data/types";
import {
  TYPE_COLORS,
  TYPE_LABELS,
  STATUS_LABELS,
  formatPrice,
} from "./propertyDisplay";

const US_CENTER: [number, number] = [39.5, -98.5];

/** Teardrop pin colored by property type — avoids Leaflet's default PNG asset paths. */
function pinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "property-map-pin",
    html: `<span style="
      display:block;width:18px;height:18px;
      background:${color};
      border:2px solid #fff;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 1px 4px rgba(0,0,0,.4);"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
    popupAnchor: [0, -18],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 12);
      return;
    }
    map.fitBounds(points, { padding: [48, 48] });
  }, [points, map]);
  return null;
}

export function PropertyMap({ listings }: { listings: Listing[] }) {
  // Leaflet touches the DOM/window — render only on the client after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const points = useMemo<[number, number][]>(
    () => listings.map((l) => [l.lat, l.lng]),
    [listings],
  );

  if (!mounted) {
    return (
      <div
        style={{ height: "100%", width: "100%" }}
        className="bg-body-secondary"
      />
    );
  }

  return (
    <MapContainer
      center={US_CENTER}
      zoom={4}
      scrollWheelZoom
      className="border rounded"
      style={{
        height: "100%",
        width: "100%",
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {listings.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={pinIcon(TYPE_COLORS[p.propertyType])}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <div className="fw-semibold mb-1">{p.name}</div>
              <div className="text-muted fs-xs mb-2">
                {p.street}, {p.city}, {p.state}
              </div>
              <div className="d-flex justify-content-between gap-3">
                <span>{TYPE_LABELS[p.propertyType]}</span>
                <span className="fw-semibold">
                  {formatPrice(p.askingPrice)}
                </span>
              </div>
              <div className="text-muted fs-xs mt-1">
                {STATUS_LABELS[p.status]}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
