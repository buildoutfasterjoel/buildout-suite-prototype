# AI Phase 3 — Live-Call Simulation

**Status:** Approved design, ready for implementation plan
**Date:** 2026-07-24
**Program:** AI & Voice integration (see `AI-VOICE-PRD.md` §3.4/§4.1, `AI-VOICE-REQUIREMENTS.md` §3.7/§5.2/§5.3)
**Builds on:** `2026-07-23-ai-phase-2-voice-foundation-design.md` (§10 names this phase)
**Branch:** `joel/ai-tools`

---

## 1. Context

Phase 1 shipped the generative agent layer (`.server()` one-shot generators, the
client-tool set, the `AssistantSidebar` chat over the `aiChat` SSE relay). Phase 2
shipped the voice foundation: the `tts` server fn, the imperative `voiceEngine`
(speak / cancel / pause / mute + a generation guard), `useHandsFree` (STT loop with
a `stopForCall()` seam), `ownerVoiceFor(contact)`, and the proactive greeting.

This phase builds **the live call** — the signature moment of the demo. It is
scoped to **reusable call mechanics + a generic recap**, deliberately stopping
before the scripted hero-arc orchestration (Phase 4).

### Verified ground truth (traced in the codebase)

- **A working call state machine already exists but is contact-page-local.**
  `src/components/contacts/useLiveCall.ts` owns `calling`(countdown 3→1)→`ringing`
  (synthesized Web-Audio ring tone + answered cue)→`connected` (live timer), plus
  mute and a `pendingLog` flag. `src/components/contacts/LiveCallBar.tsx` is the
  presentational bar. Both are wired only in
  `src/routes/_shell/backoffice/contacts/$contactId.tsx`, which ends a connected
  call in the mandatory, non-dismissible `LogCallModal`. **There is no AI in this
  flow yet** — no transcript, no owner role-play, no suggestions, no owner voice,
  no recap.
- **`start_call` is a Phase-1 stub** (`src/ai/tools.ts:472`) that only navigates to
  the contact record. Making it open the real call is what wires the agent (and,
  in Phase 4, the greeting) to the live call — "broker says *call Marcus*" → agent
  loop → live call, for free.
- **The Phase-2 seams are ready.** `voiceEngine.speak(text, { voiceId })` /
  `.cancel()` are generation-guarded (`voiceEngine.ts`); `ownerVoiceFor(contact)`
  returns a stable gendered voice per contact id (`ownerVoice.ts`);
  `useHandsFree().stopForCall()` hard-stops capture and exits conversation mode
  (`useHandsFree.ts`).
- **Global overlays mount once in `AppShell`** (`GlobalCreateDealModal`,
  `GlobalStageGateModal`, etc., all gated on `hydrated`). A global `LiveCallBar`
  fits that exact pattern.
- **The generator pattern is fixed:** a Zod schema in `generate/schemas.ts`
  (`import z from "zod"` — default import, a documented repo gotcha), a prompt in
  `generate/prompts.ts`, a `createServerFn` + `runGenerator({ system, user, schema,
  fallback, model? })` in `generate/generators.ts`, re-exported from
  `generate/index.ts`. `AI_MODEL_REASONING` is used for synthesis tasks.
- **The recap can reuse existing UI infra:** `AssistantSidebar`'s
  `ToolResultCards` already renders interactive cards from tool output (deals,
  contacts, email drafts, briefs). The recap renders as one more Al message + cards.
- **Data actions exist:** `createDeal`, `createTask`, `updateDealStage`,
  `linkContactToDeal`, `addNote` (`src/data/actions.ts`).

---

## 2. Decisions locked in brainstorming

1. **Phase 3 / Phase 4 boundary:** keep them **separate** as originally planned.
   Phase 3 = reusable call mechanics + a **generic** recap (summary + drafted
   tasks + an "open opportunity" action) built with **clean seams**. Phase 4's
   scripted director *invokes and extends* those seams (pipeline-move, schedule
   tour, narrate; plus the self-arriving email, underwrite, BOV, and the overnight
   signal that lights the greeting). The live call itself is fully reusable now
   (call-from-chat, call-from-contact, and future power-dial).
