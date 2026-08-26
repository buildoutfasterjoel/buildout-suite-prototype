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
    "Create a new proposal-stage deal. ALWAYS pass `propertyId` when the deal is on a property that already exists — resolve it first with getContactDetail (which returns the contact's `ownedProperties`) or searchAll. Passing only an address FABRICATES A NEW, EMPTY PROPERTY, which leaves a $0 / 0 SF duplicate sitting next to the real building. Use `address` alone only for a property genuinely not in the CRM yet. Pass `sellerContactId` to attach the owner as you create it, rather than a separate linkContactToDeal call.",
  inputSchema: {
    type: "object",
    properties: {
      propertyId: {
        type: "string",
        description:
          "Id of an EXISTING property to hang the deal on. Strongly preferred over address.",
      },
      name: { type: "string", description: "Deal/listing name. Defaults to the property or address." },
      address: {
        type: "string",
        description:
          "Street address — ONLY for a property that is not in the CRM. Ignored when propertyId is set.",
      },
      dealType: { type: "string", enum: ["Sale", "Lease"] },
      sellerContactId: {
        type: "string",
        description: "The owner selling it. Attaches them as the seller on creation.",
      },
      buyerContactId: {
        type: "string",
        description: "The contact represented on a buy-side deal.",
      },
    },
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
    "Draft a professional broker outreach email about a specific property or deal. ALWAYS establish the recipient before calling: if the broker names a person ('email Rosa'), resolve them with find_contact/searchAll and pass contactId — that person is the recipient even when someone else's page is open. Only fall back to the open contact's page when no one is named ('draft him a follow-up'). Resolve the property with searchAll too. Produces subject + body the broker can edit before sending. This is a ONE-OFF email to a person, not a campaign. The draft renders as a card in the chat with an 'Open in Email' button — the broker decides when to take it to the contact's composer, so do NOT navigate anywhere after calling this. Call it again to revise a draft.",
  inputSchema: {
    type: "object",
    properties: {
      contactId: {
        type: "string",
        description:
          "Resolved id of the person the email is TO. Look them up first (find_contact or searchAll) whenever the broker names someone — 'email Rosa' means pass Rosa's id, even if a different contact's page is open.",
      },
      contact_name: {
        type: "string",
        description:
          "The recipient's name, when you have it but couldn't resolve an id. Used to look them up.",
      },
      propertyId: { type: "string", description: "Resolved property id." },
      listingId: { type: "string", description: "Resolved listing/deal id (alternative to propertyId)." },
      intent: { type: "string", description: "What the email is about, e.g. 'price reduction' or 'introduce myself as the listing broker'." },
    },
    required: ["intent"],
    additionalProperties: false,
  },
});

export const sendEmailDef = toolDefinition({
  name: "send_email",
  description:
    "Send the email the broker means: the one open in a contact's composer if there is one — exactly as it reads on screen, including their own edits — otherwise the draft you wrote last. Works from anywhere; they do NOT need to be on the contact's page first, so never ask them to go open it. ONLY call this when the broker explicitly tells you to send ('send it', 'send that', 'go ahead and send'). Never send on your own initiative, never as a follow-up to drafting, and never to 'save time': hitting send is irreversible and the permission has to be given each time. Logs the email to the contact's timeline.",
  inputSchema: {
    type: "object",
    properties: {},
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

export const addActivityDef = toolDefinition({
  name: "add_activity",
  description:
    "Log an activity on a contact OR a deal — a note, meeting, showing, or message. This is how anything that ALREADY HAPPENED gets on the record. Pass contact_name for a person or dealId for a deal (one of the two). A call that already happened is log_call instead; a reminder for later is create_task. If the activity also implies a follow-up (call them back, send the lease, remind me), ALSO call create_task so the reminder actually gets scheduled.",
  inputSchema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["note", "meeting", "showing", "message"],
        description: "What kind of interaction this was. Defaults to note.",
      },
      body: { type: "string", description: "What happened, in the broker's words." },
      contact_name: { type: "string", description: "The person it happened with." },
      contactId: { type: "string", description: "Resolved contact id, when you have one." },
      dealId: { type: "string", description: "Resolved deal id, to log against a deal instead." },
    },
    required: ["body"],
    additionalProperties: false,
  },
});

export const logCallDef = toolDefinition({
  name: "log_call",
  description:
    "Record a call that ALREADY HAPPENED on a contact's or a deal's timeline — 'log my call with Rosa', 'I just got off the phone with Earl'. Distinct from start_call, which dials someone NOW, and from create_task, which is a reminder to call later. Log the outcome the broker gave you; never invent what was said.",
  inputSchema: {
    type: "object",
    properties: {
      contact_name: { type: "string" },
      contactId: { type: "string" },
      dealId: { type: "string", description: "Log against a deal instead of a contact." },
      outcome: { type: "string", description: "What came out of the call." },
      duration_minutes: { type: "number" },
      direction: { type: "string", enum: ["outbound", "inbound"] },
    },
    required: ["outcome"],
    additionalProperties: false,
  },
});

