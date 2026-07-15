# Phase 4 — Stage-Gate Workflow — Design

**Status:** Approved design (2026-07-14). Implements Phase 4 of the Unified Deal Lifecycle program
(`2026-07-14-deal-lifecycle-program.md`).
**Supersedes design-level notes in:** `2026-07-14-phase-4-stage-gate-workflow.md` (the program's
phase stub). This doc is the finalized design from the Phase 4 brainstorm.
**Dependencies:** Phase 2 (transaction/financial field homes) + Phase 3 (marketing publish flags).
**Source doc:** `deal-flow-new-model-requirements.md`

---

## Goal

Make the lifecycle real. Today a deal's stage changes commit instantly and unconditionally — the board
(`DealBoard`) drops straight into `updateDealStage`, and the detail-header `<Select>`
(`PropertyDetailHeader`) is local-only and doesn't even persist. Phase 4 turns **every** stage move —
in both directions, from either entry point — into a **gate**: a modal that captures the fields and
attestations the target stage requires (or confirms the consequences of a backward move) before it
commits.

## The five stages (unchanged)

The ladder is exactly what exists in `PropertyStatus` today — no stages are added, removed, or
relabeled:

```
Pitching → Active → Under Contract → Closed        (Lost reachable from any stage)
```

| `PropertyStatus` | Label (`STATUS_LABELS`) | Role |
|---|---|---|
| `proposal` | Pitching | Broker sets up the deal |
| `active` | Active | Public listing / live in market |
| `under-contract` | Under Contract | Accepted offer recorded |
| `closed` | Closed | Contracts signed; back-office hand-off |
| `inactive` | Lost | Terminal; reachable from any stage |

> The source requirements call these Proposal / Close / Dead. In this prototype they render as
> Pitching / Closed / Lost and **stay that way** — this is a deliberate decision, not an oversight.

---

## Core mechanic: `resolveGate(current, target)`

Every move routes through one pure function, `resolveGate(current, target)`, that returns a declarative
gate config. This is the single source of truth for what a transition requires and does; both entry
points and the tests consume it.

Direction is decided by a fixed ladder order:

```
proposal(0) → active(1) → under-contract(2) → closed(3)
```

`inactive` (Lost) is **off-ladder**. Rules:

- **target === `inactive`** → **dead** gate (from any stage).
- **target index > current index** (or current is `inactive`, i.e. reopening) → **field** gate for the
  target stage.
- **target index < current index** → **confirm** gate (backward move).

> **Gates are sell-side only.** The gated lifecycle — publishing, review attestations, the gates
> themselves — is a **listing** concept, and a listing is a sell-side engagement. Both entry points route
> through `requestStageChange(dealId, targetStage)`: when `dealSide === 'buyer'` the deal is not a
> listing, so it **commits the stage move directly with no gate** (and never shows the publish /
> `SyndicationStatus` surface); only `dealSide === 'seller'` deals open a gate. `resolveGate` therefore
> only ever runs for sell-side deals.

Three gate **kinds**:

| Kind | When | Behavior |
|---|---|---|
| **field** | Forward move | Hard block — the confirm button is disabled until every required field/attestation is satisfied. |
| **confirm** | Backward move | Confirmation gate stating the consequences; requires an explicit confirm. Closes the "shuffle a deal around to bypass a gate" loophole — backward moves are intentional, never free. |
| **dead** | Target = Lost | Hard block on Lost Reason + Closed date. |

> **Reopening from Lost:** because `inactive` is off-ladder, any move out of Lost is treated as a
> forward move into the target stage and opens that stage's **field** gate. There is no free re-entry.
> A stage with no field requirements (Pitching) yields an empty field gate that behaves as a plain
> confirm; reopening into Active runs the full approve-and-publish gate (re-attest before re-publishing).

---

## The gates

### Pitching → Active — Approve & Publish (the novel gate)

A broker-owned approval that publishes the listing — not a plain field save. Seller and Side are
**already captured at deal creation** (`createProposalListing` sets `dealSide` and links
`sellerContactIds`), so the gate does **not** re-collect them — it is a lean publish/compliance
checkpoint.

**Read-only summary (context, not editable):** Seller (from `sellerContactIds[0]`), Side (`dealSide`),
and property address — a "You're publishing this listing" panel so the broker sees what's going live.

