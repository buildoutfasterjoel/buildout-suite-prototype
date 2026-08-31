import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { createProposalListing, emptyDraft } from "#/data/createListing";
import { addPropertyUnit, addSpaceToDeal } from "#/data/leaseSpaces";
import { createClientTools, jsonSafeResult, resolveContactByName, rewriteSpaceDealPath } from "./tools";

beforeEach(() => { useDataStore.setState(seedSlice()); });

describe("resolveContactByName", () => {
  it("resolves a full name to a contact", () => {
    const first = [...useDataStore.getState().contacts.values()][0];
    const full = `${first.firstName} ${first.lastName}`.trim();
    expect(resolveContactByName(full)?.id).toBe(first.id);
  });
  it("returns null for an unknown name", () => {
    expect(resolveContactByName("Zzz Nobody")).toBeNull();
  });
});

describe("rewriteSpaceDealPath", () => {
  /** A building with one space, both live in the store. */
  function building() {
    const parent = createProposalListing({ ...emptyDraft(), name: "Rowan Center", dealType: "Lease" });
    const unit = addPropertyUnit(parent.propertyId, { label: "Suite 300", sqft: 2000, unitType: "office" })!;
    const child = addSpaceToDeal(parent.id, unit.id)!.deal;
    return { parent, child };
  }

  it("rewrites a space's bare deal path to its page under its building", () => {
    const { parent, child } = building();
    expect(rewriteSpaceDealPath(`/listings/${child.id}`)).toBe(
      `/listings/${parent.id}/spaces/${child.id}/overview`,
    );
  });

  it("keeps the section when rewriting a space's sectioned path", () => {
    const { parent, child } = building();
    expect(rewriteSpaceDealPath(`/listings/${child.id}/leads`)).toBe(
      `/listings/${parent.id}/spaces/${child.id}/leads`,
    );
  });

  it("falls back to the building for a section a space's page does not have", () => {
    const { parent, child } = building();
    // A space has no `listing` route of its own — this is the pre-space-page
    // behaviour, not a rewrite onto the space's page.
    expect(rewriteSpaceDealPath(`/listings/${child.id}/listing`)).toBe(
      `/listings/${parent.id}/listing`,
    );
  });

  it("falls back to the building for a section this branch removed from a space", () => {
    const { parent, child } = building();
    // `documents` is one of the six sections this branch removed from a space's
    // nav (`BUILDING_OWNED_HREFS`), plus `underwriting` (removed for a different
    // reason — see `dealNav.ts`). `SPACE_SECTIONS` is derived from
    // `visibleNavGroups`, so this pins that the derivation actually tracks that
    // removal rather than the fallback only being exercised by `listing`.
    expect(rewriteSpaceDealPath(`/listings/${child.id}/documents`)).toBe(
      `/listings/${parent.id}/documents`,
    );
  });

  it("leaves a building's own paths alone", () => {
    const { parent } = building();
    expect(rewriteSpaceDealPath(`/listings/${parent.id}`)).toBe(`/listings/${parent.id}`);
    expect(rewriteSpaceDealPath(`/listings/${parent.id}/documents`)).toBe(
      `/listings/${parent.id}/documents`,
    );
  });

  it("passes through anything that isn't a resolvable deal path", () => {
    for (const path of [
      "/listings",
      "/backoffice/contacts",
      "/listings/no-such-deal",
      "/properties/prop-1",
    ]) {
      expect(rewriteSpaceDealPath(path)).toBe(path);
    }
  });
});

/**
 * The runtime canonicalises a client tool's output with a serializer stricter
 * than `JSON.stringify`, and throws `Interrupt values must be JSON-compatible.`
 * on an `undefined` anywhere in the tree or on any non-plain object. Mirrored
 * here so these tests fail the way the app failed, rather than on a proxy for
 * it — the real bug was a tool "succeeding" with an error payload the model
 * then narrated straight past.
 */
