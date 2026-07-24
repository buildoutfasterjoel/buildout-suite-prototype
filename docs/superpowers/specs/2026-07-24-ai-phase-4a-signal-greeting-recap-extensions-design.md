# AI Phase 4A — Signal, Greeting & Recap Hero-Extensions

**Status:** Approved design, ready for implementation plan
**Date:** 2026-07-24
**Program:** AI & Voice integration — see [`AI-VOICE-PRD.md`](./AI-VOICE-PRD.md) §4.1 (the hero arc) and [`AI-VOICE-REQUIREMENTS.md`](./AI-VOICE-REQUIREMENTS.md) §3.4/§3.7
**Builds on:** `2026-07-24-ai-phase-3-live-call-simulation-design.md` (§13 names Phase 4)
**Branch:** `joel/ai-tools` (leave as-is; the user handles PRs/merges)

> **Naming:** the in-product assistant is named **Otto** in this prototype (the reference
> PRD calls it "Al" — the source-prototype name). A global `Al → Otto` rename of the
> Phase 1–3 code is **task 0** of this sub-phase (see §9). This spec uses "Otto"; the
> historical Phase 1–3 design docs and the PRD keep "Al" as a record.

---

## 1. Context — where Phase 4 sits, and why it's decomposed

Phase 3 shipped the reusable live call with **clean seams** and deliberately stopped
before the scripted hero arc. Phase 4 — the hero-arc orchestration (PRD §4.1) — spans
four genuinely independent subsystems, so it is decomposed into four sub-phases, each
its own spec → plan → subagent-driven build, built in order:

- **4A (this spec)** — signal + greeting + recap **hero-extensions**: the front half of
  the arc (overnight signal → greeting → "yes"/"brief me first" → live call → recap
  opens the opportunity, moves it into the pipeline, schedules the Thursday tour, and
  narrates it).
- **4B** — the self-arriving simulated owner **email** (new `draft-reply` generator,
  REQUIREMENTS §3.6), filed to the deal, offering to underwrite.
- **4C** — **underwrite + BOV**: reuse the deterministic underwriting flow to price the
  deal, flag the occupancy mismatch, draft the BOV, send → activity timeline.
- **4D** — the **director**: the scripted glue that sequences 4A→4B→4C as one continuous
  demo with deterministic timing/narration and a reset/replay control.

4A is independently demoable and leaves behind a live deal + timeline that 4B/4C/4D
pick up.

### Verified ground truth (traced in the codebase)

- **No market-signal concept exists.** `Contact` (`src/data/types.ts:941`) has no
  `signal` field; the property-side `signalIntersection` (`types.ts:224`) is a
  road-frontage attribute (`YesNoNA`), unrelated. Sub-phase A introduces the signal.
- **A hero-persona system already exists** and is the right seam for Marcus.
  `HeroKey = 'rosa'|'earl'|'victor'|'margaret'|'patricia'` (`types.ts:939`),
  `HERO_FIXTURES` + `applyHeroes()` (`src/data/seed.ts:1600+`) overwrite deterministic
  contacts with hand-authored personas and wire each to a listing at its story's
  stage/side; hand-authored timeline arcs live in
  `src/components/contacts/timelineHeroes.ts`. **No "Marcus Pinckney" exists** (only a
  teammate "Marcus Patel").
- **The greeting already supports a signal.** `composeGreeting(ctx, { overnightSignal })`
  (`src/ai/voice/greeting.ts:16`) renders a pinned-signal line + the constant
  `OFFER = "Want me to call your most important move first?"`. But `useGreeting`
  (`src/ai/voice/useGreeting.ts:42`) calls `composeGreeting(buildAssistantContext())`
  with **no signal**. The greeting text is appended to the chat as an assistant message
  (`AssistantSidebar.tsx:427`), and hands-free `onSubmit` routes to `send()` → the agent
  (`AssistantSidebar.tsx:415`).
- **The live call + recap seams are ready to reuse** (Phase 3): `callFlow.open(contact,
  phone?)` (`src/components/call/callFlow.ts:129`), `callFlow.endCall()` (:179) which
  generates the recap, logs via `addNote`, sets `useCallStore.recap`, and opens the
  sidebar; `composeRecapReport(recap, contactName)` (`callRecap.ts:13`);
  `CallRecapCard` (reads `useCallStore`; Keep/Edit/Drop tasks + an Open-opportunity card
  calling `createDeal`). `runOwnerTurn` passes `property: null` today (`callFlow.ts:80`) —
  the hero call passes the signal-bearing property.
