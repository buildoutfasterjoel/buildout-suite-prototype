# Phase 4 — Stage-Gate Workflow (the End-to-End Deal)

**Status:** Approved design (2026-07-14). Part of the Unified Deal Lifecycle program
(`2026-07-14-deal-lifecycle-program.md`).
**Dependencies:** Phase 2 (transaction/financial field homes) + Phase 3 (marketing publish flags).
**Source doc:** `deal-flow-new-model-requirements.md`

> The biggest, most novel phase. It carries several open questions from the source doc — give it its
> own brainstorm session before implementation.

---

## Goal

Make the lifecycle real — turn stage transitions into **gates** that capture the fields/attestations
required at each stage before committing, including the two novel gate types.

## Design

- **Stage transitions become gates.** Restaging (today `updateDealStage` in `src/data/actions.ts`)
  opens a gate that captures the fields required for the target stage before it commits. Build a
  reusable **StageGate** modal/flow keyed by the target stage.

- **Proposal → Active — approve-and-publish (novel):** a broker-owned action, not a plain field save.
  Gate conditions:
  - *Seller confirmed* — broker attestation (confirmation happens offline; broker asserts it in-app).
  - *AI-generated documents reviewed* — broker attestation / review checkpoint (a compliance step).
  - *Field capture* — Seller (required), broker **Side** (Buy/Sell/Dual), listing dates (Listing
    Executed / Listing Expires).
  - **Effect of passing:** the deal goes **Active** and **publishes the flagged marketing set** (Phase
    3). Reuse the existing syndication/publish surfaces where possible.

- **AI-document review checkpoint:** blocks publish until AI-generated docs are marked reviewed. Decide
  UX (single "I've reviewed" attestation vs. per-document checklist) and what marks a doc
  "AI-generated" — open questions to resolve in this phase's brainstorm.

- **Active:** the leads subsystem surfaces on this stage (reuse the existing Leads tab); tours/offers
  happen outside Buildout — only their outcome is recorded.

- **Active → Under Contract:** capture **Buyer** (required — the buy-side mirror of Seller), Contract
  Executed + Close dates, economics (Sale Price, Gross Commission % / $).

- **Under Contract → Close:** Close date + economics; **hand off to back-office** (voucher / receivables
  / broker earnings — the existing Back Office tabs). Decide whether Close *gates* on financial records
  or merely enables them (open question).

- **Dead — from any stage:** Dead Reason + Close date.

- **Backward moves / un-publish:** define what Active → Proposal does to the published listing (open
  question — the current model lets any stage move to any stage).

## Verification

Each transition opens its gate, blocks on missing required fields/attestations, and commits correctly;
approve-and-publish flips the deal to Active and publishes exactly the flagged marketing items; Dead
works from any stage; back-office records appear on Close.
