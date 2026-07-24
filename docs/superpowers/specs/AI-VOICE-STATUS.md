# AI & Voice — Program Status

**Single source of truth for where the AI & Voice program stands.** Update this page
whenever a phase's status changes. It's the first thing a new contributor (human or agent)
should read before picking up work.

- **Branch:** `joel/ai-tools` (intentionally NOT merged — the user handles PRs/merges; leave it as-is).
- **Reference specs:** [`AI-VOICE-PRD.md`](./AI-VOICE-PRD.md) (product intent + the hero arc) and [`AI-VOICE-REQUIREMENTS.md`](./AI-VOICE-REQUIREMENTS.md) (the buildable capability contracts).
- **Working convention (every phase):** brainstorm → design spec (in this folder) → implementation plan (in `../plans/`) → subagent-driven execution with a spec+quality review after each task and a final whole-branch review. Uses the `superpowers` skills.

---

## Phase status

| Phase | Status | Design spec | Plan |
|---|---|---|---|
| 1 — Generative agent layer | ✅ Built | `2026-07-23-ai-phase-1-generative-agent-layer-design.md` | `../plans/2026-07-23-ai-phase-1-...md` |
| 2 — Voice foundation | ✅ Built | `2026-07-23-ai-phase-2-voice-foundation-design.md` | `../plans/2026-07-23-ai-phase-2-voice-foundation.md` |
| 3 — Live-call simulation | ✅ Built (smoke-tested) | `2026-07-24-ai-phase-3-live-call-simulation-design.md` | `../plans/2026-07-24-ai-phase-3-live-call-simulation.md` |
| 4 — Hero-arc orchestration | 🔨 In progress — decomposed into 4A–4D | see below | — |
| ↳ 4A — Signal + greeting + recap hero-extensions | ✅ Built (smoke-test pending) | `2026-07-24-ai-phase-4a-signal-greeting-recap-extensions-design.md` | `../plans/2026-07-24-ai-phase-4a-signal-greeting-recap-extensions.md` |
| ↳ 4B — Self-arriving inbound email | ⛔ Not started | — | — |
| ↳ 4C — Underwrite + BOV | ⛔ Not started | — | — |
| ↳ 4D — The director (sequences 4A→4B→4C) | ⛔ Not started | — | — |

> Git history on `joel/ai-tools` is the authoritative build record — each task is its own
> descriptive commit (`git log --oneline`).

---

### Phase 1 — Generative agent layer ✅

The "act, don't just chat" agent. A "one generator, two consumers" pattern: each capability
is a `createServerFn` → `runGenerator({system,user,schema,fallback})` in `src/ai/generate/`,
consumed by both an in-context screen affordance and an agent tool.

- 7 generators (NL listing filter, draft email, ranked call list, marketing doc, prospect
  assessment, contact brief, book strategy) + 12 agent tools (registered in `toolDefs.ts` +
  `TOOL_DEFS` + `createClientTools`). Grounding via `src/ai/context.ts`.
- Every generator has a deterministic no-key fallback; `aiConfigured()` gates the client.
- `start_call` shipped here as a STUB (navigate only) — made real in Phase 3.

### Phase 2 — Voice foundation ✅

- `src/ai/tts.ts` — `tts` (POST → MP3 bytes) + `ttsConfigured` (GET), ElevenLabs behind a
  swappable `synthesizeResponse()` seam (503 no key / 502 provider fail, never throws).
- `src/ai/voice/` — `voiceEngine` (imperative singleton: speak/cancel/pause + generation
  guard), `useVoice` store, `useHandsFree` (Web Speech STT loop + `stopForCall()`),
  `greeting`/`useGreeting` (once-per-session spoken greeting + audio unlock), `ownerVoice`
  (`ownerVoiceFor` — stable gendered voice per contact), `textPrep`.
- Wired into `AssistantSidebar` additively (greeting, spoken replies + hands-free re-arm,
  mic button, voice toggle, Escape kill-switch).
- **TTS provider = ElevenLabs** (`eleven_flash_v2_5`). Free tier is fine for dev; move to a
  paid tier before public/keynote use (commercial license + no attribution). Provider stays
  swappable.

### Phase 3 — Live-call simulation ✅

The signature moment. Base `676c711` → current HEAD; full suite green, tsc 0; manual browser
smoke test passed (owner role-play + spoken lines + recap all working).

- `src/components/call/` — `useCallStore` (global call state), `ringtone`, `callFlow`
  (imperative controller: `open(contact,phone?)` / `submitLine` / `hangUp` / `endCall`; a
  `session` counter drops stale owner-turn AND recap fetches; `voiceEngine.cancel()` +
  `stopForCall()` on open so Al never talks over the call and the mic never re-arms during
  it), `LiveCallBar` (global, mounted in `AppShell`; expands on connect to a
  transcript + tap-a-chip / type-a-line — no mic during a call), `callRecap`
  (`composeRecapReport`), `CallRecapCard` ("Al reports" recap — keep/edit/drop task drafts +
  open-opportunity; renders at the bottom of the sidebar flow, spoken once).
- 2 new generators: `generateCallTurn` (owner reply + 2-3 suggestions + shouldEnd) and
  `generateCallRecap` (sentiment / key points / tasks / opportunity).
- `start_call` is now real (`callFlow.open`). Contact page migrated to the global store; the
  old `contacts/useLiveCall.ts` + `contacts/LiveCallBar.tsx` were deleted;
  `contacts/LogCallModal.tsx` is orphaned (left in tree, no importer).
