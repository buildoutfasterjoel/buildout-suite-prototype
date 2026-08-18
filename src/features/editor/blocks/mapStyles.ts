import type { MapSize, MapStyle } from "../types";

/**
 * Tile sources for the map block. All three are keyless — the prototype has no
 * map provider account, and the deals map already runs on OpenStreetMap — so a
 * style switch costs nothing but a URL.
 *
 * `maxZoom` is the deepest level each source actually serves. Past it the tiles
 * 404 and Leaflet paints grey, so the view clamps to it rather than trusting the
 * zoom control's range.
 */
export interface MapStyleDef {
  key: MapStyle;
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

export const MAP_STYLES: MapStyleDef[] = [
  {
    key: "streets",
    label: "Streets",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  },
  {
    key: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery © Esri",
    maxZoom: 18,
  },
  {
    key: "terrain",
    label: "Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap (CC-BY-SA)",
    maxZoom: 17,
  },
];

export function mapStyleDef(style: MapStyle): MapStyleDef {
  return MAP_STYLES.find((s) => s.key === style) ?? MAP_STYLES[0];
}

/** Zoom range the control offers: metro-wide down to a single building. */
export const MAP_ZOOM_MIN = 4;
export const MAP_ZOOM_MAX = 19;

/** The zoom a style can actually render, whatever the block asks for. */
export function clampZoom(zoom: number, style: MapStyle): number {
  return Math.max(MAP_ZOOM_MIN, Math.min(zoom, mapStyleDef(style).maxZoom));
}

/**
 * Height presets. `full` has no fixed height — it grows to fill whatever
 * vertical space its page or column has left, so a map-only page fills the
 * sheet without anyone doing arithmetic.
 */
export const MAP_SIZES: { key: MapSize; label: string; height: number | null }[] = [
  { key: "sm", label: "S", height: 240 },
  { key: "md", label: "M", height: 360 },
  { key: "lg", label: "L", height: 520 },
  { key: "full", label: "Full", height: null },
];

export function mapSizeHeight(size: MapSize): number | null {
  const def = MAP_SIZES.find((s) => s.key === size);
  // `full`'s height is deliberately null, so it can't be defaulted away with
  // `??` — only an unknown size falls back.
  return def ? def.height : 360;
}

/** Center of the contiguous US — where the map sits when no deal is bound. */
export const MAP_FALLBACK_CENTER: [number, number] = [39.5, -98.5];