export const createTaskDef = toolDefinition({
  name: "create_task",
  description:
    "Create a follow-up task/reminder on a contact or a deal. Use for 'remind me to…' / 'follow up …' — including reminders to CALL someone LATER (a live call NOW is start_call, a call that already happened is log_call). due is natural language ('friday', 'in 3 days').",
  inputSchema: {
    type: "object",
    properties: {
      task_title: { type: "string" },
      contact_name: { type: "string", description: "Attach the task to this person." },
      dealId: { type: "string", description: "Attach the task to a deal instead of a person." },
      task_type: {
        type: "string",
        enum: ["call", "email", "meeting", "showing", "to-do", "follow-up"],
        description: "What kind of task it is. Infer it from the ask when it's obvious.",
      },
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

// ── Records the assistant can read but the broker owns elsewhere ─────────────
//
// Tasks, activities, attachments, vouchers and Insights prospects each have a
// page of their own in the app. These tools let the assistant answer *from* those
// records rather than only from deals and contacts — the gap between what the
// shipped assistant can reach and what this prototype could.

export const taskSearchDef = toolDefinition({
  name: "task_search",
  description:
    "Search and filter the broker's tasks — 'what's overdue', 'what's due today', 'what do I owe on the Delgado deal'. Covers standalone tasks and the tasks embedded in a deal's planner. Resolve a person or deal to an id first when the ask names one.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free text matched against the task title." },
      status: { type: "string", enum: ["open", "complete"] },
      due: {
        type: "string",
        enum: ["overdue", "today", "week", "unscheduled"],
        description: "Due window. 'week' is today through seven days out.",
      },
      contactId: { type: "string" },
      dealId: { type: "string" },
      limit: { type: "number", description: "Max tasks to return (default 25)." },
    },
    additionalProperties: false,
  },
});

export const taskLoadDef = toolDefinition({
  name: "task_load",
  description:
    "Load one task in full — due date, type, assignee, and what record it hangs off. Get the id from task_search first.",
  inputSchema: {
    type: "object",
    properties: { taskId: { type: "string" } },
    required: ["taskId"],
    additionalProperties: false,
  },
});

export const activitySearchDef = toolDefinition({
  name: "activity_search",
  description:
    "Read the logged activity on ONE contact or ONE deal — calls, emails, meetings, tours, notes, inquiries — optionally narrowed by type, direction or date. Use for 'when did I last talk to X', 'read her last email', 'what's happened on this deal', 'has anyone toured it'. Requires contactId or dealId, so resolve the name first. IMPORTANT: a reply from the contact is nested INSIDE the message it answers — an item with `direction: 'out'` and a `reply` field IS a message from them. Read `reply`, `thread` and `attachments` on every item before concluding anything is missing.",
  inputSchema: {
    type: "object",
    properties: {
      contactId: { type: "string" },
      dealId: { type: "string" },
      type: {
        type: "string",
        description: "Activity type to filter on, e.g. call, email, meeting, tour, note.",
      },
      direction: {
        type: "string",
        enum: ["in", "out"],
        description:
          "'in' for anything that came FROM the contact, 'out' for what you sent. 'in' correctly includes a sent email that came back answered.",
      },
      since: { type: "string", description: "ISO date (YYYY-MM-DD) — only activity on or after it." },
      limit: { type: "number", description: "Max activities to return (default 20)." },
    },
    additionalProperties: false,
  },
});

export const activityLoadDef = toolDefinition({
  name: "activity_load",
  description:
    "Load one logged activity in full, including its body. Pass the parent record too (contactId or dealId) — an activity is stored on its record, not in a global list.",
  inputSchema: {
    type: "object",
    properties: {
      activityId: { type: "string" },
      contactId: { type: "string" },
      dealId: { type: "string" },
    },
    required: ["activityId"],
    additionalProperties: false,
  },
});

export const attachmentListDef = toolDefinition({
  name: "attachment_list",
  description:
    "List the files in a deal's document vault — what's been uploaded, where it sits, how big it is. Use for 'what's on file for this deal', 'do we have the T-12 yet'.",
  inputSchema: {
    type: "object",
    properties: { dealId: { type: "string" } },
    required: ["dealId"],
    additionalProperties: false,
  },
});

export const attachmentLoadDef = toolDefinition({
  name: "attachment_load",
  description:
    "Load one attachment's details from a deal's vault. Returns the file's metadata and its path — NOT its contents, so never describe or summarize what a file says.",
  inputSchema: {
    type: "object",
    properties: { dealId: { type: "string" }, fileId: { type: "string" } },
    required: ["dealId", "fileId"],
    additionalProperties: false,
  },
});

export const voucherSearchDef = toolDefinition({
  name: "voucher_search",
  description:
    "Search the back-office vouchers — the commission settlement records on closed and closing deals. Use for 'what vouchers are pending', 'what's waiting on approval', 'what have I got outstanding'.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free text: voucher name, deal name, identifier, address." },
      status: { type: "string", enum: ["Draft", "Pending", "Approved"] },
      dealStage: { type: "string", enum: PROPERTY_STATUSES as unknown as string[] },
      brokerName: { type: "string" },
      limit: { type: "number", description: "Max vouchers to return (default 25)." },
    },
    additionalProperties: false,
  },
});

