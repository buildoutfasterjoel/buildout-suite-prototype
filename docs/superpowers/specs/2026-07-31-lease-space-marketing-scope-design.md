# Lease Space Marketing Scope — Shell + Space Deals — Design

**Status:** Approved design (2026-07-31), pending spec review.
**Supersedes parts of:** `2026-07-16-lease-workflow-umbrella-spaces-design.md` — specifically the
umbrella parent's full 5-stage ladder and the snapshot / "re-sync from parent" template inheritance.
Both are replaced below.
**Scope:** Landlord rep lease only. Sale deals and buy-side are untouched.

---

## The constraint this resolves

In the production application a lease listing is **one record**. The broker enables spaces inside the
listing edit form, and those spaces are rows on that record — so every space necessarily shares one set
of marketing materials: one brochure, one website page, one email campaign. There is no per-space
marketing and no near-term plan for one.

The prototype invents a layer above that: a representation deal that spawns a **child deal per space**,
each running its own pipeline. Nothing in the prototype currently shows what the production constraint
does to that layer. This design settles it.

## The spine

> **Marketing is published per building. Space terms — and the money they generate — belong to the space.**

Both halves of the rule are the same rule seen from opposite ends. A space deal has no marketing
surfaces because marketing is a building-level act. A shell has no Back Office because it holds no
rate of its own, so it earns no commission. Each fact explains the other.

---

## The scope model

| Scope | Surfaces | Rule |
|---|---|---|
| **Property-level** — shared, one copy | Documents, Website, Email, Demographics, Grids, Plans | Live on the shell only. A space deal has no such surface and never holds a copy. |
| **Unit-filtered** — shared store, scoped view | Media, Leads | One library on the property; a space deal renders a view filtered to its `unitId`. |
| **Space-owned** — the child's own record | `SpaceLeaseTerms` for its unit: lease rate, SF, term, TI, free rent, CAM/tax, availability, description | The only marketing-adjacent data a space deal owns. Back Office consumes it to compute that suite's commission and voucher. |

### Every enabled space is a child deal

`LeaseSpacesSection` is removed from the listing edit form. The **Spaces tab is the single home for
space management** — which spaces exist, their visibility, quick stage actions. Enabling a space and
creating its deal are **one combined act**: "Add space" writes the space's terms record and spawns the
child deal together. The "row in an array" mode disappears entirely; there is one concept, not two.

### Space terms editor — one component, two mounts

A single `SpaceTermsSection` component edits one unit's `SpaceLeaseTerms`, mounted in two places, both
writing to the **child deal's** record:

- **Inline on the shell's Spaces tab** — each row expands to the editor, so the broker can run the whole
  building's availability from one screen.
- **On the space deal's own edit form** — the space's terms edited where the space lives.

Every Listing-tab section other than this one is property-level, so a space deal's edit form collapses
to `SpaceTermsSection` plus the Deal tab's Setup, Transaction, and Financials sections — the last two
being exactly what the shell loses.

---

## Stage ladders

No new statuses. `PropertyStatus` is unchanged; the ladders differ by which values are *offered*, and
`proposal` is relabeled by deal shape.

| Deal shape | Ladder |
|---|---|
| **Shell** — a lease deal with ≥1 child | Pitching → Active → Lost |
| **Space deal** — has a `parentDealId` | Draft → Active → Under Contract → Closed → Lost |
| **Flat lease deal** — no children | Unchanged: full 5-stage ladder, keeps its financials |
| **Sale deal** | Unchanged |

- `inactive` already renders as **"Lost"** (`propertyDisplay.ts:54`), so the shell needs nothing new —
  `under-contract` and `closed` are simply suppressed from its stage control and gate engine.
- `proposal` renders as **"Pitching"** on a sale or shell deal and **"Draft"** on a space deal. A suite
  is never pitched — the assignment was already won at the shell — but it does need a pre-market state.
- `STATUS_LABELS` (`propertyDisplay.ts:49`) changes from a flat `Record<PropertyStatus, string>` to a
  function of status **and** deal shape. Roughly 8 call sites.

### Stage drives availability