function assertCanonical(value: unknown, path = "$"): void {
  if (value === null) return;
  if (typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path}: non-finite number`);
    return;
  }
  if (typeof value !== "object") throw new Error(`${path}: ${typeof value} is not JSON`);
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertCanonical(v, `${path}[${i}]`));
    return;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new Error(`${path}: not a plain object`);
  }
  for (const [k, v] of Object.entries(value)) assertCanonical(v, `${path}.${k}`);
}

describe("jsonSafeResult", () => {
  it("drops undefined properties rather than throwing on them", () => {
    const out = jsonSafeResult({ kept: 1, dropped: undefined, nested: { gone: undefined, here: "x" } });
    expect(out).toEqual({ kept: 1, nested: { here: "x" } });
    assertCanonical(out);
  });

  it("nulls an undefined array entry instead of leaving a hole", () => {
    const out = jsonSafeResult({ rows: [1, undefined, 3] }) as { rows: unknown[] };
    expect(out.rows).toEqual([1, null, 3]);
    assertCanonical(out);
  });

  it("coerces the values the strict serializer rejects", () => {
    const out = jsonSafeResult({ nan: NaN, inf: Infinity, when: new Date("2026-06-15T00:00:00Z") });
    expect(out).toEqual({ nan: null, inf: null, when: "2026-06-15T00:00:00.000Z" });
    assertCanonical(out);
  });

  it("turns a tool that returned nothing into null, not a serialization error", () => {
    expect(jsonSafeResult(undefined)).toBeNull();
  });

  it("reports a cycle as a tool error instead of throwing into the runtime", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(jsonSafeResult(cyclic)).toEqual({
      error: "That result couldn't be serialized to send back.",
    });
  });
});

describe("client tool output is canonical-safe", () => {
  const tools = createClientTools({ navigate: () => {} });
  const run = async (name: string, args: unknown) => {
    const tool = tools.find((t) => t.name === name);
    expect(tool, `no tool named ${name}`).toBeDefined();
    const execute = (tool as { execute?: (a: unknown) => Promise<unknown> }).execute;
    expect(execute, `${name} has no execute`).toBeTypeOf("function");
    return execute!(args);
  };

  /**
   * The reported bug, pinned at its narrowest point. Asked for active deals,
   * `listDeals` built a nav carrying `dealType: undefined` — the broker named a
   * status but not a deal type — which the runtime rejected. The throw was
   * caught and stored as the call's output, so the rail had no `deals` array to
   * draw cards from while the model cheerfully wrote "Here are your active
   * deals:" above nothing.
   */
  it("listDeals survives a filter the broker only half-specified", async () => {
    const out = (await run("listDeals", { status: "active" })) as {
      error?: string;
      deals?: unknown[];
      navs?: unknown[];
    };
    expect(out.error).toBeUndefined();
    expect(Array.isArray(out.deals)).toBe(true);
    expect(out.navs?.length).toBe(1);
    assertCanonical(out);
  });

  it("holds for every read tool that builds a nav or summary", async () => {
    const contact = [...useDataStore.getState().contacts.values()][0];
    const deal = [...useDataStore.getState().listings.values()][0];
    const cases: Array<[string, unknown]> = [
      ["listDeals", {}],
      ["listDeals", { dealType: "Sale" }],
      ["listContacts", {}],
      ["listContacts", { relationship: "cold" }],
      ["searchAll", { query: "a" }],
      ["find_contact", { query: contact.firstName }],
      ["getContactDetail", { contactId: contact.id }],
      ["getListing", { listingId: deal.id }],
      ["getProperty", { propertyId: deal.propertyId }],
      ["listContactsForDeal", { dealId: deal.id }],
      ["listDealsForContact", { contactId: contact.id }],
      ["task_search", {}],
      ["voucher_search", {}],
      ["research_property_search", { limit: 3 }],
      ["deal_pipeline_totals", {}],
      ["attachment_list", { dealId: deal.id }],
      ["activity_search", { dealId: deal.id }],
      ["contact_tags", { contactId: contact.id }],
    ];
    for (const [name, args] of cases) {
      const out = await run(name, args);
      expect((out as { error?: string }).error, `${name} errored`).toBeUndefined();
      try {
        assertCanonical(out);
      } catch (e) {
        throw new Error(`${name} returned a non-canonical result — ${(e as Error).message}`);
      }
    }
  });
});

describe("contact tag tools", () => {
  const tools = createClientTools({ navigate: () => {} });
  const run = async (name: string, args: unknown) => {
    const tool = tools.find((t) => t.name === name);
    expect(tool, `no tool named ${name}`).toBeDefined();
    const execute = (tool as { execute?: (a: unknown) => Promise<unknown> }).execute;
    return execute!(args) as Promise<Record<string, unknown>>;
  };
  const someone = () => [...useDataStore.getState().contacts.values()][0];
  const tagsOf = (id: string) => useDataStore.getState().contacts.get(id)!.tags;

  it("reads a contact's tags and the tags in use across the book", async () => {
    const c = someone();
    const out = await run("contact_tags", { contactId: c.id });
    expect(out.error).toBeUndefined();
    expect(out.tags).toEqual(c.tags);
    // Every tag on the record is also in the book-wide list the model picks from.
    for (const t of c.tags) expect(out.tagsInUse as string[]).toContain(t);
    assertCanonical(out);
  });

  it("resolves the contact by name when it has no id", async () => {
    const c = someone();
    const out = await run("contact_tags", {
      contact_name: `${c.firstName} ${c.lastName}`.trim(),
    });
    expect(out.contactId).toBe(c.id);
  });

  it("adds a tag and hands back the record for its card", async () => {
    const c = someone();
    // A tag no seeded contact carries — the seed's own pool ("1031 exchange",
    // "Out-of-state") would exercise the already-present path instead.
    const out = await run("add_contact_tags", { contactId: c.id, tags: ["Rooftop Solar"] });
    expect(out.added).toEqual(["Rooftop Solar"]);
    expect(tagsOf(c.id)).toContain("Rooftop Solar");
    // `contacts` is what renders the contact card — same contract as update_contact.
    expect((out.contacts as unknown[]).length).toBe(1);
    assertCanonical(out);
  });

  /**
   * A no-op has to read as a no-op. Reported as `alreadyPresent` rather than
   * dropped, or "add VIP" on someone already tagged VIP comes back as a success
   * the broker then can't find any trace of.
   */
  it("reports a tag that was already there instead of claiming to add it", async () => {
    const c = someone();
    await run("add_contact_tags", { contactId: c.id, tags: ["VIP"] });
    const out = await run("add_contact_tags", { contactId: c.id, tags: ["vip"] });
    expect(out.added).toEqual([]);
    expect(out.alreadyPresent).toEqual(["vip"]);
    expect(tagsOf(c.id).filter((t) => t.toLowerCase() === "vip")).toEqual(["VIP"]);
  });

  it("removes a tag case-insensitively", async () => {
    const c = someone();
    await run("add_contact_tags", { contactId: c.id, tags: ["Investor"] });
    const out = await run("remove_contact_tags", { contactId: c.id, tags: ["investor"] });
    expect(out.removed).toEqual(["Investor"]);
    expect(tagsOf(c.id)).not.toContain("Investor");
    assertCanonical(out);
  });

  it("says a tag was not there rather than erroring", async () => {
    const c = someone();
    const out = await run("remove_contact_tags", { contactId: c.id, tags: ["Nonexistent"] });
    expect(out.error).toBeUndefined();
    expect(out.removed).toEqual([]);
    expect(out.notPresent).toEqual(["Nonexistent"]);
  });

  it("errors by name when the contact cannot be resolved", async () => {
    const out = await run("add_contact_tags", { contact_name: "Zzz Nobody", tags: ["VIP"] });
    expect(out.error).toContain("Zzz Nobody");
    const bare = await run("contact_tags", {});
    expect(bare.error).toBeTruthy();
  });
});