- **Out of scope by design (→ Phase 4):** the call brief, and the recap's hero extensions
  (opportunity → pipeline → schedule tour → narrate).

### Phase 4 — Hero-arc orchestration 🔨 (decomposed into 4A–4D)

**Naming:** the in-product assistant is named **Otto** in this prototype (the PRD calls it
"Al" — the source-prototype name). A global `Al → Otto` rename of Phase 1–3 code is **task 0
of sub-phase 4A**; historical design docs + the PRD keep "Al" as a record.

Phase 4 is decomposed into four sub-phases, each its own spec → plan → build, in order:

- **4A — Signal + greeting + recap hero-extensions** (✅ built, smoke-test pending): overnight
  signal on owner Marcus Pinckney → greeting names it → "yes"/"brief me first" → the Phase-3
  live call → hang-up recap auto-opens the opportunity, moves it into the pipeline, schedules
  the Thursday tour, and Otto narrates it. Reuses the hero-persona system
  (`HeroKey`/`HERO_FIXTURES`), `composeGreeting(overnightSignal)`, `callFlow.open`, and the
  recap seam. Built base `547e46c` → HEAD `3c079be` (13 commits); full suite 343/343, tsc 0.
  New: `OwnerSignal` on `Contact` + `src/data/signal.ts`; Marcus hero fixture;
  `src/ai/heroOffer.ts` (`useHeroOffer` + `matchOfferIntent`); `buildGreetingWithOffer`;
  `generateCallBrief` + `CallBriefCard`; `heroRecapExtensions` (open→pipeline→tour + undo);
  `useCallStore.heroActions`. Design + plan linked in the table above.
  **Carry to 4C:** Marcus's Palmetto Court property was coerced to multifamily but keeps its
  old (non-multifamily) generated financials — 4C should seed realistic 48-unit numbers.
- **4B — Self-arriving inbound email** (⛔): new `draft-reply` generator (REQUIREMENTS
  §3.6), ~10s self-arriving owner email with rent roll + T-12, filed to the deal.
- **4C — Underwrite + BOV** (⛔): reuse the deterministic underwriting flow
  (`src/components/deals/underwriting/`) to price the deal + flag the occupancy mismatch
  + draft the BOV → send → activity timeline. (The hero property is seeded multifamily in
  4A so it's underwriting-eligible.)
- **4D — The director** (⛔): the scripted glue sequencing 4A→4B→4C with deterministic
  timing/narration + reset/replay; reuses 4A's seams (`useHeroOffer`,
  `heroRecapExtensions`, `OwnerSignal`).

**Original full-scope Phase 4 description (retained for reference):**

- Overnight **signal** on an owner → the greeting names it → "yes" → the live call (Phase 3,
  reuse `callFlow.open`) → hang-up recap's **hero extensions** (open opportunity → move into
  the pipeline → schedule the Thursday tour → Al narrates aloud) → ~10s later a **simulated
  owner email self-arrives** (new `draft-reply` generator, REQUIREMENTS §3.6) with rent roll
  + T-12, filed to the deal → **underwrite** (reuse the Cactus underwriting generation) +
  flag the occupancy mismatch → draft the **BOV** → send → lands on the activity timeline.
- There is **no signal field on `Contact`** yet — Phase 4 seeds/scripts it. Current user =
  Ethan Thompson; specs name the hero owner "Marcus Pinckney" (seed/choose the hero contact).
- **Reuse the Phase-3 seams, don't rebuild:** `callFlow.open`, the recap seam (`useCallStore.recap`
  + `composeRecapReport` + `CallRecapCard`), `ownerVoiceFor`, `voiceEngine`, the greeting.
- Phase 4 is large and spans independent subsystems — consider decomposing it into
  sub-phases (recap extensions + signal/greeting · inbound email · underwrite + BOV · the
  director that sequences them), each its own spec → plan → build.

---

## Cross-cutting gotchas (bind every phase)

- **Gates:** `bun --bun run test` green AND `bun --bun x tsc --noEmit` 0 errors. `vite build`
  does NOT type-check. Non-gates to ignore: biome, and the pre-existing `ReferenceError:
  module is not defined` Vitest stderr line.
- **No Playwright** — browser/audio/live-call paths are verified by a manual smoke test; all
  pure logic is unit-tested.
- **zod is a DEFAULT import** (`import z from "zod"`) — the named form resolves `z` to
  `undefined` under this repo's Vitest.
- **Anthropic strict structured output** (`output_config.format.schema`) rejects two
  zod→JSON-schema constructs, so no generator schema may use them: (a) array size bounds
  (`.max()`/`.min()` on `z.array` → `maxItems`/`minItems`) — put counts in the prompt
  instead; (b) nullable objects (`z.object({...}).nullable()` → an `anyOf` whose inner
  object lacks `additionalProperties:false`) — use a required object + a sentinel and map to
  null in the consumer. Nullable primitives are fine. `src/ai/generate/schemaCompat.test.ts`
  guards this — add every new generator schema to it. `runGenerator` swallows the 400 into
  the fallback, so this fails **silently** (the call "works" but returns the stub) without
  the test.
- **Graceful degradation is required:** with no keys the product still runs end-to-end
  (deterministic fallbacks for language; browser `SpeechSynthesis` for voice).
- FontAwesome `pro-regular` by default; never pass `fixedWidth`. Blueprint React + Bootstrap
  utilities (no Tailwind). No unsolicited redesigns of existing components.