- **Deal lifecycle** = `PropertyStatus 'proposal'|'active'|'under-contract'|'closed'|
  'inactive'` (`types.ts:5`). Stage moves that write history go through
  `commitStageTransition` (`src/data/actions.ts:77`). The deterministic underwriting
  flow (`src/components/deals/underwriting/`) is asset-class-gated —
  `propertyQualifiesForUnderwriting` requires **multifamily** (or Self-Storage / IOS)
  (`eligibility.ts:9`) — which constrains the hero property's type so 4C works.
- **Data actions** (`src/data/actions.ts`): `createDeal(NewListingDraft)` (:55),
  `createTask(NewTaskInput)` (:398, `type`/`dueDate`/`contactId`/`dealId` fields),
  `commitStageTransition` (:77), `linkContactToDeal` (:190), `addNote(contactId, text)`
  (:606). No `addDealActivity` — the deal timeline is fed by `commitStageTransition`
  history + `addDealMessage`.
- **Generator pattern** (`src/ai/generate/`): Zod schema (default `import z from "zod"`)
  → prompt → `createServerFn` + `runGenerator({ system, user, schema, fallback, model? })`
  → barrel re-export. `runGenerator` returns the fallback with no key and swallows any
  400 into the fallback, so **every new schema must be Anthropic-strict compatible and
  registered in `schemaCompat.test.ts`** (`LLM_SCHEMAS`). `AI_MODEL = "claude-sonnet-5"`,
  `AI_MODEL_REASONING = "claude-opus-4-8"`.
- **Global overlays** mount once in `AppShell` gated on `hydrated`
  (`src/components/layout/AppShell.tsx`); imperative/timer logic lives in module
  singletons outside React (mirror `callFlow` + `registerStopForCall`).

---

## 2. Decisions locked in brainstorming

1. **Decomposed into 4A–4D**, built in order; 4D (the director) is a thin scripting
   layer built last over working pieces.
2. **Assistant renamed to Otto** — global rename is task 0 of 4A (§9).
3. **Include the call brief + "brief me first" branch** (PRD §4.1 step 2), deferred from
   Phase 3 because it is signal-driven.
4. **"Yes" → call is hybrid** (§5): a deterministic pending-offer fast-path (works
   keyless, every time, by voice or button) with the agent's "act on confirmation" as
   the fall-through.
5. **Hero recap-extensions auto-execute + narrate** (PRD §4.1 step 4): on hang-up of the
   hero call, Otto opens the opportunity, moves it into the pipeline, and schedules the
   Thursday tour automatically, then narrates it. The recap card shows these as **done**
   (with a single **Undo**), not pending buttons. Non-hero calls keep Phase-3 behavior.
6. **Signal lives on `Contact`** (the owner), per the status doc's "signal on an owner"
   framing; a helper maps it to `property.signal` where generators need the string.
7. **"Into the pipeline" = advance the deal `proposal → active`** via
   `commitStageTransition` (a real history entry).
8. **Marcus's hand-authored `timelineHeroes.ts` arc is out of scope for 4A** — his
   timeline is fed live by the arc's real writes. (Revisit in 4D if desired.)

### Non-goals (later sub-phases)

- The self-arriving inbound email (4B); underwrite + BOV + the occupancy-mismatch
  derivation (4C); the scripted director, reset/replay, and the ~10s inbound timer (4D).

---

## 3. Architecture

Additive and self-contained, mirroring the Phase-1/2/3 "one capability, providers
behind a seam" structure.