2. **Reuse the existing bar.** Extend `LiveCallBar` / the `useLiveCall` machine
   rather than build new call chrome.
3. **One global call store.** Promote the call state machine into a global
   `useCallStore`; the contact page reads the same store (behavior unchanged). One
   source of truth so the agent's `start_call`, the contact-page button, and the
   Phase-4 director all share one path.
4. **Call UI = the docked bar that expands on connect** to carry the live
   transcript + suggestion chips (the "little floating bar" grows a panel). The
   record stays visible behind it.
5. **Broker input during a call is tap-a-chip or type a line — never voice**
   (§5.3). Opening a call hard-stops the mic and any in-progress capture.
6. **Countdown is 5** (PRD §3.4); the existing machine's 3 is bumped to 5.
7. **Recap = "Al reports" in the sidebar.** On hang-up the sidebar opens and Al
   posts the recap (spoken aloud if voice is on, but **no mic re-arm** — a one-way
   report), with interactive task-draft + open-opportunity cards. This supersedes
   `LogCallModal` for calls that ran the AI flow.
8. **Call brief deferred to Phase 4.** Its core value ("the signal to lead with",
   "brief me first") is signal-driven, and there is no signal data until Phase 4.
   The connected panel's suggestion chips answer "what do I say?" for Phase 3.

### Non-goals (later phases)

- The scripted hero-arc director (signal → call → recap → inbound email →
  underwrite → BOV), the self-arriving simulated owner email, the overnight signal
  that names Marcus in the greeting, and the recap's hero extensions
  (opportunity→pipeline→tour→narrate) — **Phase 4.**
- The pre-call **call brief** card (opener / signal / ask / voicemail) — **Phase 4.**
- Power-dial (auto-advancing through a call list) — a later enhancement; Phase 3
  builds the single-call mechanics it will reuse.

---

## 3. Architecture

Additive and self-contained, mirroring the Phase-1/2 "one capability, providers
behind a seam" structure.

```
src/ai/generate/
  schemas.ts     + CallTurnSpec, CallRecapSpec              (Zod; default-import z)
  prompts.ts     + CALL_TURN_PROMPT, CALL_RECAP_PROMPT
  generators.ts  + generateCallTurn, generateCallRecap      (createServerFn + runGenerator + fallback)
  index.ts       + re-exports

src/components/call/            (call code, promoted out of components/contacts/)
  useCallStore.ts   # global Zustand store: phase, target, transcript[], suggestions[],
                    #   awaitingOwner, shouldEnd, muted, elapsedSecs, countdown, recap
  callFlow.ts       # imperative controller: open(contact) / submitLine(text) / hangUp() /
                    #   endCall() / toggleMute(). Owns the phase timers (moved from useLiveCall),
                    #   the ring tones, the turn fetch, owner-voice playback, and the
                    #   generation-guard interaction with voiceEngine.
  LiveCallBar.tsx   # the existing bar, extended: connected state adds a transcript view,
                    #   suggestion chips, and a type-a-line input.
  callRecap.ts      # composeRecapReport(recap, contact): CallRecapSpec → the sidebar Al
                    #   message text + the interactive task/opportunity card payload (pure).
  ringtone.ts       # the Web-Audio ring/answered-cue helpers (moved verbatim from useLiveCall).
  *.test.ts

src/components/layout/AppShell.tsx   # mount <LiveCallBar/> once (gated on hydrated)
src/ai/tools.ts                      # start_call → callFlow.open(contact)
src/routes/.../$contactId.tsx        # drop local useLiveCall; read global store; button → callFlow.open
```

**Why a `callFlow` imperative controller (not just a hook):** like `voiceEngine`,
the call must be startable from non-React code paths — the `start_call` client-tool
handler and (Phase 4) the director. The controller owns the messy timers /
audio / turn-fetch logic; `useCallStore` holds only reactive UI state; `LiveCallBar`
is presentational. This is the same split Phase 2 used (`voiceEngine` + `useVoice`).

### 3.1 `useCallStore` (reactive state only)

