import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { getContactByHeroKey, getListing } from "#/data/store";
import { getDaysOnMarket } from "#/data/listingClientReport";
import { getListingTraffic } from "#/data/listingTraffic";
import { getListingWebsiteActivity } from "#/data/listingWebsiteActivity";
import {
  DELGADO_DAYS_ON_MARKET,
  DELGADO_WEBSITE_TRAFFIC,
  isDelgadoOnMarket,
} from "#/data/rosaDemoStats";
import type { Listing, PropertyStatus } from "#/data/types";

const DELGADO_DEAL_ID = "test-delgado-deal";

beforeEach(() => {
  useDataStore.setState(seedSlice());
});

function delgadoPropertyId(): string {
  const rosa = getContactByHeroKey("rosa");
  const id = rosa?.ownedPropertyIds?.[0];
  if (!id) throw new Error("Rosa has no owned property in the seed");
  return id;
}

/** Put a deal on Rosa's building at `status`, cloned from any seeded listing. */
function placeDelgadoDeal(status: PropertyStatus): Listing {
  const template = [...useDataStore.getState().listings.values()][0];
  const listing: Listing = {
    ...template,
    id: DELGADO_DEAL_ID,
    propertyId: delgadoPropertyId(),
    status,
  };
  useDataStore.setState((s) => {
    const listings = new Map(s.listings);
    listings.set(listing.id, listing);
    return { listings };
  });
  return listing;
}

describe("Delgado Building demo stats", () => {
  it("reads as pre-market while the deal is still in Pitching", () => {
    placeDelgadoDeal("proposal");
    const pid = delgadoPropertyId();

    expect(isDelgadoOnMarket(pid)).toBe(false);
    expect(getDaysOnMarket(pid)).toBe(0);

    const traffic = getListingTraffic(DELGADO_DEAL_ID);
    expect(traffic.pageViews).toBe(0);
    expect(traffic.uniqueVisitors).toBe(0);
    expect(traffic.leads).toBe(0);
    expect(traffic.changePct).toBe(0);
    expect(traffic.series.every((d) => d.views === 0)).toBe(true);

    expect(getListingWebsiteActivity(DELGADO_DEAL_ID)).toEqual([]);
  });

  it("lands on the pinned numbers once the deal goes Active", () => {
    placeDelgadoDeal("active");
    const pid = delgadoPropertyId();

    expect(isDelgadoOnMarket(pid)).toBe(true);
    expect(getDaysOnMarket(pid)).toBe(DELGADO_DAYS_ON_MARKET);

    const traffic = getListingTraffic(DELGADO_DEAL_ID);
    expect(traffic.pageViews).toBe(DELGADO_WEBSITE_TRAFFIC.pageViews);
    expect(traffic.uniqueVisitors).toBe(DELGADO_WEBSITE_TRAFFIC.uniqueVisitors);
    expect(traffic.leads).toBe(DELGADO_WEBSITE_TRAFFIC.leads);

    // 14 days of chart should add up to about 14/30ths of the 30-day total.
    const sum = traffic.series.reduce((acc, d) => acc + d.views, 0);
    const target = Math.round((DELGADO_WEBSITE_TRAFFIC.pageViews * 14) / 30);
    expect(Math.abs(sum - target)).toBeLessThanOrEqual(traffic.series.length);

    expect(getListingWebsiteActivity(DELGADO_DEAL_ID).length).toBeGreaterThan(0);
  });

  it("stays on market through Under Contract and Closed", () => {
    for (const status of ["under-contract", "closed"] as const) {
      placeDelgadoDeal(status);
      expect(getDaysOnMarket(delgadoPropertyId())).toBe(DELGADO_DAYS_ON_MARKET);
    }
  });

  it("leaves every other listing hash-derived", () => {
    const other = [...useDataStore.getState().listings.values()].find(
      (l) => l.propertyId !== delgadoPropertyId(),
    )!;
    expect(getListing(other.id)).toBeDefined();
    const traffic = getListingTraffic(other.id);
    expect(traffic.pageViews).toBeGreaterThanOrEqual(400);
    expect(getDaysOnMarket(other.propertyId)).toBeGreaterThanOrEqual(100);
  });
});
