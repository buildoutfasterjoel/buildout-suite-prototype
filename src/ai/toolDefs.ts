import { toolDefinition } from "@tanstack/ai";

/**
 * Isomorphic AI tool **definitions** (schemas only, no execute).
 *
 * The server relay (`src/ai/relay.ts`) passes these to `chat()` so Claude knows
 * the tool surface. Because they carry no server-side `execute`, the runtime
 * emits a client-tool request for each call; the browser runs the matching
 * implementation from `src/ai/tools.ts` (matched by `name`) against the live
 * Zustand store and posts the result back. This keeps all data client-side.
 *
 * Schemas are plain JSON Schema (no Zod dependency).
 */

const PROPERTY_STATUSES = [
  "proposal",
  "active",
  "under-contract",
  "closed",
  "inactive",
] as const;

const RELATIONSHIPS = [
  "cold",
  "nurturing",
  "active",
  "pitching",
  "client",
  "past_client",
] as const;

const CONTACT_ROLES = ["owner", "broker", "buyer", "tenant", "lender"] as const;

// ── Read / query ──────────────────────────────────────────────────────────

export const searchAllDef = toolDefinition({
  name: "searchAll",
  description:
    "Search across properties, deals, and contacts by a free-text query (names, addresses, companies). Use this FIRST to resolve a name the user mentioned into an id before calling any other tool.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text to search for." },
    },
    required: ["query"],
    additionalProperties: false,
  },
});

export const listContactsDef = toolDefinition({
  name: "listContacts",
  description:
    "List contacts, optionally filtered by relationship stage, role, or tag. Use this to build audiences (e.g. all cold prospects) before creating a call list or email.",
  inputSchema: {
    type: "object",
    properties: {
      relationship: { type: "string", enum: RELATIONSHIPS as unknown as string[] },
      role: { type: "string", enum: CONTACT_ROLES as unknown as string[] },
      tag: { type: "string", description: "Segment tag, e.g. VIP or Investor." },
      limit: { type: "number", description: "Max contacts to return (default 50)." },
    },
    additionalProperties: false,
  },
});

export const listDealsDef = toolDefinition({
  name: "listDeals",
  description:
    "List deals/listings, optionally filtered by stage or deal type. Use for 'show my active deals', 'what's under contract', 'summarize my pipeline', etc. Results render as interactive cards.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: PROPERTY_STATUSES as unknown as string[] },
      dealType: { type: "string", enum: ["Sale", "Lease"] },
      limit: { type: "number", description: "Max deals to return (default 50)." },
    },
    additionalProperties: false,
  },
});

export const getContactDetailDef = toolDefinition({
  name: "getContactDetail",
  description:
    "Get a single contact plus the deals they're a party to and their open task count.",
  inputSchema: {
    type: "object",
    properties: { contactId: { type: "string" } },
    required: ["contactId"],
    additionalProperties: false,
  },
});

export const listDealsForContactDef = toolDefinition({
  name: "listDealsForContact",
  description: "List the deals a contact is attached to (as seller, buyer, or other).",
  inputSchema: {
    type: "object",
    properties: { contactId: { type: "string" } },
    required: ["contactId"],
    additionalProperties: false,
  },
});

export const listDealsForPropertyDef = toolDefinition({
  name: "listDealsForProperty",
  description: "List the deals/listings that belong to a property.",
  inputSchema: {
    type: "object",
    properties: { propertyId: { type: "string" } },
    required: ["propertyId"],
    additionalProperties: false,
  },
});

export const listContactsForDealDef = toolDefinition({
  name: "listContactsForDeal",
  description: "List the contacts attached to a deal (seller, buyer, and other parties).",
  inputSchema: {
    type: "object",
    properties: { dealId: { type: "string" } },
    required: ["dealId"],
    additionalProperties: false,
  },
});

export const getPropertyDef = toolDefinition({
  name: "getProperty",
  description: "Get a property's key facts (address, type, size, price, cap rate).",
  inputSchema: {
    type: "object",
    properties: { propertyId: { type: "string" } },
    required: ["propertyId"],
    additionalProperties: false,
  },
});

export const getListingDef = toolDefinition({
  name: "getListing",
  description: "Get a listing/deal's key facts (name, status, price, deal type, location).",
  inputSchema: {
    type: "object",
    properties: { listingId: { type: "string" } },
    required: ["listingId"],
    additionalProperties: false,
  },
});

// ── Write / actions ─────────────────────────────────────────────────────────

export const createDealDef = toolDefinition({
  name: "createDeal",
  description:
    "Create a new proposal-stage deal (and its property) from an address. Confirm the address with the user if ambiguous.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Deal/listing name. Defaults to the address." },
      address: { type: "string", description: "Street address of the property." },
    },
    required: ["address"],
    additionalProperties: false,
  },
});

