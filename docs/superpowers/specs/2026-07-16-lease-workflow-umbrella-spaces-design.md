# Lease Workflow — Umbrella Representation + Space Deals — Design

**Status:** Approved design (2026-07-16), pending spec review.
**Relates to:** `2026-07-14-deal-lifecycle-program.md` (resolves the deferred *"Lease spaces — the
real 'one listing → many deals' case"*) and `2026-07-14-phase-4-stage-gate-workflow-design.md` (the
sell-side gated lifecycle this reuses).
**Scope:** Landlord rep only (sell-side). Tenant rep (buy-side) is out of scope for this pass.

---

## Goal

Give leases the same gated lifecycle the sale flow has, and solve the multi-space case brokers
actually hit: a broker wins representation for a whole property (e.g. a shopping mall), then markets
and leases each space individually. The flow should feel seamless — design the marketing once on the
representation deal, then spin up pre-styled space listings that each run their own pipeline.

**North star:** *the broker builds one representation deal, wins it, and from that same deal spawns a
child deal per space — each inheriting the parent's design and running the full 5-stage lifecycle on
its own accord.*

---

## The model

### Umbrella + children, one `Listing` type

A `Listing` already **is** a deal (1:1). We add a lightweight parent link rather than a new entity:

```
Listing {
  ...existing...
  parentDealId: string | null   // null = top-level (flat deal OR umbrella parent);
                                 //  set  = a child space deal, points at the umbrella
  tenantContactIds: string[]     // NEW dedicated dataset (Tenant ≠ buyer); may be cleaned up later
}
```

- **Flat lease deal** — starts `parentDealId: null`, whole-property scope (`unitId: null`). This is the
  "pursuing representation" deal.
- **Child space deal** — `parentDealId: <umbrella>`, `unitId: <a Property unit>`.
- **`isUmbrella` is derived, not stored:** `listings.some(l => l.parentDealId === id)`. Used only for UI
  (Spaces tab, rollup badge, parent-card space count) — never for gate logic.
- Children are found by `listings.filter(l => l.parentDealId === parentId)` — no array on the parent to
  keep in sync.

### The parent stays marketable and keeps the full ladder

The representation deal is attached to the whole property and **remains a marketable listing on its own
accord**. It is *not* restricted to a two-state lifecycle:

- The **expectation** is the parent wins representation, lands on **Active**, and parks there as the
  umbrella while children work.
- But the parent keeps the **full 5-stage lease ladder** available, because "someone leases the entire
  property as one deal" is real — then the umbrella itself goes Under Contract → Closed with its own
  tenant and contract. `resolveGate` therefore needs **no umbrella-suppression logic**; a parent is just
  a normal sell-side lease listing that happens to have children.

### The parent as design template

The documents/marketing the broker builds in the editor on the parent deal establish the **design and
branding language** for the whole assignment. Each child **snapshots** that template at creation and
then customizes it per space — so the broker designs once and gets pre-styled space listings.

---

## Creation & promotion flow

### Starting a lease deal (extend `CreateDealModal`)

1. Broker picks **Landlord (Listing)** side + **Lease** type + a **Property** (source of truth).
2. Deal is created **flat** at Pitching: `parentDealId: null`, `unitId: null` (whole property). Not yet
   an umbrella.
3. Broker fills whole-property representation fields and builds marketing in the editor — this is the
   template.

### "Add space" — the promotion (Property is source of truth)

An **"Add space"** action appears in **both** the deal header **and** a dedicated **Spaces tab**.

- Opens a picker of the **property's existing `units`** (Suite 100, Suite 200…) as checkable rows, plus
  **"+ New space."**
- **Checking existing units** → one child deal per unit, each bound to that `unitId`, each snapshotting
  the parent's template + property info.
- **"+ New space"** → inline form (label, SF, type) that **writes a new `PropertyUnit` back to the
  property record first**, then spawns the child bound to it. The property record stays honest — every
  marketed space is a real unit on the asset.
- Adding the first space makes the parent an umbrella (derived, once a child exists). No stored flag
  flip needed.

### What a child inherits at creation (snapshot, per decision below)

- Marketing design/template scaffold (copy structure, bullets, branding) from the parent
- Property facts (resolved live from the Property anyway)
- Landlord/owner contact(s), primary broker + split, lease-standard terms (e.g. NNN)
- Broker then customizes rent, SF, and description per space.

---

## Template inheritance — snapshot + explicit re-sync

- Child **copies** the parent's marketing design + relevant facts at creation, then is fully
  independent (no live binding, no per-field override tracking).
- A **"Re-sync from parent"** action on the child re-pulls the parent's current template behind a simple
  confirm ("overwrite this space's styling with the parent's latest?").
- Demo moment: add a space → it already looks like the parent.

---

## The gates

