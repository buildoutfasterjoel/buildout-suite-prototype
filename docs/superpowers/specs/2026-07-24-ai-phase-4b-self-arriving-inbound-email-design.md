# AI Phase 4B — Self-Arriving Inbound Owner Email

**Status:** Approved design, ready for implementation plan
**Date:** 2026-07-24
**Program:** AI & Voice — see [`AI-VOICE-PRD.md`](./AI-VOICE-PRD.md) §4.1 step 5 and [`AI-VOICE-REQUIREMENTS.md`](./AI-VOICE-REQUIREMENTS.md) §3.6 (`draft-reply`)
**Builds on:** `2026-07-24-ai-phase-4a-signal-greeting-recap-extensions-design.md` (the hero recap that creates the deal + sets `useCallStore.heroActions`)
**Branch:** `joel/ai-tools` (leave as-is; the user handles PRs/merges)

> The in-product assistant is **Otto** (Phase 4A renamed it from the PRD's "Al").

---

## 1. Context — where 4B sits

Phase 4 (hero-arc orchestration) is decomposed into 4A–4D. **4A is built:** the overnight
signal → greeting → "yes" → live call → hang-up recap that auto-opens a `proposal` deal on
Marcus Pinckney's **multifamily** "Palmetto Court", moves it to `active`, schedules the
Thursday tour, and narrates it. On hang-up the recap sets `useCallStore.heroActions =
{ dealId, dealName, movedToStage:'active', tourTaskId, tourDate, narration }`.

**4B (this spec)** is hero-arc **step 5**: ~10s after that recap, a simulated owner email
from Marcus **self-arrives** with a rent roll + T-12, filed to the 4A deal; Otto surfaces it
and **offers to underwrite**. 4C then does the underwrite + occupancy-mismatch + BOV; 4D
sequences the whole arc with reset/replay.

### Verified ground truth (traced in the codebase)

- **The `Email` model is outbound-campaign-only** (`src/data/emails.ts:4-20`: `status`,
  `campaign`, `subject`, `type`, `list`, `calendarDate` — no sender/recipient/body/direction/
  attachments/deal-link). `/email/$emailId` (`src/routes/_shell/email/$emailId.tsx:78`)
  renders **only** `status === "sent"` campaigns as a performance dashboard; drafts/other →
  "Campaign not found". **There is no inbound-email concept and no email-body rendering
  anywhere.** → 4B does **not** build an inbox/route; it represents the arrival with existing
  seams + a sidebar card.
- **`addDealDocument(listingId, doc: DealDocument): Listing | undefined`** (`src/data/store.ts:194`).
  `DealDocument = { id, name, uploadedAt, size?, aiGenerated? }` (`src/data/types.ts:418`).
  Deal docs split by surface: `aiGenerated === true` → the Documents tab
  (`PropertyDetailDocuments`); `aiGenerated !== true` (real uploads) → the deal-overview
  **`DealContextRail` FilesSection** (`src/components/deals/DealContextRail.tsx:271`). The
  create-flow already seeds an **`aiGenerated:true` "Rent Roll 2026"**, so 4B's owner-sent
  docs use distinct names + `aiGenerated:false`.
- **`addDealMessage(listingId, { author, text }): Listing`** (`src/data/store.ts:201`) appends
  a `DealMessage` shown in the Activities-tab `DealMessagesRail`. (`Listing.activities` has
  **no** append action — do not use it.)
- **`notify({ title, description? })`** (`src/lib/notify.ts`) → toast via `ToastBridge`
  (registered in `AppShell`); callable from anywhere incl. a timer.
- **Proactive sidebar surfaces** already exist: `CallBriefCard` / `CallRecapCard` render in
  the sidebar flow reactively from a store; `useHeroOffer` + `HeroOfferChips` are the
  offer-chip pattern; the recap speaks a one-way summary (no mic re-arm). Reaching
  `setMessages` from **outside React is not the pattern** — a timer sets a store, the sidebar
  reacts.
- **`callFlow` timer idiom** (`src/components/call/callFlow.ts`): module-singleton with
  `later(fn, ms)` (`:48`), `clearAll()`, and a monotonic `session` guard that drops stale
  async work. The right pattern for a self-arriving timer.
- **Hero linkage:** `useCallStore.getState().heroActions.dealId` (the deal),
  `useCallStore.getState().target.contactId` → `getContact(id)` (the owner Marcus + his
  `propertyIds[0]` property). The deal is created `propertyType:"multifamily"` (4A), so
  `propertyQualifiesForUnderwriting` (`src/components/deals/underwriting/eligibility.ts:9`)
  is true.
- **Underwriting entry seam (for the accept path):** `updateListingUnderwriting(listingId,
  patch)` (`src/data/store.ts:161`) + `underwritingFromSelection` /
  `defaultSelectionFor` (`src/components/deals/underwriting/strategies.ts`). The hero deal is
  at stage `active`; `showsUnderwritingRow` needs `listing.underwriting != null` once past
  `proposal` — so setting `underwriting` both starts generation and keeps the row visible.

---

## 2. Decisions locked in brainstorming

1. **No new inbox/route.** The arrival = a toast + rent roll & T-12 filed as `DealDocument`s +
   a deal-timeline message + a **sidebar `InboundEmailCard`** showing the generated body; then
   Otto's underwrite offer.
2. **The email replies to the call, not a prior email.** 4B synthesizes a short `original`
   (broker follow-up asking for the rent roll + T-12) from the call/contact so the §3.6
   `draft-reply` contract holds and the reply reads naturally.
3. **The underwrite offer is made AND accepting kicks off the existing underwriting flow**,
   **gated on `propertyQualifiesForUnderwriting`** (multifamily). The hero story always uses a
   multifamily property (4A guarantees it); the gate is belt-and-suspenders. 4C enriches the
   underwrite output (reads the docs, flags the occupancy mismatch, drafts the BOV).
4. **Otto speaks a one-line arrival summary/offer; the card shows the full body** (bodies can
   be long). One-way, no mic re-arm — same discipline as the recap.
5. **Occupancy-mismatch DATA is deferred to 4C.** 4B files named documents only (theater).
6. **Self-arrival is a clean seam (`heroInbound.arm/cancel`)** armed by a mounted observer off
   `useCallStore.heroActions`; **4D** orchestrates reset/replay through it.

### Non-goals (later sub-phases)

- The underwrite computation, the occupancy-mismatch flag, and the BOV (4C). The scripted
  director / reset-replay / the arc's overall timing coordination (4D). A real inbound-email
  model, inbox, or email-detail route.

---

## 3. Architecture

Additive, mirroring Phases 1–4A.

```
src/ai/generate/
  schemas.ts     + DraftReplySpec                          (Zod; default-import z)
  prompts.ts     + DRAFT_REPLY_PROMPT
  fallbacks.ts   + draftReplyFallback
  generators.ts  + generateDraftReply                      (createServerFn + runGenerator)
  index.ts       + re-exports
  schemaCompat.test.ts  + DraftReplySpec in LLM_SCHEMAS

src/components/call/            (hero-arc code lives here, alongside 4A's heroRecapExtensions)
  heroInbound.ts    # module-singleton: arm(dealId, ownerContactId) / cancel();
                    #   ~10s later() → onArrive(); monotonic session guard; synthesizes the
                    #   `original`; calls generateDraftReply; files docs; adds the message;
                    #   toasts; sets useInboundEmail; arms the underwrite offer (if eligible).
  useInboundEmail.ts# Zustand: inbound: InboundEmail | null; setInbound/clearInbound.
                    #   InboundEmail = { dealId, from, subject, body, tone, attachments: string[],
                    #                    canUnderwrite: boolean }
  InboundEmailCard.tsx # sidebar card: from/subject/body + attachment chips + Underwrite/Not-now
  *.test.ts

src/components/layout/AppShell.tsx   # mount <HeroInboundWatcher/> (observes heroActions → arm)
src/components/ai/AssistantSidebar.tsx  # render <InboundEmailCard/> reactively; speak the
                                        #   one-line summary once (one-way); accept → underwrite
```

**Seam split (as in 4A):** reactive state in a store (`useInboundEmail`); effectful/timer
logic in a module singleton (`heroInbound`); presentational card + a thin mounted observer.

### 3.1 `useInboundEmail` (reactive state only)

```ts
interface InboundEmail {
  dealId: string;
  from: string;            // "Marcus Pinckney"
  subject: string;
  body: string;            // the generated draft-reply
  tone: "interested" | "open" | "decline";
  attachments: string[];   // display names of the filed docs
  canUnderwrite: boolean;  // propertyQualifiesForUnderwriting(property)
}
```

---

## 4. The `draft-reply` generator (§3.6)

```ts
// schemas.ts
export const DraftReplySpec = z.object({
  tone: z.enum(["interested", "open", "decline"]),
  body: z.string(),   // 2-4 sentences, ends with the owner's first-name signoff
});
```

- `generateDraftReply` — `createServerFn` + `runGenerator({ system: DRAFT_REPLY_PROMPT, user:
  JSON.stringify({ original, candidate, property }), schema: DraftReplySpec, fallback:
  () => draftReplyFallback(...) })`, default (fast) model. Registered in `schemaCompat.test.ts`.
- **Prompt intent (§3.6):** write as the owner would mid-day — busy, terse, sometimes
  warm/guarded; let the `note` shape tone; reference one specific thing from the broker's
  message; end with the owner's first-name signoff. For the hero, the synthesized `original`
  asks for the rent roll + T-12, so the reply references sending them. (The §3.6 "balanced
  odds across tones" holds for the general capability; the hero path biases interested.)
- **Fallback** (`draftReplyFallback`): `{ tone: "interested", body: "<deterministic reply
  that references the call + the attached rent roll and T-12, signed with the first name>" }`.
- **Synthesized `original`** (pure helper in `heroInbound.ts`): `{ subject: "Following up on
  our call", body: "Great speaking just now, {firstName} — when you get a moment, could you
  send the current rent roll and the T-12? I'll take a look and come back with a valuation." }`.

## 5. Self-arrival (§2 of the design)

- `heroInbound.ts` (module singleton):
  - `arm(dealId: string, ownerContactId: string)` — bumps `session`, schedules
    `later(onArrive, ~10_000)`. Idempotent per (dealId): the watcher arms once per
    `heroActions` instance.
  - `cancel()` — bumps `session`, clears the timer (a reset / new call drops a pending
    arrival). 4D calls this on replay/reset.
  - `onArrive()` (async, session-guarded): resolve `contact = getContact(ownerContactId)` and
    its property; build the synthesized `original`; `generateDraftReply(...)`; then perform
    §6. If `session` moved on before/after the await, drop silently (mirrors `callFlow`).
- `HeroInboundWatcher` (mounted in `AppShell`, gated on `hydrated`): a `useEffect` that
  observes `useCallStore((s) => s.heroActions)`; when it becomes non-null (and wasn't before),
  calls `heroInbound.arm(heroActions.dealId, useCallStore.getState().target!.contactId)`.
  Tracks the last-armed dealId to avoid re-arming on unrelated re-renders.

## 6. On arrival — file, surface, offer

Given the generated reply + resolved deal/owner/property, `onArrive` deterministically:

1. **File attachments:** `addDealDocument(dealId, { id, name: "Palmetto Court — Rent Roll.xlsx",
   uploadedAt: now, size: "2.1 MB", aiGenerated: false })` and the same for
   "Palmetto Court — T-12.pdf" (~"1.4 MB"). `aiGenerated:false` → deal-overview FilesSection.
2. **Timeline:** `addDealMessage(dealId, { author: "Marcus Pinckney", text: "Sent the rent
   roll and T-12 — filed to the deal." })`.
3. **Toast:** `notify({ title: "New email from Marcus Pinckney", description: "Rent roll +
   T-12 attached" })`.
4. **Surface:** `useInboundEmail.setInbound({ dealId, from, subject, body, tone, attachments,
   canUnderwrite: propertyQualifiesForUnderwriting(property) })` and open the sidebar
   (`useAssistant.getState().setOpen(true)`).
5. **Otto speaks** a one-line summary/offer (deterministic string, spoken only if
   `voiceEnabled`; one-way, **no** `setConversationMode`/mic re-arm — same rule as the recap).

### 6.1 `InboundEmailCard` (sidebar)

Reads `useInboundEmail`. Renders an "email" card: **from / subject**, the **body** (light
text), the two **attachment chips** (filed to the deal), and — when `canUnderwrite` — an
**"Underwrite this deal"** primary button + a **"Not now"** ghost button. Blueprint `Button`,
FontAwesome `pro-regular` (`faEnvelope`, `faPaperclip`), no `fixedWidth`.

- **Underwrite** → navigate to the deal overview
  (`/listings/$listingId` params `{ listingId: dealId }`) and start the existing underwriting
  generation: `updateListingUnderwriting(dealId, { ...underwritingFromSelection(strategy,
  defaultSelectionFor(...)), status: "generating" })` (keeps the row visible at Active).
  Then `clearInbound()`. **4C** enriches the resulting underwrite (docs → occupancy mismatch →
  BOV).
- **Not now** → `clearInbound()`. The filed documents + timeline message remain on the deal.

## 7. Degradation matrix

| Situation | Behavior |
|---|---|
| No `ANTHROPIC_API_KEY` | `generateDraftReply` → `draftReplyFallback` (a plausible interested reply). Arrival/file/message/toast/offer all deterministic — the whole beat runs. |
| No `ELEVENLABS_API_KEY` | Otto's one-line summary speaks via browser `SpeechSynthesis` (Phase-2 seam). |
| Voice off | Toast + card + offer render silently; nothing spoken. |
| Property not underwriting-eligible | `canUnderwrite: false` → the card shows the email + attachments but **no** underwrite offer (Otto notes the docs are filed). Never applies to the hero (multifamily), by design. |
| Reset / a new call before ~10s elapses | `heroInbound.cancel()` (via the watcher / 4D) drops the pending arrival — no stale email. |

Nothing hard-fails.

## 8. Testing (Vitest units; no Playwright)

- `DraftReplySpec` + `draftReplyFallback` — fallback satisfies the schema; schemaCompat
  registration (no array bounds / nullable objects).
- The synthesized-`original` builder — references the first name + asks for rent roll + T-12.
- `heroInbound` session guard — `arm` then `cancel` (or a later `arm`) drops the earlier
  pending arrival; `onArrive` after a session bump is a no-op (mock timers + `generateDraftReply`).
- `onArrive` executor — files **two** `aiGenerated:false` docs to `dealId`, adds the deal
  message, sets `useInboundEmail` with `canUnderwrite` reflecting eligibility (true for a
  multifamily property, false otherwise), and does NOT arm the offer when ineligible.
- `useInboundEmail` set/clear.
- Underwrite-accept executor (pure part) — `updateListingUnderwriting(dealId, { status:
  "generating", ... })` sets `underwriting` on the deal (so the row would show at Active).

`InboundEmailCard`, `HeroInboundWatcher`, the toast, and the spoken summary are verified by
the **manual browser smoke test** (real ANTHROPIC + ELEVENLABS keys).

## 9. Gates (bind this sub-phase)

- `bun --bun run test` green **and** `bun --bun x tsc --noEmit` 0 errors. `vite build` does
  **not** type-check. Ignore biome + the pre-existing `ReferenceError: module is not defined`
  Vitest stderr line.
- `import z from "zod"` (default). Every new generator schema Anthropic-strict compatible AND
  registered in `schemaCompat.test.ts`.
- Everything runs key-less via deterministic fallbacks. FontAwesome `pro-regular`, never
  `fixedWidth`; Blueprint + Bootstrap; no unsolicited redesigns of existing components.
- Leave the branch as-is (user handles PRs/merges).

## 10. Acceptance criteria (4B slice)

- [ ] `generateDraftReply` (§3.6) exists with a keyless fallback and is registered in
      `schemaCompat.test.ts`.
- [ ] ~10s after the hero recap sets `heroActions`, an owner email self-arrives: a toast
      fires, the rent roll + T-12 are filed to the hero deal (visible in the deal-overview
      FilesSection), and a deal-timeline message is added.
- [ ] The sidebar opens with an `InboundEmailCard` showing the generated body + attachment
      chips; Otto speaks a one-line summary once (no mic re-arm).
- [ ] Otto offers to underwrite **only when the property is multifamily-eligible**; accepting
      navigates to the deal and kicks off the existing underwriting generation; "Not now"
      dismisses and leaves the docs filed.
- [ ] A reset / new call before ~10s cancels the pending arrival.
- [ ] Everything runs key-less. `bun --bun run test` green; `bun --bun x tsc --noEmit` 0 errors.

## 11. Downstream

- **4C — underwrite + BOV:** consumes the filed rent roll + T-12 (and the deal now mid-
  underwrite from 4B's accept), derives/seeds the occupancy mismatch, drafts the BOV, sends →
  activity timeline.
- **4D — the director:** sequences 4A→4B→4C with deterministic timing + reset/replay, driving
  `heroInbound.arm/cancel` and the 4A seams.
