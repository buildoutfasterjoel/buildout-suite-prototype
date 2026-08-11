import type { VisualMediaType } from "#/data/types";

/**
 * The preset embed types Visual Media offers, in display order.
 *
 * Extracted so the listing form's `VisualMediaSection` and the Media tab's
 * `VisualMediaGallery` cannot drift — two dropdowns offering different subsets of
 * the same union would be invisible until a broker noticed one was missing.
 */
export const VISUAL_MEDIA_TYPES: VisualMediaType[] = [
  "Interactive Site Plan",
  "Aerial 360 Map",
  "Aerial 360 Rendering",
  "360 Rendering",
  "Property Marketing Video",
  "Matterport Tour",
  "360 Tour",
];
