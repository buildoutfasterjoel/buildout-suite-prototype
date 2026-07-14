# Phase 3 — Deal Marketing Section

**Status:** Approved design (2026-07-14). Part of the Unified Deal Lifecycle program
(`2026-07-14-deal-lifecycle-program.md`).
**Dependencies:** Phase 2 (the canonical field catalog).

---

## Goal

Surface the `deal-marketing` fields (per the Phase 2 catalog) on the deal's **existing** Marketing tab
group, each with a **public/private** flag ("marked to go public"). The set of "public" items is what
Phase 4's approve-and-publish gate flips live.

## Design

- The listing detail already has a **Marketing** tab group (`src/components/properties/
  PropertyDetailSidebar.tsx`). Add/extend a Marketing **editor** surface here that renders the catalog's
  `deal-marketing` fields grouped as in the audit:
  - **Setup / status** — Lease/Sale side, marketing channel + visibility tier, listing dates.
  - **Sale-side marketing + terms** — title, description, bullets, property use, investment type,
    sale terms, reimbursement, 1031, etc.
  - **Sale-side financials** — price, hide-price, income/expense breakdowns, NOI, cap rate, and named
    **reorderable scenarios** (e.g. Worst/Best case).
  - **Lease-side terms** — deal-level (title/description/bullets/commission split) and per-space.
- Each marketing item carries a **visibility flag** — the audit's None → Fully Public tiers, simplified
  to a public/private toggle for the prototype. Store the flag on the field/section in the deal model
  (per Phase 2).
- Reuse Blueprint `Field`, `Input`, `Textarea`, `Select`, `Switch`; keep the existing tab shell.
- Read/write through the data layer (extend `src/data/actions.ts` with marketing-field updates); no
  backend.

## Verification

Editing marketing fields persists and reflects on the deal; toggling public/private updates the "will
publish" set; existing Marketing tabs (Leads / Documents / Website / etc.) keep working.
