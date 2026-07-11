# Data Layer Foundation — Design

**Date:** 2026-07-10
**Status:** Approved (pending spec review)
**Scope:** The relational data foundation + action surface. AI (voice, chat/omnisearch)
and data-creating workflows are **follow-on specs** that build on this — not in scope here.

## Goal

Make the prototype's data behave like a real product: a single, relational, persistent
source of truth so that Properties, Contacts, and Deals click through consistently
(the contact you open inside a deal is the same contact on the contact page; a deal
opened from a contact carries the correct attached data). Do this in a way that
**lends itself to a future AI layer** without a later refactor.

### Success criteria

1. **Behavior parity.** Every existing screen, feature, and flow works exactly as it
   does today. This is a plumbing refactor; the UI does not change.
2. **Relational integrity.** Any entity opened from any direction resolves to the same
   underlying object with the same data.
3. **Persist across refresh.** Mutations made during a demo (e.g. "add a deal") survive
   a page reload.
4. **Reset to a clean, identical state.** A one-click reset returns the world to a
   byte-for-byte identical clean state (deterministic seed), so demos are repeatable
   and consistent between presentations.
5. **AI-ready.** The write path (actions) and read path (selectors) form a typed,
   JSON-serializable catalog that a future AI layer can consume as its toolset with no
   structural changes.

### Explicitly out of scope

- AI inference, streaming, voice, chat/omnisearch (own spec + "grill session" later).
- Data-creating workflows beyond what already exists (they fall out of the action layer).
- Any change to authentication or `src/routes/login.tsx` (CLI-managed, untouched).

## Approach

**Client-owned, reactive store persisted to the browser (IndexedDB), seeded from the
existing deterministic generator, with a reset control.** Chosen over an event-sourced
log (more machinery than needed now; snapshot captures the same benefit via named
actions) and over a server-authoritative store (Vercel serverless is stateless/ephemeral —
a module singleton can't reliably persist mutations across cold starts without external
infra like KV/Postgres).

### Why this fits Vercel + the existing auth

- **Zero server data state.** Each presenter's world lives in their browser. Vercel just
  serves static JS + an SSR shell. No KV/DB to provision.
- **Auth is already correct and stays as-is.** `lib/auth.ts` uses an encrypted-cookie
  session checked server-side in `beforeLoad` — stateless, Vercel-safe, unaffected by
  moving data to the client. The gate runs at route load before any app screen renders,
  so client-rendering the data does not weaken the gate.
- **Boundary:** stateless server (auth gate today; a stateless AI stream-relay later) ·
  client-owned data world.

## 1. Entity model & relationships

Four entities. `Listing = Deal` stays **merged 1:1** — this is a demonstrated feature of
the prototype, not an accident.

```
Property ──1:N──►  Listing/Deal          (listing.propertyId)
Property ◄─N:N──►  Contact                (contact.propertyIds)
Listing/Deal ◄─N:N─► Contact             (listing.sellerContactIds / buyerContactIds / otherContactIds)
Comp ── attached to Property / Listing
```

**Rule: one source of truth per relationship; reverse directions are computed, never
stored twice.** The listing's contact-id arrays remain the source of truth for who is on
a deal; selectors compute the reverse (`listDealsForContact`). This is what guarantees
click-through consistency — there is only ever one copy of a relationship, so every
direction resolves the same object.

No new denormalized `contact.dealIds` field (would require sync and risk drift).

## 2. The store — client-owned & reactive

A single reactive `DataStore` holding Maps keyed by id (`properties`, `listings`,
`contacts`, `comps`), built on **Zustand** — the project's existing state library. It is
a declared direct dependency (`zustand ^5.0.14`) and already used in
`src/features/editor/store.ts` (`create` + `useShallow`), so this store follows an
established in-repo pattern rather than introducing a second state solution. (TanStack
Store is present only transitively and used nowhere in `src` — deliberately not adopted.)

Lifecycle on load:

1. Check IndexedDB for a saved snapshot.
2. Snapshot present and `SEED_VERSION` matches → hydrate from it.
3. Otherwise → run `generateDataset()` (the existing deterministic seed) → populate →
   write the initial snapshot.

**SSR:** the server renders the seed *base* world as a skeleton; the client hydrates the
*real* world from IndexedDB after mount. Data-driven screens are effectively
client-rendered (skeleton → hydrate); SSR is retained where it is free (routing, the
login/marketing shell, meta).

## 3. Action layer (single write path) + selector layer (read path)

The core of AI-readiness. **No component mutates the store directly.**

**Actions** — named, typed, **JSON-serializable args**, return **structured results**;
each mutates the store → persists (debounced) → returns a result:

- `createDeal`, `updateDealStage`, `linkContactToDeal`, `unlinkContactFromDeal`
- `createContact`, `updateContact`
- `addComp`, `updateProperty` (folds in existing mutators)
- `navigateTo` (navigation wrapped as an action, so "AI navigates the prototype" is just
  another callable action)

**Selectors** — named read functions:

- `getProperty`, `getListing`/`getDeal`, `getContact`
- `listDealsForContact`, `listContactsForDeal`, `listDealsForProperty`
- `searchAll` (omnisearch over the in-memory world — dataset is small, no vector DB)
- existing: `getContactDetail`, `getPropertyOptions`, `getContactOptions`, `getSellerOptions`

These two catalogs are the exact surface a future AI layer consumes as its toolset.
Constraints that make that free: JSON-serializable action args (models emit JSON tool
calls), structured return values (so a tool call reports back), File blobs handled via a
separate path (not passed as primary action args).

## 4. Persistence & reset

- **Persistence:** debounced full-snapshot write to **IndexedDB** after each action.
  IndexedDB (not localStorage) because `dealFiles` carries real `File`/`Blob` data, which
  localStorage cannot store. A thin wrapper (e.g. `idb-keyval`) is sufficient.
- **Snapshot:** serialized entity Maps + `SEED_VERSION`. Blobs stored natively.
- **Reset demo:** a control that clears the IndexedDB store → reseeds → repopulates →
  byte-for-byte identical clean state. **Does not clear the auth cookie** — the presenter
  stays logged in.
- **Seed versioning:** if seed logic changes later, a bumped `SEED_VERSION` auto-discards
  stale snapshots on load and reseeds — presenters never get a half-old broken world.

## 5. Consolidating the sprawl

`src/data/` currently mixes three different kinds of thing. One rule per bucket:

- **Real / cross-referenced entities → into the store.** Point the People screens at the
  store instead of standalone contact data.
- **Mutable per-entity fixtures → into the store** (e.g. `dealFiles` — files are
  added/deleted, so they must persist through the same snapshot).
- **Read-only view fixtures → stay as generators, made deterministic, seeded off the
  entity id** (`listingTraffic`, `listingDemographics`, `listingWebsiteActivity`,
  `listingSyndication`, `listingWebsiteSettings`, `listingClientReport`). Stable across
  refresh; no need to persist what never changes.
- **Display/presentation metadata is NOT data → move out of `src/data/`** and colocate
  with components (the pill/`RELATIONSHIP_DISPLAY` maps and formatters currently in
  `data/contacts.ts`; `EMAIL_STATUS_DISPLAY` in `data/emails.ts`). Rename to reflect
  intent (e.g. `contactDisplay`).

## 6. Auth & SSR boundary (unchanged)

The encrypted-cookie gate in `lib/auth.ts` stays exactly as-is; `login.tsx` is untouched
(CLI-managed). The gate runs at `beforeLoad`; the data world lives behind it, client-side.
A single **stateless** server AI stream-relay is reserved for the later AI session — it
holds the model key and relays tokens, holds no data or session world, and does not
reintroduce stateful-server problems on Vercel.

## 7. Visible changes (all improvements, called out to avoid surprises)

Behavior parity holds, with these intended differences:

- Mutations now persist across refresh (today a server-side add can vanish on a Vercel
  cold start).
- A new **Reset demo** control appears.
- Any screen that today reads a standalone fixture diverging from the store will now show
  the **canonical** value (a correction, technically a visible change).
- Read-only fixtures that currently reshuffle per visit become stable.

## 8. Sequencing (high level — detailed steps go in the implementation plan)

Each step is independently shippable and testable:

1. Client store (TanStack Store) + IndexedDB persistence + reset, seeded from the existing
   `generateDataset()`.
2. Build the action + selector catalog; fold existing mutators (`updateProperty`, etc.)
   into it.
3. Repoint consumers: `lib/*.ts` server functions → client selectors; components read via
   selectors and write via actions. (This step touches every data-reading screen — it is
   mechanical but broad.)
4. Fold mutable fixtures (`dealFiles`) into the store; make read-only fixtures
   deterministic; extract display metadata out of `src/data/`.

## 9. Testing

- `createDeal` links both sides of the relationship; `listContactsForDeal` and
  `listDealsForContact` resolve the reverse correctly.
- Reset restores a byte-for-byte identical world to the initial seed.
- A mutation followed by a simulated reload (rehydrate from snapshot) preserves the change.
- Seed-version bump discards a stale snapshot and reseeds.
- Existing `seed.test.ts` continues to pass (behavior-parity guard).

## Open items for the later AI spec (not decided here)

- Which TanStack AI / streaming utilities and model provider wiring to use.
- Tool-call execution loop (client executes actions/selectors as tools; server relays
  the stream holding the key).
- Whether to add an action log at that point (for AI audit/history) on top of snapshots.