```
phase: 'idle' | 'calling' | 'ringing' | 'connected'
target: { contactId, name, entity, phone, initials, firstName } | null
countdown: number            // 5 → 1 during 'calling'
elapsedSecs: number          // connected timer
muted: boolean
transcript: Array<{ id, speaker: 'you' | 'them', text }>
suggestions: string[]        // current owner-turn broker suggestions (0–3)
awaitingOwner: boolean       // a call-turn fetch is in flight (disables chips/input)
shouldEnd: boolean           // owner is wrapping up → show the hang-up hint
recap: CallRecapSpecT | null // set on hang-up, consumed by the sidebar, then cleared
```

`target` snapshots the fields the bar + generators need so the store never depends
on the live contact record mid-call. `firstName` feeds `ownerVoiceFor`.

---

## 4. Opening a call

`callFlow.open(contact)`:

1. **Silence Al + kill the mic.** `voiceEngine.cancel()` and
   `useHandsFree.stopForCall()` (via a small module-level bridge — see §7) so Al
   never talks over the call and an open mic can't capture call audio (§5.3).
2. **Run the phase machine** (moved from `useLiveCall`): `calling` (5→1, ~900 ms
   steps) → `ringing` (ring tone loop) → `connected` (answered cue + live timer).
   Timings and the synthesized tones are preserved verbatim from `useLiveCall`.
3. **Seed the opening owner line.** On entering `connected`, fetch one
   `generateCallTurn` with `brokerLine: ""` (the owner answers first), append the
   `ownerReply` to the transcript as `them:`, speak it via
   `voiceEngine.speak(reply, { voiceId: ownerVoiceFor(target) })`, and render its
   `suggestions`.

**Entry points (all one path):**
- Agent `start_call` tool (`tools.ts`): `resolveContactByName(contact_name)` →
  `callFlow.open(contact)`. Returns `{ started, contactId }`.
- Contact-page "Call" button → `callFlow.open(contact)`.
- Phase 4 director → same `callFlow.open` (out of scope here).

---

## 5. The connected turn loop (§3.7)

- The broker submits a line by **tapping a suggestion chip** or **typing in the
  bar's line input**. The submitted text appends as `you:`.
- `callFlow.submitLine(text)` sets `awaitingOwner: true`, calls
  `generateCallTurn({ candidate, property: null, history, brokerLine: text })`,
  then appends `ownerReply` as `them:`, speaks it in the owner voice, replaces
  `suggestions`, sets `shouldEnd`, and clears `awaitingOwner`.
- **`candidate`** maps from the `Contact`: `{ name, role, entity: company, note:
  notes ?? "", phone }`. **`property` is `null`** in Phase 3 (no signal data yet;
  Phase 4 passes the signal-bearing property).
- **`history`** is the transcript mapped to `[{ speaker: 'you'|'them', text }]`.
- **`shouldEnd: true`** renders a "wrapping up — hang up when ready" hint and
  keeps the chips live; it **never auto-hangs-up** (hanging up is one of the two
  human moves).
- **Owner audio is generation-guarded.** `voiceEngine`'s existing guard means a
  hang-up (which calls `voiceEngine.cancel()`) bumps the generation so any
  in-flight owner-line fetch/playback is dropped — Al/owner never speaks after
  End-call.
- **Fallback** (no `ANTHROPIC_API_KEY`): `{ ownerReply: "Mhm, go on.",
  suggestions: [], shouldEnd: false }` — the call still runs; the broker drives it.

---

## 6. Hang-up recap — "Al reports" (§3.4, §4.1 step 4)

`callFlow.endCall()`:

1. `voiceEngine.cancel()` (stop any owner line), stop timers/tones, set
   `phase: 'idle'`.
2. `generateCallRecap({ transcript, contact })` → `CallRecapSpec`.
3. Store it (`recap`) and **open the assistant sidebar**; the sidebar renders it
   as an Al message + cards (§6.1) and **speaks the summary** if `voiceEnabled`
   (Al is now "engaged" — the sidebar is open), **without entering conversation
   mode** (no mic re-arm; this is a one-way report).

