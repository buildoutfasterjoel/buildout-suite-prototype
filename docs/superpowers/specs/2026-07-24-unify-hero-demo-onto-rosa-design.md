# Unify the hero demo onto Rosa Delgado

**Date:** 2026-07-24
**Status:** Draft for review
**Author:** Joel (with Claude)

## Goal

Collapse the two parallel demo personas into **one flagship arc starring Rosa
Delgado**. Today the newer AI features (overnight-signal greeting → live call →
hang-up recap → self-arriving owner email → underwriting → BOV → replay) run in
the assistant sidebar against a *separate* seeded owner, **Marcus Pinckney /
Palmetto Court**. Rosa has her own older, story-rich arc on the contact page
(loan-docs voicemail → financials email with two files → Start-a-Deal → BOV →
signed listing agreement → Activate Listing) — which is currently **broken**
(its call-back trigger was orphaned when the contact page was rewired to the
global `callFlow`).

We will give **everything to Rosa** and **fully remove Marcus**. The unified arc
runs the new sidebar-driven mechanics but is driven by Rosa's story, her hero
property (**The Delgado Building**), and her three signature beats, and it runs
all the way to a **full close** (signed listing agreement → Activate Listing).
The design must leave clean seams so additional story beats can be appended
later.

## Background: the mechanics we're keeping (Marcus spine)

Evidence anchors (current tree):

- **Signal + greeting:** `src/data/signal.ts` `getOvernightSignalContact()`
  keys on `heroKey === "marcus" && c.signal`; `src/ai/voice/greeting.ts:39`
  consumes it; `src/ai/voice/useGreeting.ts` fires once per session and arms a
  `HeroOffer`.
- **Offer branch:** `src/ai/heroOffer.ts` (`useHeroOffer`, `matchOfferIntent`);
  consumed in `AssistantSidebar.tsx` (~532–570): `"call"` → `callFlow.open`,
  `"brief"` → `generateCallBrief` → `CallBriefCard`.
- **Live call:** `src/components/call/callFlow.ts`, `useCallStore.ts`, owner-turn
  generation + TTS.
- **Recap + auto-actions:** `src/components/call/heroRecapExtensions.ts` —
  `isHeroCall` keys on `contact.signal`; `applyHeroRecapExtensions` creates the
  deal, **commits proposal→active**, and schedules a **Thursday tour**;
  `callFlow.endCall` calls it.
- **Self-arriving owner email:** `src/components/call/heroInbound.ts`
  (`HeroInboundWatcher.tsx`) files a Rent Roll + T‑12 onto the deal ~10s later,
  drafts a reply, sets `useInboundEmail` with `canUnderwrite`.
- **Underwrite → BOV:** `startUnderwriting` → `useBovDraft` (`BovWatcher.tsx`,
  `buildBovDraft`) → `BovCard` (occupancy-mismatch flag + value range).
- **Arc complete + replay:** `src/components/call/heroDemo.ts`
  (`markArcComplete`, `arcCompleteText`, `resetHeroDemo`) → `HeroDemoCard`.
- **Hero property coercion:** `src/data/seed.ts` (~1825–1853) forces the signal
  owner's building to a multifamily **Palmetto Court** with a stated-vs-actual
  occupancy gap (stated 94% vs T‑12 78% / 0.22 vacancy) — the gap the
  underwriting/BOV flags.

## Background: Rosa's content we're bringing in

- **Fixture:** `src/data/seed.ts` (~1636–1662) — `heroKey:'rosa'`,
  `relationship:'nurturing'`, `deal:null`, owned multifamily **The Delgado
  Building** (`applyHeroes` ~1866–1887, currently `status:'inactive'`).
- **Beat 1 — loan-docs voicemail:** `src/components/contacts/timelineHeroes.ts`
  `rosa()` (~52–65) — an armed missed inbound call: *"…found the loan documents —
  the ones with the balloon date we talked about…"*.
- **Beat 2 — two-file financials email:**
  `src/components/contacts/ContactEngagementPanel.tsx` `ROSA_FINANCIAL_DOCS`
  (T‑12 + rent roll, "Miguel's files") + email copy (~136–154).
