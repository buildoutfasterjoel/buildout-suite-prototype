# Rosa Arc — Move Email Beats to the Contact Timeline + Gate the Deal

> Follow-up rework of the unified Rosa hero arc. Restores the old rich contact-record behavior: the two arc emails (financials, signed agreement) appear as **actionable rows in Rosa's contact record**, and the **deal is created by "Start a Deal" on the financials email** — not at hang-up. The call, recap, and AI underwrite/BOV stay in the sidebar. The two sidebar email cards are removed.

**Goal:** Fix two regressions from the unification: (1) arc emails no longer show in the contact record; (2) the deal is built at hang-up instead of after the user opens/acts on the rent-roll+T-12 email.

**Global constraints:**
- Bun: `bun --bun run test`; typecheck `bunx tsc --noEmit` (clean). Benign Vitest stderr "module is not defined" is not a failure.
- FontAwesome pro-regular, never fixedWidth. Copy in Rosa's register (late husband Miguel; The Delgado Building). Blueprint React + Bootstrap; match existing styling.
- Commit after each task. No push/merge/PR; leave branch as-is. Stay in the project dir.

## Target flow
1. Sidebar: greeting → call → recap = call summary only (NO deal, no "opened opportunity" bullets).
2. After hang-up, the **financials email** (T-12 + rent roll) arrives as an **actionable row in Rosa's contact record** ("Start a Deal").
3. "Start a Deal" → AI progress modal → creates the deal at `proposal` with both docs attached → kicks the sidebar underwrite → BOV.
4. Send BOV (sidebar) → the **signed listing agreement** arrives as an actionable row in the contact record ("Activate Listing").
5. "Activate Listing" → deal → `active` → arc completes ("run it again").

## Reference: the old handlers (from `git show ed363c5^:src/components/contacts/ContactEngagementPanel.tsx`)
Constants:
```ts
const ROSA_FINANCIAL_DOCS = [
  { name: "The Delgado Building — T12.pdf", meta: "PDF · 268 KB", size: "268 KB" },
  { name: "Delgado Rent Roll — July 2026.xlsx", meta: "XLSX · 96 KB", size: "96 KB" },
];
const ROSA_SIGNED_AGREEMENT = { name: "Delgado Listing Agreement — Signed.pdf", meta: "PDF · 1.1 MB", size: "1.1 MB" };
const ROSA_FINANCIALS_EMAIL_ID = "sim-rosa-financials-email";
const ROSA_AGREEMENT_EMAIL_ID = "sim-rosa-signed-agreement-email";
```
`completeAiDeal` creates the deal from `ownedProperty` with `initialStage:"proposal"`, `sellerContactId: contact.id`, `dealSide:"seller"`, and `documents: ROSA_FINANCIAL_DOCS.map(...)`. Full source is in that git object — reuse it.
`handleAction` branches: `"Start a Deal"` → open the AI progress modal (`setAiDealFromEventId(event.id)`); `"Activate Listing"` → `requestStageChange(deal.id, "active")`. The `<AiDealProgressModal open={aiDealFromEventId!=null} documents={ROSA_FINANCIAL_DOCS.map(d=>d.name)} onComplete={completeAiDeal} />` render.

## `addSimEvent` event shape (a `TimelineEvent`, posted to the contact timeline)
```ts
useContactSession.getState().addSimEvent(contactId, {
  id: ROSA_FINANCIALS_EMAIL_ID,          // dedupes by id
  type: "inbound-email",
  actor: { name: contactFullName(contact) },
  direction: "in",
  timestamp: new Date().toISOString(),
  seq: 2_000_000,
  subject: "Miguel's files — the T-12 and rent roll",
  body: "<Rosa copy>",
  hasAttachment: true,
  attachments: ROSA_FINANCIAL_DOCS.map(({ name, meta }) => ({ name, meta })),
  actionBar: { primary: "Start a Deal", ghosts: ["Reply"] },
  source: "user",
});
```

---

## Task R1: Defer the deal + move the email beats to the contact timeline