```
src/data/
  types.ts        + OwnerSignal interface; Contact.signal?; HeroKey += 'marcus'
  seed.ts         + Marcus Pinckney HERO_FIXTURE (owner, deal:null, signal set);
                  #   his property coerced to multifamily (underwriting-eligible)
  signal.ts       + signalText(contact): string  (pure; greeting + generator payloads)
                  + getOvernightSignalContact(): Contact | null  (selector)

src/ai/voice/
  useGreeting.ts  ~ pass overnightSignal: signalText(marcus); set the pending offer

src/ai/heroOffer.ts (new store + intent)
  useHeroOffer    # Zustand: pendingOffer: {kind:'call'|'brief', contactId}|null; set/clear
  matchOfferIntent(text): 'call' | 'brief' | null   (pure, tested)

src/ai/generate/
  schemas.ts      + CallBriefSpec  (all strings — Anthropic-strict safe)
  prompts.ts      + CALL_BRIEF_PROMPT
  generators.ts   + generateCallBrief (createServerFn + runGenerator + callBriefFallback)
  index.ts        + re-exports
  schemaCompat.test.ts  + CallBriefSpec registered in LLM_SCHEMAS

src/components/call/
  heroRecapExtensions.ts  + isHeroCall(target); applyHeroRecapExtensions({target,recap})
                          #   → HeroActions summary + narration; undoHeroActions(actions)
  callFlow.ts     ~ hero call passes the signal property to runOwnerTurn; endCall() runs
                  #   applyHeroRecapExtensions when isHeroCall(target)
  useCallStore.ts + heroActions: HeroActions | null; setHeroActions/clearHeroActions
  CallRecapCard.tsx ~ additive "What Otto did" done-state block + Undo (hero calls only)
  CallBriefCard.tsx (new)  # opener/leadWith/ask/voicemail + a "Call Marcus" button

src/components/ai/AssistantSidebar.tsx
  ~ send(): intercept a pending hero offer before dispatching to the agent
  ~ render Call / Brief-first chips while an offer is pending
```

**Seam split (mirrors Phase 2/3):** reactive state in Zustand stores (`useHeroOffer`,
`useCallStore.heroActions`); imperative/effectful logic in module singletons/pure
functions (`heroRecapExtensions`, `matchOfferIntent`, `signalText`) callable from
non-React paths (`callFlow`, client tools, and the 4D director). Presentational
components stay thin.

---

## 4. Signal model + hero seed (§1 of the design)

```ts
// src/data/types.ts
export interface OwnerSignal {
  kind: 'loan-maturity' | 'hold-expiry' | 'ownership-change' | 'market-pressure'
  headline: string    // short, for the greeting  — e.g. "$4.2M CMBS loan maturing"
  detail: string      // full sentence — for the brief / call-turn / prospect
  observedAt: string  // ISO date; "overnight"
}
export interface Contact { /* … */ signal?: OwnerSignal }
export type HeroKey = 'rosa' | 'earl' | 'victor' | 'margaret' | 'patricia' | 'marcus'
```

