# Phase 1 — Property Records + Seamless "Create Deal from a Record"

**Status:** Approved design (2026-07-14). Part of the Unified Deal Lifecycle program
(`2026-07-14-deal-lifecycle-program.md`).
**Dependencies:** none — ships value immediately.

---

## Goal

Make a Property a first-class navigable record and let a broker start a deal seamlessly from a Contact
or Property, mining the existing property↔contact graph to pre-fill the other side of the deal.

## Locked decisions

1. Property record = **single-scroll reference hub**, mirroring the Contact-detail 3-column pattern,
   with a **Create Deal** CTA in the header.
2. Create flow = **context-aware + smart suggestions**, extending the existing `CreateDealModal`
   (not a new wizard).
3. Build **both** the Properties index and the detail page.
4. Entry points: Property header (given), **Contact record**, **navbar +New → Deal**, **OmniSearch**.

---

## Design

### Properties index — `/properties`

New `src/routes/properties.tsx` (AppShell + `<Outlet/>` one-liner like `listings.tsx`) +
`src/routes/properties/index.tsx`. Table/card grid of the 50 seeded properties: name+address, type
badge, size, status, **# deals** (`listDealsForProperty(id).length`), primary owner
(`getOwnersForProperty(id)[0]`); address search + type/status filters. Reuse the Deals **Grid** faceted
patterns from `src/routes/listings/index.tsx`. Row → `/properties/$propertyId`. The navbar `Properties`
item already points here (it 404s today because the route is missing).

### Property record page — `/properties/$propertyId`

New `src/routes/properties/$propertyId.tsx` mirroring `backoffice/contacts/$contactId.tsx`
(`col-lg-3 / col-lg-6 / col-lg-3` Bootstrap row); not-found → Blueprint `<Empty>`.

- **Header** (`PropertyRecordHeader`, new): name/address, type + status badges, thumbnail,
  **`[+ Create Deal ▾]`** CTA (opens `CreateDealModal` scoped to this property).
- **Left — Facts:** read-only Property fields (Property Info, Location, Tax, CRE metrics), grouped with
  existing `src/components/properties/propertyDisplay.ts` labels. No editing this phase.
- **Center — Deals + Activity:** `listDealsForProperty(id)` rendered with the universal **`DealCard`**
  + inline **[+ New deal]**; activity/notes a light placeholder.
- **Right — Owners/Contacts + Comps:** `getContactsForProperty` / `getOwnersForProperty` as linked rows
  (→ `/backoffice/contacts/$contactId`) + the property's comps.
- **Data:** add `getPropertyDetailClient(id)` in `src/data/selectors.ts` (property analogue of
  `getContactDetailClient`) assembling `{property, deals, owners, contacts, comps}`; add
  `listCompsForProperty` if no comps-by-property read exists.

### Context-aware Create-Deal flow

Extend `src/components/deals/CreateDealModal.tsx` (already takes a `contact` prop that prefills the
contact, hides the contact field, and sets `side` from `contact.side`). Add **`property?: Property`**:

- *From a Property:* prefill + **lock** the Property field; default **side = seller**; pre-select
  `getOwnersForProperty(property.id)[0]` as the contact (still editable). Empty if no owner on file.
- *From a Contact:* keep current behavior; **enhance** the Property field to surface the contact's own
  properties (`contact.propertyIds`) as quick-picks at the top of the list.
- *Inline create:* free-typing an unmatched address already creates a stub property
  (`createProposalListing` / `buildStubProperty` in `src/data/createListing.ts`). Add a minimal
  **`createContact`** action in `src/data/actions.ts` (none exists today) so an unmatched typed name can
  become a lightweight contact and be linked as seller/buyer.
- *On create:* unchanged — `createDeal(draft)` → new proposal-stage deal → navigate to
  `/listings/$listingId/overview`.

### Entry-point wiring

- **Property header** — CTA opens the modal with `property={property}`.
- **Contact record** — a Create-Deal action on the contact detail page (header or `ContactDealsPanel`)
  opens the modal with `contact={contact}`.
- **Navbar +New → Deal** — wire the stubbed menu item in `GlobalNavbar.tsx` to open the modal empty.
- **OmniSearch** — route property results to `/properties/$id` (not the current "first listing"
  fallback) in `src/components/search/OmniSearch.tsx`, and add a trailing **"Create deal for '‹query›'"**
  row that opens the modal with the query seeded into the property address field.
- Add a shared `useCreateDeal` open-state store (mirrors `src/components/search/useOmniSearch.ts`) so
  the navbar and record pages share one modal instance.

---

## Files (representative)

**New:** `routes/properties.tsx`, `routes/properties/index.tsx`, `routes/properties/$propertyId.tsx`;
`components/properties/PropertyRecordHeader.tsx` (+ facts/deals/owners cards); `data/useCreateDeal.ts`.
**Modified:** `components/deals/CreateDealModal.tsx`, `data/actions.ts` (`createContact`),
`data/selectors.ts` (`getPropertyDetailClient`), `components/layout/GlobalNavbar.tsx`,
`components/search/OmniSearch.tsx`, contact detail page, `FEATURES.md`.
**Never edit:** `routeTree.gen.ts` (auto-generated), `login.tsx`, `__root.tsx` (CLI-managed).

## Reused building blocks (do not rebuild)

`createProposalListing` / `emptyDraft` / `NewListingDraft` (`createListing.ts`) · `createDeal`
(`actions.ts`) · `listDealsForProperty`, `getContactDetailClient` (pattern), `searchAll`
(`selectors.ts`) · `getOwnersForProperty`, `getContactsForProperty`, `getPropertyOptions`,
`getContactOptions`, `getSellerOptions` (`store.ts`) · `DealCard`, `CreateDealModal`, the
faceted-filter/grid patterns from `listings/index.tsx` · Blueprint `Modal`/`Field`/`Combobox`/`Card`/
`Empty`/`Tabs`; FontAwesome **pro-regular**; Bootstrap utilities.

## Verification

Prototype is client-only; **no Playwright** (per CLAUDE.md) — run `bun --bun run dev` and drive by hand.
- Navbar **Properties** loads a browsable index (no 404); a row click opens the record page.
- Property record shows facts, deals-on-property (`DealCard`s), owners, comps; **Create Deal** locks the
  property and pre-suggests the owner as seller → create → lands on the new deal's overview → the new
  deal appears back on the property page (reciprocal).
- From a **Contact**: Create Deal prefills the contact; the contact's own properties appear as
  quick-picks.
- **+New → Deal** opens an empty modal; **OmniSearch** routes a property hit to `/properties/$id` and
  offers "Create deal for '‹query›'".
- `bun --bun run test` — extend store/selector tests to cover `getPropertyDetailClient` + `createContact`;
  keep existing tests green. Run `/prototype-review` before handoff.