**Files:**
- `src/components/call/callFlow.ts` — `endCall`: stop creating the deal / `setHeroActions`; for a hero call, arm the financials email off the CONTACT: `if (isHeroCall(target)) heroInbound.arm(target.contactId)`.
- `src/components/call/heroRecapExtensions.ts` — keep `isHeroCall`; REMOVE `applyHeroRecapExtensions`, `HeroActions`, `undoHeroActions`, `heroNarration`.
- `src/components/call/useCallStore.ts` — remove `heroActions` state + `setHeroActions`/`clearHeroActions` (+ the `HeroActions` import).
- `src/components/call/CallRecapCard.tsx` — remove the hero-actions section (the "Opened opportunity…/Added a task…" bullets + Undo). The card now shows only the recap summary.
- `src/components/call/callStoreHeroActions.test.ts` — delete (its subject is removed).
- `src/components/call/HeroInboundWatcher.tsx` + its mount in `src/components/layout/AppShell.tsx` — DELETE (arming moved into `endCall`).
- `src/components/call/heroInbound.ts` — `arm(contactId)` (one arg). `onArrive(contactId)`: resolve the contact + owned property; post the financials email as an actionable contact-timeline row (see event shape; use the ROSA_FINANCIAL_DOCS names/metas; Rosa copy); `notify` + chime; DO NOT `addDealDocument`/`addDealMessage` (no deal yet); DO NOT `setInbound`. Keep the exported `startUnderwriting(dealId)` (now called from `completeAiDeal`). Define/share `ROSA_FINANCIAL_DOCS` (export from a small shared module, e.g. `rosaDocs.ts`, imported by both `heroInbound.ts` and `ContactEngagementPanel.tsx`, so the names match end-to-end).
- `src/components/call/rosaClosing.ts` — keep `arm(dealId, ownerContactId)` + the deal doc filing + task completion; ALSO post the signed-agreement email as an actionable contact-timeline row (`id: "sim-rosa-signed-agreement-email"`, `seq: 2_000_001`, attachment = ROSA_SIGNED_AGREEMENT, `actionBar:{ primary:"Activate Listing", ghosts:["Reply"] }`); REMOVE `useClosingEmail.set` (no sidebar card). Share `ROSA_SIGNED_AGREEMENT` via the shared docs module.
- `src/components/contacts/ContactEngagementPanel.tsx` — restore: `ownedProperty` (the contact's owned building), `completeAiDeal` (from ed363c5^; on success ALSO call `startUnderwriting(deal.id)` and navigate to the listing `/listings/$listingId` so the sidebar underwrite/BOV runs), the `handleAction` branches for `"Start a Deal"` and `"Activate Listing"`, the `<AiDealProgressModal>` render, and an arc-complete effect: when the owned property's deal reaches `status === "active"`, call `useHeroDemo.getState().markArcComplete()` and `resolve` the agreement row (mirrors ed363c5^'s deals-watching resolve effect). Import `useHeroDemo` from `#/components/call/heroDemo`, `startUnderwriting` from `#/components/call/heroInbound`.

**Tests:** update `heroRecapExtensions.test.ts` (now only `isHeroCall`), `callFlow` tests, `heroInbound.test.ts` (arm(contactId) → sim-event posted, not deal docs), `rosaClosing.test.ts` (sim-event posted + doc filed). Add a focused test that "Start a Deal" via `completeAiDeal` creates a `proposal` deal with the two docs. `bunx tsc --noEmit` clean; `bun --bun run test` green.

**Commit:** `feat(rosa-arc): email beats on the contact record; deal created by "Start a Deal"`

---

## Task R2: Remove the now-unused sidebar email cards + reset

**Files:**
- Delete: `src/components/call/InboundEmailCard.tsx`, `src/components/call/ClosingEmailCard.tsx`, `src/components/call/useInboundEmail.ts`, `src/components/call/useClosingEmail.ts` (confirm no remaining importers after R1 via `bunx tsc --noEmit`).
- `src/components/ai/AssistantSidebar.tsx` — remove the `<InboundEmailCard />` + `<ClosingEmailCard />` renders and their imports; remove the `useInboundEmail`/`inbound` speak-on-arrival effect and its `inboundSummaryText`/`useInboundEmail` imports.
- `src/components/call/heroInbound.ts` / `rosaClosing.ts` — drop any now-dead `useInboundEmail`/`useClosingEmail` imports (should be gone after R1).
- `src/components/call/heroDemo.ts` — `resetHeroDemo`: remove `useInboundEmail`/`useClosingEmail` clears; ADD clearing Rosa's contact-session sim-events + resolved so a replay re-shows the emails (add a `reset()` to `useContactSession` that clears `simEvents`/`resolved`/`flags`, or clear Rosa's entries; call it in `resetHeroDemo`). This matters because `addSimEvent` dedupes by id — without a clear, the emails won't re-arrive on "run it again".

**Tests:** update `heroDemo.test.ts` if it referenced the removed stores; `bunx tsc --noEmit` clean; `bun --bun run test` green.

**Commit:** `refactor(rosa-arc): remove sidebar email cards; reset contact timeline on replay`