Hanging up during `calling`/`ringing` (never connected) logs nothing and shows no
recap — same as today's `hangUp`.

### 6.1 The recap in the sidebar

The sidebar reads `useCallStore.recap`. `composeRecapReport(recap, contact)` (pure,
tested) returns:
- **Al message text:** one-line sentiment + 1–2 key points (light HTML, spoken via
  `voiceEngine`).
- **Task-draft cards:** each `recap.tasks[]` renders as a card with **Keep** /
  **Drop**; **Keep** calls `createTask({ name, dueDate: parseDueDate(due), contactId })`.
  **Edit** opens the existing Add/Edit Task modal seeded with the draft (reuses
  `GlobalAddTaskModal`).
- **Open-opportunity card** (when `recap.opportunity` present): a button →
  `createDeal` seeded from the contact (name/address from `recap.opportunity` and
  the contact's linked property when available), then a link to the new deal.

This renders through the existing `ToolResultCards`/card components in
`AssistantSidebar` (a new `CallRecapCard`), so no new rendering pipeline is needed.
The call is also written to the contact's activity (a logged "call" entry with the
summary), preserving what `LogCallModal` used to capture. **`LogCallModal` is
retired from the AI call path**; the recap is the post-call surface.

**Fallback** (no key): a deterministic recap — sentiment `"neutral"`, key points
derived from transcript length / who spoke last, and one generic follow-up task
draft (`"Follow up with {firstName}"`, due in 3 days). The recap still appears and
still creates a real task on Keep.

---

## 7. Wiring the mic kill-switch to `callFlow`

`callFlow` lives outside React but must call `useHandsFree().stopForCall()`, which
is a hook-scoped callback. Bridge it the way the sidebar already bridges speak: the
`AssistantSidebar` (which owns the `useHandsFree` instance) registers its
`stopForCall` into a tiny module-level setter (`registerStopForCall(fn)`) on mount;
`callFlow.open` calls the registered fn (no-op if none registered, e.g. sidebar
closed). This mirrors how `voiceEngine` is a shared singleton the sidebar drives.
`voiceEngine.cancel()` is already a global singleton call — no bridge needed.

---

## 8. Generators (mirror Phase 1 exactly)

`generate/schemas.ts`:
```ts
export const CallTurnSpec = z.object({
  ownerReply: z.string(),
  suggestions: z.array(z.string()).max(3),
  shouldEnd: z.boolean(),
});
export const CallRecapSpec = z.object({
  sentiment: z.enum(["positive", "neutral", "negative"]),
  keyPoints: z.array(z.string()),
  tasks: z.array(z.object({ title: z.string(), due: z.string().nullable() })),
  opportunity: z.object({ name: z.string(), address: z.string() }).nullable(),
});
```

`generate/generators.ts`:
- `generateCallTurn` — `createServerFn` + `runGenerator({ system: CALL_TURN_PROMPT,
  user: JSON.stringify({ candidate, property, history, brokerLine }), schema:
  CallTurnSpec, fallback: callTurnFallback })`. Default (fast) model — this is a
  short, latency-sensitive chat turn.
- `generateCallRecap` — `createServerFn` + `runGenerator({ model:
  AI_MODEL_REASONING, system: CALL_RECAP_PROMPT, user: JSON.stringify({ transcript,
  contact: { name, entity, ... } }), schema: CallRecapSpec, fallback:
  callRecapFallback })` — synthesis over the transcript.

Prompt intent per §3.7 (turn) and §3.4 (recap). Suggestions must be tactically
varied (accept / redirect / close). Recap sentiment + key points must come only
from the transcript; tasks are concrete next steps; opportunity is set only when
the call clearly implies a new deal.

---

## 9. Degradation matrix

| Situation | Behavior |
|---|---|
| No `ANTHROPIC_API_KEY` | `generateCallTurn`/`generateCallRecap` use their deterministic fallbacks. The call runs end-to-end; the owner gives minimal replies and the recap is a generic summary + one task draft. |
| No `ELEVENLABS_API_KEY` | Owner lines speak via browser `SpeechSynthesis` with a gendered system voice (already handled inside `voiceEngine`; `ownerVoiceFor` also has the browser-speech selector). |
| Voice off (`voiceEnabled` false) | The call and transcript still work silently; owner lines show as text; the recap shows but isn't spoken. |
| Mic was hot (hands-free) when a call opens | `stopForCall()` hard-stops it; the mic never re-arms during or right after the call. |

