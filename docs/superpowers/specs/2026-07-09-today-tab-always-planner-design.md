# Today tab: always the planner

## Problem

The listing detail page's first tab (nav-labeled "Today", routed at `/listings/$listingId/overview`) currently shows one of two unrelated UIs depending on `listing.status`:

- **`proposal`** stage → `ProposalOverview` — an action-oriented milestone timeline + progress bar ("Planner").
- **Every other stage** (`active`, `under-contract`, `closed`, `inactive`) → a KPI-dashboard view inside `ListingOverviewDashboard` (KPI tiles, "Overdue Tasks" card, "Active Campaigns" card).

This makes "Today" mean two different things depending on stage, and only proposals get the action-oriented treatment. The goal is to make "Today" **always** be the planner — an action-oriented view of what needs to happen next — with its *content* (milestones, tasks) changing based on the deal's current stage, rather than its *shape*.

## Non-goals

- No route/URL changes — the tab stays at the `overview` route, labeled "Today" in the sidebar (`PropertyDetailSidebar.tsx`).
- No changes to the separate **Tasks** tab or its `DealPlanner` component (grouped Past/Future task table) — that stays as-is.
- No changes to `DealContextRail` or other tabs.
- Dropped entirely, not relocated: the KPI tiles, "Active Campaigns" card. Per stakeholder decision, this content is not preserved elsewhere.

## Architecture

### Component changes

- **`src/components/deals/ProposalOverview.tsx` → renamed and generalized to `src/components/deals/TodayPlanner.tsx`.**
  - Exported component becomes `TodayPlanner({ listing }: { listing: Listing })`.
  - The inner milestone-timeline logic (currently the private `Planner` function, lines 197–242) becomes stage-aware: instead of always computing "Listing executed" / "Listing expires" from `createdAt` / `createdAt + 180d`, it looks up a per-stage config (see below) to get its start milestone, end milestone (if any), and which tasks to render.
  - Header title stays "Planner" (already generic, not proposal-specific).
  - `Activity` section (log call/email/note) is unchanged and still renders for every stage.
  - For `inactive`, the header's "Add task" / "Add critical date" actions are replaced with a single "Relist" action (see Stage content below).

- **`src/components/listings/ListingOverviewDashboard.tsx` → deleted.**
  - Its KPI-tile/"Overdue Tasks"/"Active Campaigns" content is not preserved — confirmed as a full replacement, not a merge.
  - The `OverdueTaskRow` and `CampaignRow` helper components go with it (not used elsewhere — verify no other imports before deleting).

- **`src/routes/listings/$listingId/overview.tsx`** now renders `<TodayPlanner listing={listing} />` directly instead of `<ListingOverviewDashboard listing={listing} />`. No branching left at this layer or any layer — `TodayPlanner` is the only thing this route renders, for every stage.

### Naming

`TodayPlanner` (Today tab, milestone timeline) and `DealPlanner` (Tasks tab, Past/Future table) are intentionally distinct components with distinct names, despite both being "planners" in the colloquial sense — they serve different jobs (curated stage narrative vs. exhaustive task management) and merging them would blur both. No further renaming needed.

## Stage content model

### Deriving the start milestone date

Every stage-change is already recorded in `listing.history` (`DealHistoryEntry[]`, `types.ts:262-269`) — seed data currently writes one entry per listing: `"Stage updated from" (proposal → currentStatus)` with a timestamp (`seed.ts:880-888`), except `proposal` listings which only have the initial `"Created under" (null → proposal)` entry.

`TodayPlanner` derives its start-milestone date as: the timestamp of the most recent `history` entry where `toStage === listing.status`, falling back to `listing.createdAt` if none exists (covers `proposal`, and is a safe fallback generally).

### Per-stage config

A small config map (new file or a const at the top of `TodayPlanner.tsx`) drives the timeline per stage:

| Stage | Start milestone | Task pool (curated, realistic) | End milestone |
|---|---|---|---|
| `proposal` | "Listing executed" | Underwriting, listing proposal, BOV (auto-complete) → upload executed agreement, order photography, order signage, publish to website *(unchanged from today's `seedProposalPlan`)* | "Listing expires" — start + 180d |
| `active` | "Listing went live" | Schedule property tours, send marketing package, review incoming offers/LOIs, confirm due diligence dates | "Listing agreement renews" — start + 180d |
| `under-contract` | "Contract executed" | Schedule inspection, confirm financing/appraisal, order title & escrow, review closing disclosures | "Target closing" — start + 45d |
| `closed` | "Contract executed" | Same closing-checklist tasks as under-contract, but seeded as mostly/all `complete` | "Closed" — uses the listing's actual `voucher.closeDate` (already populated for closed listings; no new date math) |
| `inactive` | "Listing withdrawn" | Archive listing documents, follow up with owner | *(none — timeline ends open, no forward milestone)* |

Progress bar and task-toggling behavior (currently `useState` inside `Planner`) is unchanged — it operates on whatever `listing.tasks` are seeded for that listing, regardless of stage.

### Inactive stage's "Relist" action

For `inactive` listings, `TodayPlanner`'s header actions (`Add task` / `Add critical date`) are replaced with a single `Relist` button. This is prototype-scope UI only — clicking it does not need to perform a real stage transition (no backend), just needs to exist as an affordance. (If the user wants it functional, that's a follow-up.)

## Mock data changes

`src/data/seed.ts`'s `generateTasks(stage)` (lines 764-798) currently produces the same generic 2-3 tasks regardless of stage. It will be extended to branch on `stage` and return the task pool described in the table above, seeded with realistic relative dates and a realistic mix of `open`/`complete`/`overdue` statuses (mirroring the existing pattern of `auto()`/`todo()` helpers in `createListing.ts`'s `seedProposalPlan`, generalized to cover all five stages).

No new fields are added to `Listing`/`DealTask`/`DealHistoryEntry` — the design deliberately reuses `history` timestamps and `voucher.closeDate` rather than introducing new schema, since a design goal is to slot into existing data.

## Testing / verification

This is a prototype UI change with no automated test coverage expected beyond typechecking. Verification is manual:

- Run `bun --bun run dev` and visit listings in each of the 5 stages (proposal, active, under-contract, closed, inactive) — confirm the Today tab renders the milestone timeline (not the old KPI dashboard) in every case, with stage-appropriate milestone labels/dates and tasks.
- Confirm the Tasks tab (`DealPlanner`) is visually/functionally unchanged.
- Confirm no dangling imports/references to the deleted `ListingOverviewDashboard.tsx`.
- Check dev-server/TypeScript output for warnings after the change (per standing project convention).
