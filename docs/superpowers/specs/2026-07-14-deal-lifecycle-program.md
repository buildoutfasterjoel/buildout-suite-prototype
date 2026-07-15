# Program Spec: Unified Deal Lifecycle in the Prototype

**Status:** Approved program spec (2026-07-14). Umbrella doc for a four-phase initiative.
**Phase specs:** `2026-07-14-phase-1-property-records-create-deal.md` · `…-phase-2-field-catalog.md`
· `…-phase-3-deal-marketing.md` · `…-phase-4-stage-gate-workflow.md`
**Source docs:** `deal-flow-new-model-requirements.md` · `listing-field-audit.md`

> This is a program spec, not a build. It decomposes the "merge listings + deals + property fields"
> initiative into an overview (this doc) + four phase specs, each iterable in its own session. Phase 1
> is fully detailed in its own file; Phases 2–4 are specified at design-level, enough to hand off, and
> each should get its own short brainstorm before implementation.

---

## Context

Two production concepts aren't in this prototype yet:

1. **New combined deal-flow model** (`deal-flow-new-model-requirements.md`) — listings + deals become
   one 5-stage lifecycle (`Proposal → Active → Under Contract → Close`, plus `Dead` from any stage) with
   **gates** between stages.
2. **Property-vs-listing field split** (`listing-field-audit.md`) — the old property-edit form divides
   into a durable **Property record** and deal-level **marketing/transaction** fields.

The prototype is already ahead of both: **a `Listing` *is* the deal** (1:1, `src/data/types.ts`), the
5-status ladder already exists (`proposal · active · under-contract · closed · inactive`), and the
property↔deal↔contact graph is reciprocal and seeded. So the remaining work is: **(a)** make Property a
navigable record and seamless deal-origin, **(b)** decide where every field lives, **(c)** surface the
marketing fields on the deal, **(d)** add the stage gates that make the lifecycle real. This program
sequences those into shippable slices.

**North Star:** *a broker moves fluidly from a Contact or Property record into a Deal, and the Deal
carries that context all the way through a gated, end-to-end lifecycle.*

---

## The end-to-end Deal lifecycle

| Stage | What happens | Gate INTO this stage | Owning phase |
|---|---|---|---|
| **Origin** | Broker starts a deal from a Property or Contact record. Deal is created at **Proposal**; AI auto-generates a starter plan + draft docs (underwrite, proposal, BOV). | — | **P1** |
| **Proposal** | Broker sets the deal up to sell a property: deal type, property facts (from the Property record), primary broker + split, economics, **Seller**, and marketing content. | (creation) | P1 creates · P3 marketing · P4 gate-out |
| **Active** | Public listing. Marketing items flagged public go live; **leads** attach; tours/offers happen **outside** Buildout. | **Approve-and-publish** gate: broker attests *seller confirmed* + *AI docs reviewed*; captures Seller, Side, listing dates. Publishing flips the flagged marketing set live. | **P4** (needs P3 flags) |
| **Under Contract** | Accepted offer recorded. | Capture **Buyer** (required), Contract Executed / Close dates, economics. | **P4** |
| **Close** | Contracts signed; hands off to back-office (voucher / receivables / broker earnings). | Close date + economics. | **P4** |
| **Dead** | Reachable from any stage. | Dead Reason + Close date. | **P4** |

---

## Where fields live (resolved in detail by Phase 2)

- **Property record** (durable / Insights-level): location, property identity, building, unit shells,
  county+tax. Read-only on the Property page in P1; editing later.
- **Deal — marketing** (Proposal/Active): titles, descriptions, bullets, property use, investment type,
  sale terms, marketing channel + visibility tier, sale-side financials + scenarios, lease-side terms
  per space. Surfaced in P3 with per-item **public/private** flags.
- **Deal — transaction / financials** (Under Contract/Close): Buyer, critical dates, sale price,
  commission, voucher/receivables/earnings. Partly present in Back Office tabs; gated in P4.
- **Ambiguous** (Occupancy, Rent Roll, Notes) and **Lease spaces** (each with its own status ladder —
  the real "one listing → many deals" case): classified by Phase 2.

---

## Glossary

- **Property** — the physical asset/parcel; durable across many deals. Now a first-class record (P1).
- **Deal (= Listing)** — one marketing/transaction engagement on a property; 1:1 with a `Listing` today.
- **Space** — a leasable sub-unit of a property with its own status ladder (future: one property/listing
  → many space-deals).

---

## Dependency graph & sequencing

```
P1 (records + create)  ─┐        (P1 and P2 are independent; can run in parallel sessions)
P2 (field catalog)     ─┴─▶ P3 (deal marketing)  ─▶  P4 (stage-gate workflow)
                            P2 ───────────────────────▶ P4
```

- **P1** — no dependencies. Ships value immediately.
- **P2** — no build dependencies (analysis + type changes); its catalog **gates P3 and P4**.
- **P3** — depends on P2 (which fields are marketing, their public/private flags).
- **P4** — depends on P2 (transaction/financial field homes) **and** P3 (publish flags for the
  approve-and-publish gate).

Each phase then gets its own **implementation** plan (`writing-plans`) in its own session, in dependency
order (P1 and P2 first, then P3, then P4). Phases 2–4 should each get a short brainstorm session of their
own before implementation — this program spec scopes them, it doesn't finalize their internal design.