- `src/data/signal.ts`:
  - `signalText(contact): string` — renders the string form used by the greeting's
    `overnightSignal` and by generator `property.signal` payloads. Empty string when no
    signal. Pure + tested.
  - `getOvernightSignalContact(): Contact | null` — the `heroKey === 'marcus'` contact
    from the live store (the arc's single overnight signal). Tested.
- **Marcus Pinckney** — a new `HERO_FIXTURES` entry reusing `applyHeroes`: `role:'owner'`,
  `deal: null` (no deal yet — the arc creates it), a cold-ish `relationship`
  (`'nurturing'`), `signal` set (`kind:'loan-maturity'`), `dealName` = an on-story
  Charleston multifamily (e.g. **"Palmetto Court"**). The seed **coerces his linked
  property to multifamily** so `propertyQualifiesForUnderwriting` is true in 4C.
  `applyHeroes` currently claims `contacts[10 + i]` and its listing; the fixture wiring
  ensures Marcus's property type/name land on-story (detail for the plan).

## 5. Greeting + "yes"/"brief me first" routing (§2–§3 of the design)

- **Greeting:** `useGreeting` reads `getOvernightSignalContact()`; if present, passes
  `overnightSignal: signalText(marcus)` to `composeGreeting` (the constant `OFFER`
  stays — unambiguous because the signal line just named Marcus) and, on firing,
  `useHeroOffer.setOffer({ kind:'call', contactId: marcus.id })`.
- **`matchOfferIntent(text)`** (pure): `'call'` for yes-intents (yes / yeah / sure / go
  ahead / do it / call him / let's go / please), `'brief'` for brief-intents (brief me /
  brief first / what's the signal / more first), else `null`. Case/punctuation
  insensitive; word-boundary matched to avoid false hits.
- **`AssistantSidebar.send(text)`** — before `sendMessage`, if a hero offer is pending:
  - `matchOfferIntent → 'call'`: `clearOffer()`, append a short Otto assistant line
    ("Calling Marcus now."), `callFlow.open(marcus, phone)`. **Do not** hit the agent.
  - `→ 'brief'`: `clearOffer()`, run the call brief (§6) and render `CallBriefCard`.
    **Do not** hit the agent.
  - `→ null`: `clearOffer()`, fall through to the normal agent `sendMessage` (the agent's
    own confirm-and-act is the fallback path).
- **Chips:** while an offer is pending, the sidebar renders **Call Marcus** /
  **Brief me first** chips (a small affordance tied to `useHeroOffer`, styled like the
  existing suggestion chips) that call the same two handlers — so the beat works by
  voice, by click, or via the agent, and works keyless.

## 6. The call brief (§4 of the design)

- `CallBriefSpec = z.object({ opener: z.string(), leadWith: z.string(), ask: z.string(),
  voicemail: z.string() })` — all strings → Anthropic-strict safe; registered in
  `schemaCompat.test.ts`.
- `generateCallBrief` — `createServerFn` + `runGenerator({ system: CALL_BRIEF_PROMPT,
  user: JSON.stringify({ candidate, property, signal }), schema: CallBriefSpec,
  fallback: callBriefFallback })`, default (fast) model. Prompt is signal-driven
  (opener + the signal angle to lead with + the ask + a voicemail script).
- **Fallback** (`callBriefFallback`) composes the four fields deterministically from the
  `OwnerSignal` (works keyless).
- `CallBriefCard.tsx` renders the four fields + a **Call Marcus** button →
  `callFlow.open`. Rendered in the sidebar flow (mirrors `CallRecapCard`).

## 7. Recap hero-extensions — auto-execute + narrate (§5 of the design)

- `src/components/call/heroRecapExtensions.ts`:
  - `isHeroCall(target: CallTarget): boolean` — the target is the hero owner / carries a
    signal (resolved from the live contact by `target.contactId`).
  - `applyHeroRecapExtensions({ target, recap }): HeroActions` — deterministic; performs,
    in order:
    1. `createDeal` seeded from the contact + his property + `recap.opportunity` →
       a **`proposal`** deal (seller side);
    2. `commitStageTransition` **`proposal → active`** ("into the pipeline", real history
       entry) + `linkContactToDeal`;
    3. `createTask` — name "Tour {property} with Marcus", `type:'tour'`,
       `dueDate` = **next Thursday computed relative to today** (2026-07-30 from
       2026-07-24), `contactId`, `dealId`;
    returns `HeroActions = { dealId, dealName, movedToStage:'active', tourTaskId,
    tourDate, narration: string }`.
  - `undoHeroActions(actions)` — reverses the three writes (delete the tour task, revert
    the stage, remove/inactivate the deal).
- `useCallStore` gains `heroActions: HeroActions | null` (+ `setHeroActions`/`clear`).
- **`callFlow.endCall`** — after the recap is generated + stored, if `isHeroCall(target)`
  it calls `applyHeroRecapExtensions` and `setHeroActions(...)`. All writes are local,
  deterministic store mutations — they run regardless of API keys.
- **Narration:** the spoken recap (`AssistantSidebar` recap effect via
  `composeRecapReport`/`recapSpeechText`) **appends** the `heroActions.narration`:
  *"I opened a new opportunity on {property}, moved it into your pipeline, and put
  Thursday's tour on your calendar."*
- **`CallRecapCard`** gains an additive **"What Otto did"** done-state block (rendered
  only when `heroActions` present) listing the opportunity / pipeline move / tour, with
  a link to the new deal and a single **Undo** → `undoHeroActions` + `clearHeroActions`.
  **Non-hero calls are unchanged** (Phase-3 Keep/Edit/Drop + Open-opportunity), honoring
  "no unsolicited redesign".

## 8. Degradation matrix

| Situation | Behavior |
|---|---|
| No `ANTHROPIC_API_KEY` | Greeting/signal text, `matchOfferIntent`, and all three hero-extension writes are deterministic → the whole front-arc runs. The call brief + recap use their fallbacks. |
| No `ELEVENLABS_API_KEY` | Greeting / brief-cta / owner lines / recap narration speak via browser `SpeechSynthesis` (Phase-2 seam). |
| Voice off (`voiceEnabled` false) | Greeting + chips + brief + recap render silently; nothing is spoken; the arc still runs by click. |
| Agent unavailable | The pending-offer fast-path still fires the call/brief deterministically (no agent needed for the hero beat). |

Nothing hard-fails — every gap is a normal state, matching Phases 1–3.

## 9. Task 0 — global Al → Otto rename

Before any 4A feature work, a focused rename sweep across **Phase 1–3 code + tests**:
user-facing strings, spoken narration ("Al reports" → "Otto reports"), variable/comment
mentions where they surface as the assistant's name. Its own commit; verified by the
gates (§11). **Historical design docs (Phase 1–3 specs, the PRD) keep "Al"** as a
record; the STATUS tracker and this spec use "Otto". Care points: don't rename unrelated
identifiers that merely contain the letters "al"; the greeting `OFFER` constant and
`greeting.test.ts` copy are user-facing and change together.

## 10. Testing (Vitest units; no Playwright, per project rule)

- `signalText` + `getOvernightSignalContact` — string form; no-signal → empty; selector
  resolves Marcus and returns null when absent.
- `matchOfferIntent` — yes-intents → `'call'`, brief-intents → `'brief'`, everything else
  → `null` (incl. near-misses that must not false-fire).
- `applyHeroRecapExtensions` — creates a `proposal` deal advanced to `active`, a `tour`
  task on the correct next-Thursday date, links the contact, returns the `HeroActions`
  summary; `undoHeroActions` reverses all three writes.
- `isHeroCall` — true for the Marcus target, false otherwise.
- `CallBriefSpec` + `callBriefFallback` — fallback satisfies the schema; schemaCompat
  registration asserts no `maxItems`/`minItems` and `additionalProperties:false`.
- Seed guard — Marcus exists after `applyHeroes`, is an `owner`, has a `signal`, and his
  linked property passes `propertyQualifiesForUnderwriting`.
- Rename guard (light) — the greeting/recap user-facing copy says "Otto", not "Al".

The greeting speech, chips, live call, owner voice, and spoken narration are verified by
the **manual browser smoke test** (real ANTHROPIC + ELEVENLABS keys).

## 11. Gates (bind this sub-phase)

- `bun --bun run test` green **and** `bun --bun x tsc --noEmit` 0 errors. `vite build`
  does **not** type-check. Ignore biome + the pre-existing `ReferenceError: module is not
  defined` Vitest stderr line.
- `import z from "zod"` (default). Every new generator schema Anthropic-strict compatible
  (no array `.min()`/`.max()`; no nullable objects) **and** registered in
  `schemaCompat.test.ts`.
- FontAwesome `pro-regular`, never `fixedWidth`; Blueprint + Bootstrap; no unsolicited
  redesigns of existing components.

## 12. Acceptance criteria (4A slice of the parity checklist)

- [ ] Task 0: no user-facing "Al" remains in Phase 1–3 code; gates green after the rename.
- [ ] Seed: Marcus Pinckney is an owner hero with an overnight `signal` and an
      underwriting-eligible (multifamily) property; no deal yet.
- [ ] On first assistant open, the greeting **names Marcus's signal** and offers the
      call; a pending offer + Call/Brief chips are present.
- [ ] "Yes" (voice, typed, or chip) opens the live call to Marcus **keyless**; "brief me
      first" shows the `CallBriefCard` with a Call button; neither requires the agent.
- [ ] Anything that isn't a clear yes/brief falls through to the agent normally.
- [ ] Hanging up the hero call auto-opens a `proposal` opportunity, moves it to `active`,
      schedules the Thursday tour, and Otto **narrates** all three; the recap card shows
      them as done with a working Undo. Non-hero recaps are unchanged.
- [ ] Everything runs key-less via deterministic fallbacks.
- [ ] `bun --bun run test` green; `bun --bun x tsc --noEmit` 0 errors.

## 13. Downstream (later sub-phases)

- **4B** — the self-arriving owner email (`draft-reply`, REQUIREMENTS §3.6) filed to the
  deal 4A created; offers to underwrite.
- **4C** — underwrite (reuse `src/components/deals/underwriting/`) + the new
  occupancy-mismatch derivation + BOV draft + send → activity timeline.
- **4D** — the director sequences 4A→4B→4C, adds the ~10s inbound timer + reset/replay,
  and reuses 4A's seams (`useHeroOffer`, `heroRecapExtensions`, `OwnerSignal`).
