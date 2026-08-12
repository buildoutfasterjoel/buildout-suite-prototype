import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Property } from "#/data/types";
import { TYPE_COLORS, TYPE_LABELS, formatSqFt } from "./propertyDisplay";

const US_CENTER: [number, number] = [39.5, -98.5];

/** Teardrop pin colored by property type — avoids Leaflet's default PNG assets. */
function pinIcon(color: string, active: boolean): L.DivIcon {
  const size = active ? 24 : 16;
  return L.divIcon({
    className: "property-map-pin",
    html: `<span style="
      display:block;width:${size}px;height:${size}px;
      background:${color};
      border:2px solid #fff;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 1px 4px rgba(0,0,0,.4);"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

/** Frames the result set, then follows the row the user selects. */
function MapFocus({
  points,
  selected,
}: {
  points: [number, number][];
  selected: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selected) return;
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(points, { padding: [48, 48] });
    // `selected` is deliberately not a dep — re-framing to the full result set
    // every time a row is picked would fight the flyTo below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, map]);

  useEffect(() => {
    if (!selected) return;
    map.flyTo(selected, Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [selected, map]);

  return null;
}

export default function PropertyRecordMapInner({
  properties,
  selectedId,
  onSelect,
}: {
  properties: Property[];
  selectedId: string | null;
  onSelect: (propertyId: string) => void;
}) {
  const points = useMemo<[number, number][]>(
    () => properties.map((p) => [p.lat, p.lng]),
    [properties],
  );

  const selectedPoint = useMemo<[number, number] | null>(() => {
    const p = properties.find((x) => x.id === selectedId);
    return p ? [p.lat, p.lng] : null;
  }, [properties, selectedId]);

  return (
    <MapContainer
      center={US_CENTER}
      zoom={4}
      scrollWheelZoom
      // Zoom moves off the top-left so the result-count pill can sit there,
      // which is where Insights puts it.
      zoomControl={false}
      className="rounded"
      style={{ height: "100%", width: "100%" }}
    >
      <ZoomControl position="bottomright" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFocus points={points} selected={selectedPoint} />
      {properties.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={pinIcon(TYPE_COLORS[p.propertyType], p.id === selectedId)}
          eventHandlers={{ click: () => onSelect(p.id) }}
        >
          <Popup>
            <div style={{ minWidth: 190 }}>
              <div className="fw-semibold mb-1">{p.street || p.name}</div>
              <div className="text-muted fs-xs mb-2">
                {p.city}, {p.state} {p.zip}
              </div>
              <div className="d-flex justify-content-between gap-3">
                <span>{TYPE_LABELS[p.propertyType]}</span>
                <span className="fw-semibold">
                  {p.buildingSqFt > 0 ? formatSqFt(p.buildingSqFt) : "—"}
                </span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
