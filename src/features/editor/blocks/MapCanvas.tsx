import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BRAND } from "../brand";
import type { MapBlock } from "../types";
import { clampZoom, mapStyleDef } from "./mapStyles";

/**
 * The brand pin marking the subject property. Built as a div icon rather than
 * Leaflet's default marker so it needs no PNG assets (the same reason
 * `PropertyMapInner` does it this way) and so it can carry the brand color.
 */
function pin(): L.DivIcon {
  return L.divIcon({
    className: "bo-editor-map-pin",
    html: `<span style="
      display:block;width:18px;height:18px;
      background:${BRAND.palette.primary};
      border:2px solid #fff;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 1px 4px rgba(0,0,0,.4);"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
  });
}

/**
 * Pushes the block's view onto the Leaflet instance. `MapContainer` only reads
 * `center`/`zoom` on mount, so without this the controls would do nothing after
 * the first render. `invalidateSize` covers the size presets: Leaflet caches its
 * container height and paints grey gutters when that changes underneath it.
 */
function MapView({
  center,
  zoom,
  size,
}: {
  center: [number, number];
  zoom: number;
  size: MapBlock["size"];
}) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, zoom, { animate: false });
  }, [map, center, zoom]);

  useEffect(() => {
    map.invalidateSize({ animate: false });
  }, [map, size]);

  return null;
}

/**
 * The map block's canvas. Every interaction is off: this is a picture of a place
 * in a document, and a scroll-wheel zoom here would eat the canvas scroll the
 * user is actually aiming at.
 */
export default function MapCanvas({
  block,
  center,
}: {
  block: MapBlock;
  center: [number, number];
}) {
  const style = mapStyleDef(block.mapStyle);
  const zoom = clampZoom(block.zoom, block.mapStyle);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      zoomControl={false}
      attributionControl
    >
      <TileLayer url={style.url} attribution={style.attribution} maxZoom={style.maxZoom} />
      <MapView center={center} zoom={zoom} size={block.size} />
      <Marker position={center} icon={pin()} interactive={false} />
    </MapContainer>
  );
}