For a promoted space, the availability status shown in the building's marketing **is** the child's deal
stage — not a separately maintained field. `SpaceLeaseTerms.status`
(`Active | Under Contract | Closed | Inactive`) and `PropertyStatus`
(`proposal | active | under-contract | closed | inactive`) are already the same ladder, so this is a
mapping, not a sync:

| Child stage | Shown in the building's marketing |
|---|---|
| Draft (`proposal`) | Not advertised — absent from the availability table |
| Active | Available |
| Under Contract | Under Contract |
| Closed | Leased |
| Lost (`inactive`) | Not advertised |

Moving Suite 200 to Under Contract flips the brochure and the website with no further action.

### The Draft → Active gate

Draft → Active is the moment the suite appears in the building's marketing, so it requires the space's
own numbers: **lease rate + rate units, available SF, and lease term**. Nothing reaches the public
brochure without them. This is what makes "stage is the status" safe to trust.

The child's → Active gate **no longer requires** `leaseTitle`, `leaseDescription`, `websiteReviewed`, or
`aiDocsReviewed` — those are property-level and not the child's to satisfy. It instead requires that
**the shell is Active** (the building's marketing is live), making the parent → child dependency
explicit: *"Suite 200 can't go live until 123 Main St's marketing is published."*

Under Contract and Closed gates are unchanged from the 2026-07-16 design (`tenantLinked` +
`leaseTermMonths`; `leaseCommencementDate`).

---

## Financials leave the shell

**Trigger:** the shell has ≥1 child (`isUmbrella`). Not status-coupled. Deleting every child restores
them.

**Removed from the shell:**
- Back Office → **Voucher** and **Invoices** (`Notes` stays).
- The edit shell's Deal tab → **Financials** and **Transaction Terms** sections
  (`DealMarketingEditor.tsx:659, 714`).

Money is earned per space, so a shell that never advances past Active has no commission to compute.

**Guard:** spaces cannot be added to a lease deal already past Active. The shell's ladder truncates the
moment it becomes an umbrella, and financials must not be stripped out from under a deal that is already
Under Contract or Closed.

---

## Navigation

### Space deal sidebar

| Group | Items |
|---|---|
| **Deal** | Overview, Activity, History, Files |
| **Marketing** | Media, Leads, **Property Marketing** |
| **Back Office** | Voucher, Invoices, Notes |

`Files` (the transaction's own LOI, lease, correspondence) is distinct from `Documents` (marketing
collateral) and stays on the child. `Spaces`, `Underwriting`, and `Client Report` are shell-only —
underwriting analyses the property, and the client report reports on the building assignment to a
landlord who is the same across every suite.

### Shell sidebar

| Group | Items |
|---|---|
| **Deal** | Overview, Client Report, Activity, History, Spaces, Files, Underwriting |
| **Marketing** | Leads, Documents, Website, Email, Media, Demographics, Grids, Plans |
| **Back Office** | Notes |

A flat lease deal and a sale deal keep today's sidebar unchanged.

### The Property Marketing hub

One **read-only** page on the space deal — the answer to "I'm on Suite 200 and I need to change the
building's brochure."

1. **Scope banner** — "Marketing for {Property} is shared across all {n} spaces."
2. **How this space appears** — the child's own terms and its stage-driven availability, read-only, each
   linking to `SpaceTermsSection` where they are actually edited. No duplicate inputs.
3. **Shared property marketing** — the six property-level surfaces with a last-updated stamp and an
   **Open ↗** action per row, navigating to that tab on the shell.

### Return context

Opening a shell surface from a space deal appends `?from=<childDealId>`. The shell's marketing tabs then
render a slim bar — *"Property marketing · shared by 5 spaces · ← Back to Suite 200"* — and the sidebar
preserves the param as the broker moves between marketing tabs, so the return path survives a hop from
Documents to Website. The param is dropped on any navigation outside the shell's Marketing group.

### Pipeline board

Unchanged from the 2026-07-16 decision: each space deal is an independent card carrying the
`faVectorSquare` flair. A large building therefore produces many cards; that is accepted.

---

## Data and code changes

**Deletions**
- `TEMPLATE_KEYS`, `applyTemplate`, `resyncChildFromParent` (`leaseSpaces.ts:10–23, 99–112`) and the
  "Re-sync from parent" action. With property-level marketing read through to the shell, there is
  nothing to snapshot and nothing to re-sync.
- `LeaseSpacesSection` as an edit-form section (`ListingFormEditor.tsx:111`). Its per-unit card becomes
  `SpaceTermsSection`.

**Fixes**
- `addSpaceToDeal` (`leaseSpaces.ts:87`) currently writes `emptySpaceLeaseTerms(unitId)` onto the child,
  forking a blank row away from the parent's array. With `spaces.tsx:86` reading the child's copy, a
  suite priced at $28/SF on the parent shows **"Rate TBD"** the moment it is promoted. The parent's
  existing row must **move** to the child, not fork.

**Additions**
- `VisualMediaLink` (`types.ts:120`) gains `unitId: string | null` so Media can filter to a unit.
- Leads gain a unit dimension. They are property-scoped today with no unit at all
  (`PropertyDetailLeads` reads `getLeadsForProperty(property.id)`), so an inquiry must record the space
  deal it arrived on before Leads can be filtered.

**Modifications**
- `PropertyDetailSidebar` `NAV_GROUPS` becomes deal-shape aware (shell / space / flat / sale).
- `STATUS_LABELS` and the stage control's offered options become deal-shape aware.
- `resolveGate` lease branch: the Draft → Active requirements above; shell gates capped at Active.

---

## Suggested build order

Four groups, each independently demoable. The first two carry the design's argument; the last is the
only part that needs new data collected.

1. **Ownership and promotion** — move the terms row to the child, delete the snapshot/re-sync code,
   extract `SpaceTermsSection` and mount it in both places, drop `LeaseSpacesSection` from the edit form.
2. **Ladders and gates** — deal-shape-aware `STATUS_LABELS` and stage options, the shell's truncated
   ladder, the Draft → Active gate, the stage → availability mapping, the past-Active guard.
3. **Scope navigation** — shape-aware sidebar groups, the Property Marketing hub, the `?from=` return bar.
4. **Unit-filtered surfaces** — `VisualMediaLink.unitId` and the leads unit dimension. Separable; the
   rest of the design stands without it, with Media and Leads showing the full property library in the
   interim.

---

## Non-goals

- Per-space marketing materials of any kind. That is the constraint, not a gap to close later in this
  pass.
- Tenant rep / buy-side leases.
- Changing how the property's marketing surfaces render internally — only what feeds their availability
  table changes.
- Board density mitigation (nesting, filtering). Independent cards were chosen deliberately.

---

## Verification

- **`resolveGate` (unit):** a space deal's Draft → Active requires rate + rate units + available SF +
  term and a shell at Active; it does **not** require `leaseTitle`, `leaseDescription`,
  `websiteReviewed`, or `aiDocsReviewed`. A shell offers only Pitching, Active, and Lost. A flat lease
  deal with no children resolves the full unchanged ladder.
- **Promotion (unit):** `addSpaceToDeal` moves the parent's existing `SpaceLeaseTerms` row for that unit
  onto the child and removes it from the parent. A suite priced before promotion shows its rate on the
  Spaces tab afterward, not "Rate TBD".
- **Financial suppression (unit):** Voucher, Invoices, and the Deal tab's Financials and Transaction
  Terms sections are absent for a listing with ≥1 child and present for one with none. Deleting the last
  child restores them.
- **Guard (unit):** "Add space" is unavailable on a lease deal past Active.
- **Availability mapping (unit):** each child stage maps to the marketing availability value in the
  table above; a Draft space is absent from the availability table entirely.
- **Labels (unit):** `proposal` renders "Draft" on a space deal and "Pitching" on a shell or sale deal.
- **Manual (in-app):** create a lease representation deal → win it to Active → add three spaces → the
  shell's Back Office loses Voucher and Invoices and its stage control offers only Pitching/Active/Lost
  → price one space from the Spaces tab and the same space from its own edit form, confirming both
  mounts write the same record → take that space Draft → Active and confirm it appears in the building's
  availability table → move it to Under Contract and confirm the table follows → from that space, open
  Property Marketing, jump to the shell's Documents, hop to Website, and confirm the "← Back to Suite
  200" bar survives the hop.