Nothing hard-fails — every gap is a normal state, matching Phases 1 & 2.

---

## 10. Testing (Vitest units; no Playwright, per project rule)

- **`CallTurnSpec` / `CallRecapSpec` + fallbacks** — shape validity; fallback
  objects satisfy the schema.
- **`useCallStore` reducers** — phase transitions, transcript append, suggestion
  replace, recap set/clear.
- **`composeRecapReport`** — maps a `CallRecapSpec` to the Al message text + card
  payload; handles the no-opportunity and empty-tasks cases.
- **`callFlow` generation guard** — opening a call calls `voiceEngine.cancel()` +
  the registered `stopForCall`; a hang-up mid-turn drops the pending owner audio
  (mock `voiceEngine` + timers).
- **`ownerVoiceFor` in the call path** — the seeded `target.firstName` yields a
  stable voice across turns (regression guard on the seam).

Audio playback, the ring tones, and the live call are verified **by hand** (the
manual smoke test below).

---

## 11. Pre-build gate — Phase-2 TTS smoke test

Phase 3 leans hard on TTS for owner lines, so before any build code we de-risk the
Phase-2 `tts(...) as unknown as Response` client-transport cast (`voiceEngine.ts:68`)
with a **real `ELEVENLABS_API_KEY`** (already in `.env`). Manual steps (the user
runs them; the assistant cannot drive a real browser/audio):

1. `bun --bun run dev`, open the app, open the assistant sidebar.
2. Confirm the grounded greeting **speaks in the ElevenLabs "Al" voice** (not the
   robotic browser fallback) — proves the server-TTS transport works end-to-end.
3. Answer aloud; confirm Al's reply speaks. Press `Escape`; confirm audio stops
   instantly.
4. If the greeting speaks in a robotic voice, the transport cast is the suspect —
   fix that before building the live call.

If this fails, we fix the transport as task 0 of the plan.

**Note:** the ElevenLabs free tier allows only premade voices via the API (library
voices are blocked). The owner-voice pools in `ttsConfig` use premade IDs, so they
work on the free tier; confirm the seeded IDs during implementation.

---

## 12. Acceptance criteria (Phase 3 slice of the parity checklist)

- [ ] A call opens from the agent (`start_call`) and from the contact-page button,
      both through `callFlow.open` and one global store.
- [ ] Dialing (5→1) → ringing → connected renders with the existing tones; the
      record stays visible behind the bar.
- [ ] Opening a call silences Al and hard-stops the mic; nothing re-arms during or
      after the call.
- [ ] The owner replies one line at a time, **spoken** in a gender-appropriate,
      stable-per-owner voice; 2–3 varied suggestion chips render each turn.
- [ ] Broker input is chips or typed line only (no voice) during a call.
- [ ] `shouldEnd` shows the wrap-up hint and never auto-hangs.
- [ ] Hang-up opens the sidebar with an "Al reports" recap: spoken summary +
      keep/edit/drop task drafts + an open-opportunity action; kept tasks and the
      opportunity create real records; the call is logged to the contact.
- [ ] No owner/Al audio plays after End-call (generation guard).
- [ ] Everything runs key-less via the deterministic fallbacks.
- [ ] `bun --bun run test` green; `bun --bun x tsc --noEmit` 0 errors.

---

## 13. Downstream (Phase 4, unchanged)

- **Phase 4 — Hero-arc orchestration:** the scripted director that chains
  signal → call → recap → self-arriving inbound email → underwrite → BOV; the
  overnight signal that lights the greeting and names Marcus; and the recap's hero
  extensions (open opportunity → move into pipeline → schedule the Thursday tour →
  narrate). All of it calls the Phase-3 seams (`callFlow.open`, the recap) rather
  than reimplementing them.
```
