import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Listing } from "#/data/types";
import { getProperty } from "#/data/store";
import {
  TYPE_COLORS,
  TYPE_LABELS,
  STATUS_LABELS,
} from "./propertyDisplay";
import { dealHeadlineLabel } from "#/components/deals/dealDisplay";

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

export default function PropertyMapInner({ listings }: { listings: Listing[] }) {
  const points = useMemo<[number, number][]>(
    () =>
      listings.map((l) => {
        const p = getProperty(l.propertyId);
        return [p?.lat ?? 0, p?.lng ?? 0];
      }),
    [listings],
  );

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
      {listings.map((p) => {
        const prop = getProperty(p.propertyId);
        return (
          <Marker
            key={p.id}
            position={[prop?.lat ?? 0, prop?.lng ?? 0]}
            icon={pinIcon(prop ? TYPE_COLORS[prop.propertyType] : "#64748b")}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div className="fw-semibold mb-1">{p.name}</div>
                <div className="text-muted fs-xs mb-2">
                  {prop?.street}, {prop?.city}, {prop?.state}
                </div>
                <div className="d-flex justify-content-between gap-3">
                  <span>{prop ? TYPE_LABELS[prop.propertyType] : ""}</span>
                  <span className="fw-semibold">
                    {dealHeadlineLabel(p)}
                  </span>
                </div>
                <div className="text-muted fs-xs mt-1">
                  {STATUS_LABELS[p.status]}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
