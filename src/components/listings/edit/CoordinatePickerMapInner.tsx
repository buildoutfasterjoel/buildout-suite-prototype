import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** Fallback view when a listing has no coordinates yet — continental US. */
const US_CENTER: [number, number] = [39.5, -98.5];
const US_ZOOM = 4;
const PIN_ZOOM = 15;

/**
 * Same teardrop as `PropertyMapInner`, in the brand primary. Built as a
 * `divIcon` rather than Leaflet's default marker because the default resolves
 * PNG assets by URL, which Vite does not rewrite for us.
 */
const pin = L.divIcon({
  className: "coordinate-picker-pin",
  html: `<span style="
    display:block;width:18px;height:18px;
    background:var(--bp-primary);
    border:2px solid #fff;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    box-shadow:0 1px 4px rgba(0,0,0,.4);"></span>`,
  iconSize: [18, 18],
  iconAnchor: [9, 18],
});

/** Turns a click anywhere on the tiles into a coordinate pair. */
function ClickToSet({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

/**
 * Follows the fields. Typing a coordinate has to move the map, or the pin and
 * the inputs disagree about where the property is.
 *
 * `panTo` rather than `setView` so an edit does not yank the zoom the broker
 * chose out from under them; the zoom is only forced on the first real pair,
 * where the map is still sitting at the country-wide fallback.
 */
function FollowCoords({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null) return;
    if (map.getZoom() < PIN_ZOOM - 3) map.setView([lat, lng], PIN_ZOOM);
    else map.panTo([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

export default function CoordinatePickerMapInner({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const hasPin = lat != null && lng != null;
  return (
    <MapContainer
      center={hasPin ? [lat, lng] : US_CENTER}
      zoom={hasPin ? PIN_ZOOM : US_ZOOM}
      scrollWheelZoom={false}
      className="border rounded"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToSet onPick={onPick} />
      <FollowCoords lat={lat} lng={lng} />
      {hasPin && <Marker position={[lat, lng]} icon={pin} />}
    </MapContainer>
  );
}