**Attestations (all required):**
- **AI-generated document review checklist** — one row per document flagged `aiGenerated`, each with an
  **open** link (navigates to the deal's Documents view) and a ☐ **Reviewed** checkbox. **All** rows
  must be checked. If the deal has no AI-generated documents, the checklist section renders nothing and
  imposes no block.
- ☐ **Listing website reviewed** — broker attestation, with an **Open website** link to
  `/listings/$id/website` so the broker reviews the public page before it goes live.

**Fields (all required):**
- **Listing Executed** date (`transaction.listedOnDate`) — Blueprint calendar; not captured elsewhere.
- **Listing Expires** date (`transaction.listingExpirationDate`) — Blueprint calendar.

> Seller/Side are intentionally **not** gated fields here — they came from create-deal. The "Seller has
> confirmed" attestation from the original requirements was dropped in favor of the website-review
> checkpoint; seller confirmation stays an offline step.

**On confirm:** commit → `active`; set `publishedAt` = now; append a `DealHistoryEntry`; fire a
**Blueprint toast** ("Listing published"); `SyndicationStatus` flips to its Published state. Publishing
is conceptual — `marketing.publishFlags` already mark which items are public; going Active is what makes
them live.

### Active → Under Contract

**Required:** **Buyer** (≥1 `buyerContactIds`) · economics (`transaction.salePrice`,
`transaction.commissionPct` / `transaction.commissionAmount`).
**Optional:** Contract Executed date (`transaction.contractExecutedDate`), Closed date
(`transaction.closeDate`).
**On confirm:** commit → `under-contract` + history entry.

### Under Contract → Closed

**Required:** **Closed date** (`transaction.closeDate`). Economics were captured entering Under
Contract, so they render **read-only / carried** here — not re-required.
**On confirm:** commit → `closed` + history entry. The Back Office tabs (Voucher / Receivables /
Broker Earnings) are the home for settlement records; the **voucher is created after close, not gated**
by this transition.

### → Lost (from any stage)

**Required:** **Lost Reason** (`transaction.deadReason`) · **Closed date** (`transaction.closeDate`).
**On confirm:** commit → `inactive` + history entry.

### Backward moves (confirm gate)

Any move to a lower ladder index. The gate states the consequence and requires an explicit confirm; no
field capture.
- **Backward out of Active** (e.g. Active → Pitching) additionally shows ☐ **"Also unpublish this
  listing"**, default **on**. On confirm with the box checked, `publishedAt` is cleared and
  `SyndicationStatus` returns to its not-published state; unchecked, the listing stays published even
  though the stage regressed (published-state deliberately diverges from stage).
- **Backward not out of Active** (e.g. Under Contract → Active) is a plain confirm.

---

## Components & wiring

- **`resolveGate(current, target)`** — pure function returning `GateConfig`
  (`{ kind, title, requiredFields, attestations, sideEffects }`). Lives in a new
  `src/data/stageGates.ts` (or `src/components/deals/stageGate.ts`), unit-tested independently.
- **`StageGate`** — a Blueprint `Modal`. Props `{ deal, targetStage, open, onOpenChange, onCommitted }`.
  Renders the body for the resolved gate kind, holds a **working copy** of the editable fields, computes
  `canConfirm`, and on confirm calls existing actions (`linkContactToDeal`, `updateDeal`,
  `updateDealStage`) then appends the history entry, fires the toast, and calls `onCommitted`.
- **`useStageGate()`** — a small hook holding pending `{ dealId, targetStage }` + open state, shared by
  both entry points so the modal logic lives in one place.
- **Board** (`DealBoard` / `routes/listings/index.tsx`): `onRestage(listingId, target)` **no longer
  commits** — it opens the gate. Because the card is never optimistically moved, **cancel = nothing
  moves**; the board re-derives only on a committed transition (`onCommitted` bumps `version`).
- **Detail header** (`PropertyDetailHeader`): the stage `<Select>` opens the gate for the chosen target.
  The Select's value stays bound to `listing.status`, so **cancel auto-reverts**. Commit persists and
  the header re-renders.

## Data-model changes (small)

- Add `aiGenerated?: boolean` to `DealDocument` (`src/data/types.ts`). Seed the Phase 1 auto-generated
  starter docs (underwrite / proposal / BOV) with `aiGenerated: true` so the review checklist has rows.
- **Add `publishedAt: string | null` to `Listing`** (`src/data/types.ts`) — the persisted published
  marker (null = not published). It can diverge from `status` so the backward "keep published" choice is
  honored. Seed sets it for listings at Active/Under Contract/Closed; new proposals start `null`. Bump
  `SEED_VERSION`.
- **Repurpose `SyndicationStatus`** (`src/components/listings/SyndicationStatus.tsx`) to be
  **publish-aware** with three states derived from `publishedAt` + `status`:
  - `publishedAt` null → **"Not published"** (never went live) — muted dot.
  - `publishedAt` set and `status` is `closed` or `inactive` (Lost) → **"Previously published"** (was
    live, now off-market — preserves the history that it was published) — muted dot.
  - `publishedAt` set otherwise (active / under-contract) → **"Published"** or **"Published ·
    syndicating to N/M"** — active/warning dot.
  (The per-network `getListingSyndication` health data stays; it's layered under this headline.)
- Stage-transition commits append a `DealHistoryEntry` (`fromStage`/`toStage`/`actor`/`timestamp`).

## What does NOT change

- `STATUS_LABELS`, `PROPERTY_STATUSES`, `PropertyStatus` — untouched. Five stages, same labels.
- `DealSide` stays `'buyer' | 'seller'` — no "Dual".
- Back-office record creation (voucher etc.) — still post-close, not gated.

## Non-goals

- The AI `updateDealStage` tool (`src/ai/tools.ts`) stays a direct data action and **bypasses the gate
  UI** — it's the assistant acting programmatically, out of scope for this phase.
- No seller-facing confirmation flow (broker attestation only).
- No optimistic card movement / revert animation on the board (cancel simply leaves the card in place).

---

## Verification

- **`resolveGate` matrix (unit):** for every `(current, target)` pair the direction is classified
  correctly (forward → field, backward → confirm, →`inactive` → dead, out-of-`inactive` → field), and
  each field gate reports the right required-field set.
- **`canConfirm` (unit):** a field gate blocks until all required fields + attestations are satisfied;
  the AI-doc checklist blocks until every `aiGenerated` doc is checked; empty checklist does not block.
- **Commit (unit/action):** a committed transition sets the captured fields, flips `status`, and
  appends a history entry; Pitching → Active sets `publishedAt`; a backward-out-of-Active with unpublish
  checked clears `publishedAt` (unchecked leaves it set).
- **Manual (in-app):** dragging on the board and using the header Select both open the correct gate;
  cancel leaves the card/Select unchanged; Pitching → Active publishes (toast + SyndicationStatus flip);
  Under Contract → Closed captures the Closed date; Lost works from any stage.