Reuse the existing engine: `resolveGate(from, target, dealType)` in `src/data/stageGates.ts` already
takes `dealType` and already branches for lease (no asking/sale price). This design **completes** the
lease branch — it does not add a new gate engine, and adds **no umbrella-specific branching**.

### Child space deal — full 5-stage sell-side lease

| Gate | Lease meaning | Required fields (lease branch) |
|---|---|---|
| **Pitching** | Space being set up | (creation — inherits parent template) |
| **→ Active** — Approve & Publish | Space listing goes live | `leaseTitle`, `leaseDescription`, **`leaseRate` + `leaseRateUnits`** (replaces `askingPrice`), `availableSqFt`, `aiDocsReviewed`, `websiteReviewed`, `listedOnDate`, `listingExpirationDate` |
| **→ Under Contract** | LOI / lease out for signature | **`tenantLinked`** (≥1 `tenantContactIds`), `leaseTermMonths`, `commissionAmount` |
| **→ Closed** | Lease signed, tenancy start set | **`leaseCommencementDate`** (tenancy start) + executed date; economics carried read-only |
| **→ Lost** | Space didn't lease | `deadReason`, `closeDate` |

### Umbrella parent — same ladder, no suppression

The parent uses the **identical lease gate config** as a child. In practice it publishes the
whole-property listing at → Active and parks; but if the whole property leases as one deal, it advances
through Under Contract → Closed normally, capturing its own tenant/economics/commencement.

### Data-model additions for the gates

- `tenantContactIds: string[]` on `Listing` (Tenant dataset; gate `tenantLinked` checks it).
- `leaseCommencementDate: string | null` on `DealTransaction` (tenancy start captured at → Closed).
- Lease branch of `resolveGate` updated: → Active requires `leaseRate`/`leaseRateUnits`/`availableSqFt`
  (not `askingPrice`); → Under Contract requires `tenantLinked` (not `buyerLinked`) + `leaseTermMonths`;
  → Closed requires `leaseCommencementDate`.
- `GateFormState` / `seedGateForm` / `fieldSatisfied` extended for the new required fields, reusing the
  existing `SpaceLeaseTerms` fields where possible.

---

## UI & rollup

- **Umbrella deal page:** a **Spaces tab** listing child deals as rows (space label, own stage chip,
  rent, tenant), plus the **"Add space"** button. A **small info section on the parent** (and on the
  **parent's pipeline card**) shows the **total number of space deals** and their stage breakdown
  (e.g. "5 spaces · 2 Active · 1 Under Contract · 1 Closed") — all derived from children.
- **Child deal page:** a **parent link/breadcrumb** back to the umbrella ("Part of: {Property}
  representation") and the **"Re-sync from parent"** action.
- **Board / pipeline:** child spaces appear as **their own independent cards** (each runs its own
  pipeline), each marked with the **`faVectorSquare`** flair (the same per-space glyph the marketing
  editor uses next to each unit) so a unit space is visually distinct from a whole-property deal.

---

## What we reuse (not rebuild)

- `Listing` type (add two fields), `resolveGate` / `StageGate` / `useStageGate`, `SpaceLeaseTerms`,
  the lease marketing fields on `DealMarketing`, `PropertyUnit` shells, and the existing publish/
  `SyndicationStatus` machinery. A child space deal is a normal sell-side lease listing with a
  `parentDealId`.

## Non-goals

- Tenant rep / buy-side leases (untouched, as buy-side is elsewhere in the app).
- Live template inheritance / per-field override tracking (snapshot + re-sync only).
- Umbrella auto-rollup that *moves* the parent's stage (rollup is display-only; the broker moves the
  parent by hand).
- Cleaning up the `tenantContactIds` vs `buyerContactIds` split (flagged for a later pass).

---

## Verification

- **`resolveGate` (unit):** for `dealType: 'Lease'`, → Active requires the lease content set (rent
  units, available SF; no `askingPrice`); → Under Contract requires `tenantLinked` + `leaseTermMonths`;
  → Closed requires `leaseCommencementDate`. A parent (has children) resolves the **same** config as a
  child — no suppression.
- **Promotion (unit/action):** "add space" on a flat deal creates a child with the right `parentDealId`
  + `unitId`; adding an off-record space writes a new `PropertyUnit` to the property first; the parent
  becomes an umbrella by derivation.
- **Inheritance (unit):** a new child snapshots the parent template; "re-sync" re-pulls it.
- **Rollup (unit):** the parent's space count + stage breakdown derive correctly from children.
- **Manual (in-app):** create a lease representation deal → win it to Active → add spaces from property
  units + one new space (writes back to property) → each child publishes and runs its own pipeline to
  Closed with tenant + commencement date; child cards show the `faVectorSquare` flair; parent card shows
  the space count.