- **Beat 3 — signed listing agreement:** `ROSA_SIGNED_AGREEMENT` + email copy
  (~180–228), followed by an **Activate Listing** action gating proposal→active.
- **BOV cover copy:** `src/components/contacts/ContactBovFlow.tsx`
  `draftBovEmail` (~47–61, Rosa branch).
- **Call-summary copy:** `src/components/contacts/LogCallModal.tsx` (~21–45) —
  **dead code today** (never rendered).

## The unified arc (target beat sequence)

All beats are orchestrated centrally (call stores + watchers mounted in the
shell/sidebar) and write to the datastore, so artifacts surface on Rosa's
contact page, the deal, and the inbox.

1. **Greeting — loan-docs voicemail signal.** On first assistant open, the
   greeting names Rosa's overnight voicemail about the loan documents / balloon
   date on The Delgado Building, and offers: *"Want me to call her back first?"*
2. **Offer branch.** "Yes" → live call to Rosa; "Brief me first" → `CallBriefCard`
   for Rosa; other → clear offer, fall through to the agent.
3. **Live call (as Rosa).** The owner turns speak in Rosa's voice/persona
   (cautious, grieving widow testing trust). Persona hinting is best-effort
   (see Open questions); the mechanics are unchanged.
4. **Hang-up recap.** Creates the opportunity on **The Delgado Building** at
   **`proposal`** (NOT active — activation is the closing beat), and schedules a
   Rosa-appropriate follow-up task (e.g. *"Prep the BOV for The Delgado
   Building"*), narrated by Otto. Undo reverses both writes.
5. **Two-file financials email arrives (Beat 2).** ~10s after the recap, an
   inbound email *from Rosa* arrives with **two** attachments (Miguel's T‑12 +
   rent roll), files them onto the deal, drafts a reply, and exposes
   **"Underwrite this deal"** (eligibility gate satisfied by the multifamily
   building). Uses Rosa's copy.
6. **Underwrite.** Runs the value-add underwriting on The Delgado Building
   (occupancy gap), then arms the BOV.
7. **BOV draft → send.** `BovCard` shows the value range + occupancy-mismatch
   flag with Rosa's BOV cover copy; "Send BOV" files `The Delgado Building —
   BOV.pdf` and logs the activity.
8. **Signed listing agreement arrives (Beat 3).** After the BOV is sent, Rosa
   returns the **signed listing agreement** (files onto the deal, completes the
   "listing agreement" task), surfaced as an inbound item with an **"Activate
   Listing"** action.
9. **Activate Listing → full close.** "Activate Listing" runs the standard
   stage gate `proposal → active`; on success the arc marks complete and Otto
   narrates the close.
10. **Replay.** "Run it again" full-reseeds and re-fires the greeting.

## Architecture & changes

Additive and mirroring the existing arc. Grouped by subsystem.

### A. Seed / data — make Rosa the hero, delete Marcus

- **`src/data/types.ts`:** remove `'marcus'` from `HeroKey`
  (`'rosa' | 'earl' | 'victor' | 'margaret' | 'patricia'`).
- **`src/data/seed.ts`:**
  - Delete the Marcus fixture (~1736–1761) and the Palmetto Court naming in the
    signal-owner coercion.
  - Add a `signal` (`kind:'loan-maturity'`, framed as Miguel's balloon note on
    The Delgado Building, `observedAt` = overnight) to the **Rosa** fixture.
  - Move the hero-property coercion to Rosa's owned building: keep The Delgado
    Building multifamily, bake in the **stated-vs-actual occupancy gap** (stated
    ~94% vs T‑12 ~78% / 0.22 vacancy) so underwriting/BOV have something to flag.
    Rosa keeps `deal:null` (the arc creates the deal).
  - Bump `SEED_VERSION` (`src/data/persistence.ts`) to force a reseed.
- **`src/data/signal.ts`:** `getOvernightSignalContact()` keys on
  `heroKey === "rosa" && c.signal`. Delete the stale duplicate
  **`src/data/signal 2.ts`**.
- **Reset:** keep `resetHeroDemo()` (full reseed) as the primary reset. Update
  `resetRosaDemoState` (`dataStore.ts` hydrate/hard-refresh reset) so it
  **preserves Rosa's new `signal`** and the hero-property occupancy gap; confirm
  it no longer references any Marcus-only state.

### B. Recap — create at proposal, Rosa task copy

- **`src/components/call/heroRecapExtensions.ts`:**
  - `applyHeroRecapExtensions` creates the deal at **`proposal`** and **removes
    the automatic `commitStageTransition` to `active`** (activation moves to the
    closing beat). `HeroActions.movedToStage` and `heroNarration` update
    accordingly (narrate "opened the opportunity" + the follow-up task, not a
    pipeline move).
  - Replace the "Thursday tour" task with a Rosa-appropriate BOV/follow-up task
    (`type` and copy TBD in plan; keep it a real `createTask`).
  - `undoHeroActions` still reverses the writes (delete task; deal → `inactive`).
  - `isHeroCall` is unchanged (keys on `contact.signal`; only Rosa has one).

### C. Closing beats — signed agreement + Activate Listing in the arc

The signed-agreement + Activate-Listing beats currently live as **contact-page
effects** in `ContactEngagementPanel.tsx`, triggered by page-local session
state. In the unified sidebar-driven arc they must be orchestrated centrally.

- Add a watcher (mirroring `HeroInboundWatcher`/`BovWatcher`) that, **after the
  BOV is sent**, arms the signed-agreement arrival: files
  `Delgado Listing Agreement — Signed.pdf` onto the deal, completes the listing
  task, and surfaces an inbound item exposing **"Activate Listing."**
- "Activate Listing" calls the standard `requestStageChange(dealId, "active")`
  gate; the arc marks complete **only after** the deal actually leaves
  `proposal` (guard against a cancelled gate).
- Reuse existing generators/actions/copy where possible (`ROSA_SIGNED_AGREEMENT`
  content, the file/task actions). Prefer moving the shared constants to a small
  module both the arc and any remaining contact-page rendering can import,
  rather than duplicating.

### D. Contact-page arc — retire the orphaned trigger path

- The `ContactEngagementPanel.tsx` Rosa effects that depended on the old
  session-log call trigger (financials email on `logged[0].kind==="call"`) are
  superseded by the arc orchestration. Retire/rewire them so there is **one**
  source of truth for each beat (no double-fire). Keep the contact page's
  rendering of the resulting deal/emails/timeline.
- Delete dead code: **`src/components/contacts/LogCallModal.tsx`** (unused).
  Fold any still-wanted copy (e.g. the call summary) into the arc if needed.

### E. Copy / persona

- Greeting, recap narration, arriving-email bodies, BOV cover, and arc-complete
  text use Rosa's voice and The Delgado Building. Reuse existing Rosa strings;
  new strings written in her register.

### F. Tests

- Rename/repoint `src/data/seed.marcus.test.ts` → Rosa hero seed test (signal +
  multifamily hero property + occupancy gap); update Palmetto-specific tests to
  The Delgado Building.
- Update `timelineArcs.test.ts` hero expectations if hero-key set changes.
- Update `signal`, `greeting`, `heroRecap` tests to Rosa; assert the recap
  creates at **proposal** (not active) and schedules the follow-up task.
- Add a test for the closing beats: after BOV sent → signed agreement filed +
  task completed → Activate Listing gates proposal→active → arc complete.
- Gates: `bunx tsc --noEmit` clean; `bun --bun run test` green.

## Non-goals

- No new visual redesign of the contact page, sidebar, or cards.
- No change to the non-hero personas (Earl/Victor/Margaret/Patricia).
- Future additional story beats are **out of scope** here, but the closing-beat
  watcher and constants module should be structured so appending a beat is a
  localized addition.

## Open questions (resolve during planning)

1. **Live-call persona fidelity:** is generic owner-turn generation acceptable
   for Rosa, or do we invest in a Rosa persona hint fed to `generateCallTurn`?
   (Recommendation: light persona hint, best-effort; not a blocker.)
2. **Recap follow-up task:** exact `type`/copy for the Rosa task replacing the
   Thursday tour (e.g. a "prep/send BOV" task vs a walkthrough).
3. **Contact-page vs sidebar ownership of closing beats:** confirm the
   signed-agreement/Activate-Listing beats should be arc-owned (central watcher)
   with the contact page purely rendering results — this spec assumes yes.