export const voucherLoadDef = toolDefinition({
  name: "voucher_load",
  description:
    "Load one deal's voucher in full — gross commission, pre-split deductions, receivables, and who approved it. Keyed by the DEAL id: a voucher is a tab on its deal, not a record of its own. A shell (a building whose spaces each carry their own transaction) has no voucher.",
  inputSchema: {
    type: "object",
    properties: { dealId: { type: "string" } },
    required: ["dealId"],
    additionalProperties: false,
  },
});

export const researchPropertySearchDef = toolDefinition({
  name: "research_property_search",
  description:
    "Search Buildout Insights — public-records property data for buildings that are NOT in the broker's database. Use for prospecting: 'find me industrial in Phoenix over 50k SF', 'who owns the buildings on that corridor'. These are research records, so always say they aren't in the book yet; adding one is a separate step the broker takes on the Insights page.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free text: name, street, city, type." },
      propertyType: { type: "string" },
      city: { type: "string" },
      state: { type: "string", description: "Two-letter state code." },
      minSqFt: { type: "number" },
      maxSqFt: { type: "number" },
      limit: { type: "number", description: "Max records to return (default 12)." },
    },
    additionalProperties: false,
  },
});

export const researchPropertyLoadDef = toolDefinition({
  name: "research_property_load",
  description:
    "Load one Insights research property in full. Ids come from research_property_search — a research record is not in the broker's database, so getProperty will not find it.",
  inputSchema: {
    type: "object",
    properties: { propertyId: { type: "string" } },
    required: ["propertyId"],
    additionalProperties: false,
  },
});

export const dealPipelineTotalsDef = toolDefinition({
  name: "deal_pipeline_totals",
  description:
    "Get the pipeline by the numbers: deal count and value per stage, open and closed totals, and the probability-weighted commission forecast. Use for 'what's my pipeline worth', 'how much is under contract', 'what am I on track to make'. Returns figures, not prose — analyze_book is the one that reasons.",
  inputSchema: {
    type: "object",
    properties: { dealType: { type: "string", enum: ["Sale", "Lease"] } },
    additionalProperties: false,
  },
});

// ── Write / actions on existing records ──────────────────────────────────────

export const updateContactDef = toolDefinition({
  name: "update_contact",
  description:
    "Update fields on a contact who is already in the book — a new phone, a job change, a corrected email. Only pass the fields that change; anything you leave out is left alone. To ADD someone new, use create_contact. Their relationship stage is NOT settable here: it is derived from their deals (see contactStage.ts), so move the deal and the stage follows.",
  inputSchema: {
    type: "object",
    properties: {
      contactId: { type: "string" },
      contact_name: { type: "string", description: "Their name, when you have no id." },
      first_name: { type: "string" },
      last_name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      company: { type: "string" },
      title: { type: "string" },
      notes: { type: "string" },
    },
    additionalProperties: false,
  },
});

// ── Cross-record ─────────────────────────────────────────────────────────────

export const briefDef = toolDefinition({
  name: "brief",
  description:
    "Summarize a DEAL, LISTING, PROPERTY or TASK and its recent history — where it stands, the numbers, who's involved, what's open. Use for 'brief me on the Delgado deal', 'catch me up on 400 W Monroe', or a specific question about one of those records (pass it as `question`). For a CONTACT use research_contact / answer_about_contact instead — those know what a person's brief is made of.",
  inputSchema: {
    type: "object",
    properties: {
      recordType: { type: "string", enum: ["deal", "listing", "property", "task"] },
      recordId: { type: "string" },
      question: {
        type: "string",
        description: "A targeted question. Omit for a full brief.",
      },
    },
    required: ["recordType", "recordId"],
    additionalProperties: false,
  },
});

export const supportDef = toolDefinition({
  name: "support",
  description:
    "Hand the broker off to Buildout support. Use ONLY when they need help with the SOFTWARE that you cannot do yourself — billing, a permissions or account problem, a bug, a feature they can't find. Never use it to escape a question about their data; answer those.",
  inputSchema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "What they need help with, in one line." },
    },
    required: ["topic"],
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
  sendEmailDef,
  buildCallListDef,
  buildMarketingPackageDef,
  researchContactDef,
  answerAboutContactDef,
  analyzeBookDef,
  navigateToDef,
  addActivityDef,
  logCallDef,
  createTaskDef,
  findContactDef,
  createContactDef,
  planMyDayDef,
  startCallDef,
  taskSearchDef,
  taskLoadDef,
  activitySearchDef,
  activityLoadDef,
  attachmentListDef,
  attachmentLoadDef,
  voucherSearchDef,
  voucherLoadDef,
  researchPropertySearchDef,
  researchPropertyLoadDef,
  dealPipelineTotalsDef,
  updateContactDef,
  briefDef,
  supportDef,
];
