import { describe, expect, it } from "vitest";
import {
  listingGallery,
  getPhotoUrl,
  crePhotoUrl,
  swapCrePhoto,
  CRE_PHOTO_IDS,
} from "./propertyDisplay";

describe("listingGallery", () => {
  it("returns the requested number of photos", () => {
    expect(listingGallery("deal-1", 5)).toHaveLength(5);
  });

  it("defaults to 5 photos", () => {
    expect(listingGallery("deal-1")).toHaveLength(5);
  });

  it("leads with the deal's existing hero photo", () => {
    // The gallery must agree with the thumbnail shown everywhere else.
    expect(listingGallery("deal-1", 5, 480, 280)[0]).toBe(
      getPhotoUrl("deal-1", 480, 280),
    );
  });

  it("is deterministic for the same id", () => {
    expect(listingGallery("deal-1", 5)).toEqual(listingGallery("deal-1", 5));
  });

  it("returns distinct photos", () => {
    const photos = listingGallery("deal-1", 5);
    expect(new Set(photos).size).toBe(5);
  });

  it("caps at the size of the photo pool", () => {
    const photos = listingGallery("deal-1", CRE_PHOTO_IDS.length + 10);
    expect(photos).toHaveLength(CRE_PHOTO_IDS.length);
  });

  it("passes width and height through to the photo URL", () => {
    expect(listingGallery("deal-1", 1, 120, 90)[0]).toContain("w=120");
    expect(listingGallery("deal-1", 1, 120, 90)[0]).toContain("h=90");
  });
});

// The editor's image picker rebuilds the URL on every swap. If it doesn't carry
// the current crop over, changing the cover photo resizes the cover.
describe("swapCrePhoto", () => {
  it("keeps the crop dimensions of the image it replaces", () => {
    const cover = crePhotoUrl(CRE_PHOTO_IDS[0], 816, 853);
    const swapped = swapCrePhoto(cover, CRE_PHOTO_IDS[3]);
    expect(swapped).toBe(crePhotoUrl(CRE_PHOTO_IDS[3], 816, 853));
  });

  it("falls back to the default crop when the source carries no dimensions", () => {
    const swapped = swapCrePhoto("https://images.unsplash.com/photo-abc", CRE_PHOTO_IDS[1]);
    expect(swapped).toBe(crePhotoUrl(CRE_PHOTO_IDS[1]));
  });
});
