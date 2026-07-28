import { describe, expect, it } from "vitest";
import {
  listingGallery,
  getPhotoUrl,
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
