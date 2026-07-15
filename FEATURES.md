# Buildout Suite Prototype — Feature Overview

A snapshot of everything built so far in this prototype. It's a client-only demo: all data lives in a Zustand store persisted to IndexedDB, seeded deterministically on first load, and fully resettable ("Reset demo" in the profile menu).

---

## Global App Shell & Navigation

- **`AppShell`** wraps every route with a global navbar, an optional right-hand AI assistant sidebar, and an Omni Search overlay. It shows a centered spinner until the IndexedDB store hydrates.
- **`GlobalNavbar`** — brand mark linking to `/suite`; primary nav items **NOW** (`/suite`, shown live with a pulsing dot), **Tasks**, **Properties**, **People** (`/backoffice/contacts`), **Deals** (`/listings`), **Reports** (Tasks/Reports have nav entries but no routes behind them yet; Properties is now a live route).
- An inline Omni Search trigger with a platform-aware ⌘K / Ctrl K badge.
- A "+New" dropdown (Activity/Task/Note/Contact/Deal) — **Deal** now opens the shared create-deal modal (empty, no context); Activity/Task/Note/Contact remain stubbed, not wired to real creation flows.
- An AI Assistant launcher (toggles the sidebar) and a Notifications bell (static badge, not live).
- Profile menu — avatar for a fixed demo user ("Ethan Thompson"), a cosmetic **role switcher** (Principal/Broker/Marketing, persisted to `localStorage`, doesn't gate features), and **Reset demo** (wipes and reseeds the IndexedDB store, then reloads).

## Search (Omni Search)

- Global modal opened via ⌘K/Ctrl K or the navbar trigger.
- Searches **Properties**, **Deals/Listings**, and **Contacts** by substring match across name/address/company/email/etc., grouped under labeled headers (capped at 5 results per group).
- Selecting a property result routes to its property record page (`/properties/$id`), not a listing.
- Always appends a **"Create deal for '‹query›'"** row — selecting it opens the shared create-deal modal with the raw query seeded into the property address field.
- Always appends an **"Ask AI: '<query>'"** row — selecting it opens the AI assistant and auto-sends the query as a prompt.
- Full keyboard navigation (↑/↓/Enter) plus mouse hover; selecting a result routes directly to that property, deal, or contact record.

## AI Assistant

- **Streaming chat** over SSE via a TanStack Start server function (`aiChat`) that holds the Anthropic API key server-side and calls Claude (currently `claude-sonnet-5`).
- **Client-executed tools** — tool schemas are defined server-side but actually run in the browser against the live data store, so no app data leaves the client except the conversation text.
- Tools available to the assistant:
  - *Read*: `searchAll`, `listContacts`, `listDeals`, `getContactDetail`, `listDealsForContact`, `listDealsForProperty`, `listContactsForDeal`, `getProperty`, `getListing`.
  - *Write*: `createDeal`, `updateDealStage` (restage a deal), `linkContactToDeal`, `createEmailDraft`, `createCallList`, `generateDoc` (produces a client-report summary + KPIs + link).
  - *Navigate*: `navigateTo` (routes the app anywhere).
- System prompt instructs the model to resolve names before acting and to act on writes without asking for confirmation (reset is the safety net).
- **UI**: a persistent 380px right sidebar, mounted globally, with a scope chip reflecting the current route. Renders GitHub-flavored markdown; tool results that return deals/contacts render as clickable interactive cards instead of prose; other tool calls show a small chip. Stop-streaming button. Starter suggestions: "Draft email," "Create call list," "Generate doc."
- Text-only — no voice input/output yet (flagged as a future direction).

## Suite Home Dashboard (`/suite`)

A broker's daily-driver landing page, built from mock + some live data:

- **Forecast** — weighted pipeline total plus open pipeline / open deal count / closed stats.
- **Your pipeline** — 6-stage horizontal snapshot (Seller signal → Nurturing → Pitching → Active → Under Contract → Closed), modeling pre-listing relationship stages distinct from a listing's lifecycle status.
- **Focus right now** — an AI-surfaced single highlighted lead/signal card with call-to-action buttons (visual only).
- **Tasks** — a flat overdue/today task list (mock data; no `/tasks` route yet).
- **Your listings** — reads real listings from the store, shows one active/proposal/under-contract example each with traffic stats or a days-to-close progress bar.
- **AI · Focus next** — a synthesized paragraph highlighting overnight signals, contacts without an open deal, active marketing, and closing deals, with visual-only action buttons.
- **Recent activity** — a flat notes/calls timeline.

## Properties

**Index (`/properties`)** — browse/search + filter over the full property book:
- Search by address/name/submarket, plus **type** and **status** Select filters, all combined client-side.
- Card grid shows a `PropertyRecordCard` per result with photo, type/status badge, size, and a # of deals badge; clicking a card routes to the record page.
- Reachable from the navbar's **Properties** nav item.

**Record page (`/properties/$propertyId`)** — a read-only, 3-column reference hub (mirroring the contact detail layout):
- **Facts** — property attributes card.
- **Deals on this property** — every linked deal rendered as a `DealCardById`, plus a header **New deal** action.
- **Owners + comps** — contacts linked to the property and its recorded sale/lease comps.
- The header repeats a top-level **Create Deal** CTA. No property editing yet — this phase is read-only.

## Deals / Listings Workspace

**Browse (`/listings`)** — three view modes:
- **Board** — Kanban by property status, drag-and-drop restaging (`@dnd-kit`), live weighted-forecast figure, Seller/Buyer/All toggle.
- **Grid** — property card grid with faceted filters (type, sale/lease, expiration, stage) and per-option counts.
- **Map** — Leaflet map, lazy-loaded client-only.
- Toolbar: address search, sort, "New Deal" (`CreateDealModal` — choose side, pick a contact, pick an existing property or type a new address, optional file drag-and-drop).
- A universal `DealCard` component is reused across the board, contact pages, and AI assistant results.

**Shared create-deal launcher** — a single `useCreateDeal` store (`openFor`/`close`) drives one globally-mounted `CreateDealModal`, so every entry point opens the same modal instance instead of each owning its own: the property record header/panel, a contact's Deals card ("New deal"), the navbar's **+New → Deal**, and OmniSearch's "Create deal for '‹query›'" row. `CreateDealModal` is context-aware — opened from a property it locks that property and pre-suggests the property's primary owner as the seller; opened from a contact it prefills that contact and sorts their own properties to the top of the property picker; opened bare (navbar/search) it starts empty.

**Listing detail (`/listings/$listingId`)** — header (thumbnail, breadcrumb, deal-type badges, syndication status, stage selector) + sticky tab rail grouped into **Deal**, **Marketing**, **Back Office**:

| Group | Tab | What it shows |
|---|---|---|
| Deal | Overview | Milestone/task timeline for the current stage, right rail with deal files, linked property, and seller/buyer/other contact accordions |
| Deal | Client Report | KPI tiles, activity summary, funnel chart, companies breakdown, leads table; export/share/duplicate actions |
| Deal | Activity | Unified feed of logged activities + stage-history transitions |
| Deal | Files | Full folder/file manager — upload, rename, move, delete, recycle bin, download |
| Marketing | Leads | Dense contact table linked to the property with search/filters |
| Marketing | Documents | Mock document table (Offering Memorandum, Floor Plan, Executive Summary) linking into the Document Editor |
| Marketing | Website | Analytics (traffic KPIs, area chart, activity log) + Settings (publish status, template, public URL sharing) |
| Marketing | Email | Campaigns filtered to this property's type |
| Marketing | Media | Placeholder — not modeled yet |
| Marketing | Demographics | Radius-ring map + categorized demographic data table |
| Marketing | Grids | Saved comparison grids, sale comps, lease comps |
| Back Office | Transaction | Internal/outside broker commission splits, transaction facts |
| Back Office | Financials | Gross commission stat tiles, commission breakdown donut chart, outside/internal commission and receivables tables |

- **Syndication Status** — modal showing third-party network connections with per-network toggles and a "Send Rep Email" action.

## Contacts / People CRM

**List (`/backoffice/contacts`)** — left sidebar of dynamic/static lists (Cold prospects to warm, Hot List, A List, Investors, plus AI- or user-created call lists) with an "All Contacts / My Lists" toggle. Main table: search, 5 data-driven filters (source, relationship stage, side, deal stage, assignee), sortable name column, pagination, row actions.

**Detail (`/backoffice/contacts/$contactId`)** — 3-column layout:
- Contact info, "Do Not Call" toggle, source, properties owned, tags, ownership/sharing.
- Engagement composer (Note/Call/Email/Task), an **AI Briefing** card synthesizing context, and a filterable activity feed.
- Linked **Deals** (as reciprocal deal cards) and an aggregated open-task count.

**Reciprocal Contact↔Deal↔Property linking** — a core data-integrity feature: each listing stores seller/buyer/other contact ID arrays; contact and deal detail pages both read from the same source of truth, so linking/unlinking a contact on one page is instantly reflected on the other. The seed data guarantees every property has ≥2 contacts so deals always resolve a distinct seller and buyer.

## Email Campaigns

**List (`/email`)** — quota ring for emails sent, performance stat tiles (delivered/opens/clicks/bounced/unsubscribed), Active/Archived tabs, search + filters (status, type, broker, audience list), table or calendar view, pagination.

**Detail (`/email/$emailId`)** — only reachable for sent campaigns; Performance tab has real charts/stats, Recipients and Preview Email tabs are "coming soon" placeholders.

## Document Editor (`/editor/$listingId`)

A Canva-style PDF builder for listing marketing documents, with its own dedicated state store (separate from the app data store):

- **Document model** — pages made of blocks; content blocks (heading, text, table, image, dynamic field, spacer, divider) and one level of layout containers (columns, section). Pages can be locked (template) or freeform.
- **Dynamic data binding** — fields bound to a `Property` (asking price, cap rate, NOI, address, etc.) resolve live and update everywhere they're used when the underlying listing data changes.
- **Canvas** — drag-and-drop block placement, reordering, and page reordering via `@dnd-kit`.
- **Panels** — Pages, Layers (per-page block tree), Blocks palette, Images, Settings.
- **Style panel** — font, size, weight, alignment, color, spacing controls per block/cell; table border and cell-specific styling; add/remove table rows and columns.
- Zoom (25–200%), "Save & Close" back to the listing's Documents tab, an "Edit Listing" dialog to patch bound property data. A "Switch to Classic Editor" flow exists but is explicitly mocked/unwired.

## Data Layer

Client-owned Zustand store, persisted to IndexedDB:

- Single store holds properties, listings, comps, contacts, deal files, emails, and call lists (all as `Map`s).
- Deterministic seed generator (fixed faker seed, versioned snapshot so schema changes auto-invalidate stale data) — 50 properties, 80 contacts.
- Debounced (300ms) persistence on every write; `reset()` wipes and reseeds for the "Reset demo" action.
- Layered read/write API: low-level store helpers, cross-entity selectors (search, contact/deal resolution), and a write-action catalog (`createDeal`, `updateDealStage`, `linkContactToDeal`, `createEmailDraft`, `createCallList`) — this same action/selector catalog is what the AI assistant's tools call into.
- Unit test coverage (Vitest) on the store, actions, selectors, persistence, seed logic, and the Overview tab's planner date/milestone math.

## Login / Auth

A single shared-password demo gate (`/login`, CLI-managed, not to be edited directly) — not a real per-user auth system. Redirects to `/` once a session cookie is present.

---

### Known gaps / stubs (for context, not exhaustive)

- **Tasks** and **Reports** have navbar entries but no routes yet.
- The navbar's "+New" menu is now wired for **Deal**; Activity/Task/Note/Contact remain stubs. The notification bell and several People/Leads filter dropdowns are still visual-only.
- Email **Recipients** and **Preview Email** tabs, listing **Media** tab, and the editor's "Classic Editor" switch are placeholders.
- Dashboard widgets on `/suite` are largely mock data except "Your listings," which reads the live store.