export const updateDealStageDef = toolDefinition({
  name: "updateDealStage",
  description: "Move a deal to a new stage in its lifecycle.",
  inputSchema: {
    type: "object",
    properties: {
      dealId: { type: "string" },
      status: { type: "string", enum: PROPERTY_STATUSES as unknown as string[] },
    },
    required: ["dealId", "status"],
    additionalProperties: false,
  },
});

export const linkContactToDealDef = toolDefinition({
  name: "linkContactToDeal",
  description: "Attach a contact to a deal as the seller, buyer, or another party.",
  inputSchema: {
    type: "object",
    properties: {
      dealId: { type: "string" },
      contactId: { type: "string" },
      role: { type: "string", enum: ["seller", "buyer", "other"] },
    },
    required: ["dealId", "contactId", "role"],
    additionalProperties: false,
  },
});

export const createEmailDraftDef = toolDefinition({
  name: "createEmailDraft",
  description:
    "Draft a new email campaign. It appears at the top of the Email module as a draft. Use for 'draft an email' / 'send an announcement' requests.",
  inputSchema: {
    type: "object",
    properties: {
      subject: { type: "string" },
      list: {
        type: "string",
        description:
          "Audience list, e.g. All Contacts, Buyers, Sellers, Investors, Tenants, Past Clients.",
      },
      primaryBroker: { type: "string", description: "Sending broker's name." },
    },
    required: ["subject"],
    additionalProperties: false,
  },
});

export const createCallListDef = toolDefinition({
  name: "createCallList",
  description:
    "Create a contact call list from a set of contact ids. First gather the ids with listContacts or searchAll (e.g. all cold prospects), then pass them here. The list appears in the People module.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      contactIds: { type: "array", items: { type: "string" } },
      description: { type: "string" },
    },
    required: ["name", "contactIds"],
    additionalProperties: false,
  },
});

export const buildCallListDef = toolDefinition({
  name: "build_call_list",
  description:
    "Build a ranked, dialable call list from the broker's book and save it to the People module. Call IMMEDIATELY with no confirmation when the broker says 'build my call list' / 'who should I call'. Distinct from analyze_book (which is a written answer).",
  inputSchema: {
    type: "object",
    properties: {
      intent: { type: "string", description: "Optional focus, e.g. 'cold prospects to warm up'." },
    },
    additionalProperties: false,
  },
});

export const generateDocDef = toolDefinition({
  name: "generateDoc",
  description:
    "Generate a client-report activity summary for a listing (days on market, leads, CAs signed). Returns the summary text and the path to the full report.",
  inputSchema: {
    type: "object",
    properties: { listingId: { type: "string" } },
    required: ["listingId"],
    additionalProperties: false,
  },
});

// ── Generative (AI Phase 1) ───────────────────────────────────────────────

export const filterListingsDef = toolDefinition({
  name: "filter_listings",
  description:
    "Filter the Listings grid from a plain-English query (e.g. 'stale Chicago office for sale'). Navigates to Listings and applies the filter. Use for any 'show me / find listings that…' request.",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string", description: "The plain-English listings query." } },
    required: ["query"],
    additionalProperties: false,
  },
});

export const draftEmailDef = toolDefinition({
  name: "draft_email",
  description:
    "Draft a professional broker outreach email about a specific property or deal. Resolve the property with searchAll first. Optionally target named recipients. Produces subject + body the broker can edit before sending.",
  inputSchema: {
    type: "object",
    properties: {
      propertyId: { type: "string", description: "Resolved property id." },
      listingId: { type: "string", description: "Resolved listing/deal id (alternative to propertyId)." },
      intent: { type: "string", description: "What the email is about, e.g. 'price reduction' or 'introduce myself as the listing broker'." },
    },
    required: ["intent"],
    additionalProperties: false,
  },
});

// ── Navigation ───────────────────────────────────────────────────────────────

export const navigateToDef = toolDefinition({
  name: "navigateTo",
  description:
    "Navigate the app to a route path. Examples: '/listings', '/backoffice/contacts', '/email', '/listings/{listingId}', '/listings/{listingId}/client-report', '/backoffice/contacts/{contactId}'. Resolve ids with search tools first.",
  inputSchema: {
    type: "object",
    properties: { path: { type: "string", description: "The route path to navigate to." } },
    required: ["path"],
    additionalProperties: false,
  },
});

/** Every tool definition — passed to `chat({ tools })` on the server relay. */
export const TOOL_DEFS = [
  searchAllDef,
  listDealsDef,
  listContactsDef,
  getContactDetailDef,
  listDealsForContactDef,
  listDealsForPropertyDef,
  listContactsForDealDef,
  getPropertyDef,
  getListingDef,
  createDealDef,
  updateDealStageDef,
  linkContactToDealDef,
  createEmailDraftDef,
  createCallListDef,
  generateDocDef,
  filterListingsDef,
  draftEmailDef,
  buildCallListDef,
  navigateToDef,
];
