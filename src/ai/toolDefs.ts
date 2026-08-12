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
  "inquired",
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

export const researchContactDef = toolDefinition({
  name: "research_contact",
  description:
    "Produce a full analyst brief on ONE contact (ownership, deals, activity, takeaways). Use for broad 'tell me about / who is / research X' requests. Resolve the name with searchAll first if needed.",
  inputSchema: {
    type: "object",
    properties: { contactId: { type: "string" } },
    required: ["contactId"],
    additionalProperties: false,
  },
});

export const answerAboutContactDef = toolDefinition({
  name: "answer_about_contact",
  description:
    "Answer a SPECIFIC question about one contact using their record. Use when the broker asks a targeted question about a named person (not a broad 'tell me about').",
  inputSchema: {
    type: "object",
    properties: { contactId: { type: "string" }, question: { type: "string" } },
    required: ["contactId", "question"],
    additionalProperties: false,
  },
});

export const analyzeBookDef = toolDefinition({
  name: "analyze_book",
  description:
    "Portfolio strategy across the WHOLE book — who to work, who can close in 90 days, who's gone cold, how to drum up business, review the pipeline. Use for any strategy/portfolio question NOT about one named person. Never refuse for lack of a tool. Returns a written answer (distinct from build_call_list).",
  inputSchema: {
    type: "object",
    properties: { question: { type: "string" } },
    required: ["question"],
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

export const buildMarketingPackageDef = toolDefinition({
  name: "build_marketing_package",
  description:
    "Build a full marketing package for an address: flyer + launch email + a financial summary. REQUIRES an address; if missing, ask for it, then owner and asset type — ONE short question at a time — before calling.",
  inputSchema: {
    type: "object",
    properties: {
      address: { type: "string" },
      owner_name: { type: "string" },
      asset_type: { type: "string" },
      asking_price: { type: "number" },
      notes: { type: "string" },
    },
    required: ["address"],
    additionalProperties: false,
  },
});

// ── Client actions (Phase 1, no LLM/key needed) ─────────────────────────────

export const addNoteDef = toolDefinition({
  name: "add_note",
  description:
    "Save a note on a contact's record. If the note also implies a follow-up action (a call, email, or reminder), ALSO call create_task for it so the reminder actually gets scheduled.",
  inputSchema: {
    type: "object",
    properties: {
      contact_name: { type: "string" },
      note_text: { type: "string" },
    },
    required: ["contact_name", "note_text"],
    additionalProperties: false,
  },
});

export const createTaskDef = toolDefinition({
  name: "create_task",
  description:
    "Create a follow-up task/reminder. Use for 'remind me to…' / 'follow up …' — including reminders to CALL someone LATER (a live call NOW is start_call). due is natural language ('friday', 'in 3 days').",
  inputSchema: {
    type: "object",
    properties: {
      task_title: { type: "string" },
      contact_name: { type: "string" },
      due: { type: "string" },
    },
    required: ["task_title"],
    additionalProperties: false,
  },
});

export const findContactDef = toolDefinition({
  name: "find_contact",
  description:
    "Search the CRM and show a clickable result card for a person. Use when the broker wants to locate someone.",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
    additionalProperties: false,
  },
});

export const createContactDef = toolDefinition({
  name: "create_contact",
  description:
    "Add a NEW person to the broker's book. Use for 'add a contact …' / 'create a contact' / 'add X to my book'. To FIND someone who already exists, use find_contact instead.\n\nGather in this order, one short question per turn, and do NOT call this tool until you have both. Use these exact phrasings — warm and conversational, acknowledging what you just got before asking for the next thing:\n1. Their name — if the broker just said \"add a contact\" with no name, reply \"Sure, let's add a contact. What's their name?\" and stop.\n2. A phone or email — once you have a name, reply \"Got it, <their name>. What's the best phone or email for them?\" and stop.\nOnly then call this tool. If the broker says they don't have a phone or email, call it with contact_info_unavailable: true. Never invent an email or phone.\n\nAfterwards confirm in one short line naming them, e.g. \"Done — added Jane Doe to your book.\"; their record renders as a clickable card, so don't restate the details.",
  inputSchema: {
    type: "object",
    properties: {
      first_name: { type: "string" },
      last_name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      company: { type: "string" },
      title: { type: "string", description: "Job title, e.g. 'Managing Partner'." },
      notes: { type: "string" },
      contact_info_unavailable: {
        type: "boolean",
        description:
          "Set true ONLY when the broker has said they have no phone or email for this person. Creates the record without either.",
      },
    },
    required: ["first_name"],
    additionalProperties: false,
  },
});

export const planMyDayDef = toolDefinition({
  name: "plan_my_day",
  description:
    "Build the broker's ranked queue of moves to work right now, from their live book. Use for 'what should I do today' / 'plan my day' / 'what's next' / 'recommend my next actions' / 'walk me through my day'. Returns an interactive co-pilot card the broker steps through — so give ONE short sentence of framing and let the card do the work; never re-list the items in prose.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
});

export const startCallDef = toolDefinition({
  name: "start_call",
  description:
    "Start a call with a contact NOW (opens the call flow). A reminder to call LATER is create_task instead.",
  inputSchema: {
    type: "object",
    properties: { contact_name: { type: "string" } },
    required: ["contact_name"],
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
  buildMarketingPackageDef,
  researchContactDef,
  answerAboutContactDef,
  analyzeBookDef,
  navigateToDef,
  addNoteDef,
  createTaskDef,
  findContactDef,
  createContactDef,
  planMyDayDef,
  startCallDef,
];
