# AI Phase 2 — Voice Foundation

**Status:** Approved design, ready for implementation plan
**Date:** 2026-07-23
**Program:** AI & Voice integration (see `AI-VOICE-PRD.md` §3.5/§5, `AI-VOICE-REQUIREMENTS.md` §5)
**Builds on:** `2026-07-23-ai-phase-1-generative-agent-layer-design.md` (§10 names this phase)
**Branch:** `joel/ai-tools`

---

## 1. Context

Phase 1 shipped the generative agent layer: `.server()` one-shot generators, live-store
grounding (`buildAssistantContext`), the client-tool set, and the docked chat sidebar
(`AssistantSidebar`) driven by `useChat` over the `aiChat` SSE relay. **There is no voice
code anywhere yet** — no TTS, no STT, no greeting, and the only engagement signal is the
sidebar's `open` boolean (`useAssistant`).

This phase adds the **voice foundation**: a text-to-speech server function, a browser
speech-to-text hands-free loop, the speak lifecycle + controls, owner-voice selection (as a
Phase-3 contract), and the proactive spoken greeting with audio unlock. It is scoped so the
primitives Phase 3 (live-call) and Phase 4 (hero-arc) consume are built and tested here,
without building anything that has no consumer yet in Phase 2.

### Verified ground truth
- `relay.ts` already returns a **raw `Response`** from a `createServerFn`, and TanStack Start
  passes it through untouched. The TTS server fn returning `audio/mpeg` bytes uses this exact
  pattern — **no new route infrastructure is needed.**
- `aiConfigured` (GET server fn) is the precedent for a client-side key check; TTS gets a
  parallel `ttsConfigured`.
- The shell already uses `useHotkey` (`Mod+K` in `AppShell.tsx`) — the presenter kill-switch
  hotkey reuses it.
- `buildAssistantContext()` already computes the real open-task count and broker identity the
  greeting needs to be grounded.
- The repo pattern is **Zustand stores + pure modules** (`context.ts`, `dueDate.ts`), which is
  the structure this phase follows.

---

## 2. Decisions locked in brainstorming

1. **Engagement model:** sidebar-open **is** "engaged." The greeting fires once per session on
   first open. Minimal session state is added; **no separate "AI Mode" surface** is built.
2. **Phase 3 boundary (Option 2):** build the **full Al speak lifecycle** (exercised for real
   by the greeting + hands-free) and **owner-voice selection as a pure, tested function**;
   **defer** owner-line *playback wiring* and live-call silence *integration* to Phase 3
   (no throwaway fake-call harness in Phase 2).
3. **Architecture (Approach A):** an **imperative `voiceEngine` module** owns the messy
   audio/abort/generation logic; a **thin `useVoice` Zustand store** holds reactive UI state;
   a **`useHandsFree` hook** wraps the Web Speech API. The engine is callable from anywhere
   (including client-tool handlers), not just React.
4. **TTS provider:** **ElevenLabs**, key server-side, kept behind a swappable `synthesize()`
   seam. Default low-latency model `eleven_flash_v2_5`.
5. **Free tier for now:** development/local testing runs on the ElevenLabs free tier; the
   paid-tier move is a billing decision flagged in §9, not a code change.

### Non-goals (later phases)
- The live-call role-play simulation, owner-line playback, dialing UI, and hang-up recap —
  **Phase 3.** (Phase 2 builds `ownerVoiceFor` and `stopForCall()` as ready seams only.)
- Hero-arc orchestration and the scripted overnight signal — **Phase 4.** (The greeting
  surfaces an overnight-signal line only if the live context already carries one.)
- Mirroring the live transcript into the top-bar omni input in lockstep with the rail —
  deferred; Phase 2 targets the sidebar composer as the single voice surface, with a clean
  seam to add the omni mirror later.

---

## 3. Architecture

The Phase 1 relay stays **untouched**. Voice is an additive, self-contained layer.

```
src/ai/
  tts.ts                 # createServerFn → ElevenLabs → MP3 bytes (mirrors relay.ts) + ttsConfigured
  voice/
    ttsConfig.ts         # voice IDs (Al + gendered owner pools), model ids, voice_settings — env-swappable
    ownerVoice.ts        # ownerVoiceFor(contact) pure fn — Phase-3 contract, built + tested now
    textPrep.ts          # prepForSpeech(): stripHtml + decodeEntities + cap-on-sentence-boundary
    voiceEngine.ts       # imperative singleton: unlock/speak/cancel/pause/resume/setMuted + generation guard
    useVoice.ts          # thin Zustand store: voiceEnabled/muted/paused/speaking/listening/conversationMode
    useHandsFree.ts      # STT loop hook (Web Speech API) → sendMessage; stopForCall() seam
    greeting.ts          # composeGreeting(context) pure, deterministic
    useGreeting.ts       # first-open-per-session greeting orchestration + audio unlock arming
    *.test.ts            # units for the pure/testable pieces
```

**Two interaction shapes, mirroring Phase 1's "one capability, providers behind a seam":**
- Voice-out is a server fn (`tts.ts`) behind a `synthesize()` internal, consumed by the
  imperative `voiceEngine`.
- Voice-in is pure browser (`useHandsFree`), feeding the existing `sendMessage` — no server or
  provider dependency.

---

## 4. TTS server function (`src/ai/tts.ts`)

**Purpose:** speak Al's replies, the greeting, and (Phase 3) owner lines.

- **Shape:** `createServerFn({ method: "POST" })` validating `{ text: string, voiceId: string }`,
  returning a raw `Response` of `audio/mpeg` bytes on success — the same raw-`Response` pattern
  `relay.ts` uses. Headers include `Cache-Control: no-store`.
- **Provider seam:** the HTTP call lives in an internal `synthesize(text, voiceId): Promise<ArrayBuffer>`.
  Swapping to OpenAI later rewrites only this function; the server-fn contract and all client
  code are unchanged.
- **ElevenLabs call:** `POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=mp3_44100_128`,
  header `xi-api-key: <ELEVENLABS_API_KEY>`, body
  `{ text, model_id: "eleven_flash_v2_5", voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true } }`.
- **The "Al" persona without an `instructions` field:** ElevenLabs has no free-text persona
  field, so warmth comes from **voice choice + `voice_settings`** (above): expressive but
  stable, not sing-songy. `eleven_flash_v2_5` is the default (lowest latency + lowest credit
  cost, for the hands-free and Phase-3 live-call paths). v3 audio tags (`[warm]`, etc.) require
  the slower `eleven_v3` model and are intentionally **out of scope** for the low-latency path;
  the `ttsConfig` model id is a one-line change if the greeting is ever opted into v3.
- **Guardrails:** whitelist accepted `voiceId`s from `ttsConfig` (fall back to the default "Al"
  voice on an unknown id); cap `text` at ~4000 chars.
- **No key → `503`** (a normal state the client expects, never a 500). Provider failure → `502`.
- **`ttsConfigured`:** a GET server fn returning `{ configured: Boolean(process.env.ELEVENLABS_API_KEY) }`,
  mirroring `aiConfigured`, so the client chooses server-TTS vs. browser-speech up front.
- **Env:** add `ELEVENLABS_API_KEY=""` to `.env.sample` with the same "server-side only" comment
  style as `ANTHROPIC_API_KEY`.

### 4.1 `ttsConfig.ts`
Constants, overridable via env, so voices are swappable without code edits:
- `AL_VOICE_ID` — a warm neutral ElevenLabs stock voice (default seeded; env-overridable).
- `OWNER_VOICES` — small gendered pools `{ female: [...], male: [...] }` of ElevenLabs stock
  voice IDs, plus a browser-speech equivalent selector (system voices filtered by gender +
  en-locale, preferring network/premium/neural voices).
- `TTS_MODEL` — default `eleven_flash_v2_5`.
- `AL_VOICE_SETTINGS` — the `voice_settings` object above.

---

## 5. The imperative engine (`voice/voiceEngine.ts`)

A singleton module (not a hook) with a small interface:

```
unlock(): void                              // prime AudioContext + play a tiny silent clip
speak(text, opts?: { voiceId?: string }): Promise<void>   // resolves when done OR cancelled
cancel(): void                              // hard stop
pause(): void / resume(): void
setMuted(muted: boolean): void
```

- **Generation guard:** a monotonic `generation` counter. Each `speak` captures the current
  generation at entry; after the TTS fetch resolves, it re-checks before playing — a newer
  `speak()` or a `cancel()` bumps the counter, so **stale audio never plays** and in-flight
  fetches abort. This is what prevents Al talking after End-call (Phase 3) and what makes
  hands-free re-arm safe.
- **Playback path:** if `ttsConfigured` and not muted, fetch the MP3 via `tts` and play through
  a tracked `Audio` element. On `503`/network/provider error, fall back to `SpeechSynthesis`
  with the best available system voice. `setMuted(true)` drops pending speech.
- **`cancel()` correctness:** stops the `Audio` element (`pause()` + clear `src`), calls
  `speechSynthesis.cancel()`, bumps the generation, and **force-resolves any awaiting promise**
  — because pausing an `Audio` element never fires `ended`, awaiters must be settled explicitly
  (the subtle bug §5.5 of the requirements calls out).
- **Text prep:** all speech routes through `prepForSpeech()` (`textPrep.ts`) — strip HTML tags,
  **decode HTML entities to real characters** (`&#39;`→`'`), and cap (~650 chars) on a sentence
  boundary. Speaking raw HTML/entities reads as gibberish otherwise.
- **Speak gate:** the engine speaks only when `useVoice.voiceEnabled` is true and Al is engaged
  (sidebar open or a hands-free session live). When Al is fully closed, nothing speaks
  unprompted. (The store is the source of truth; the engine reads it.)

### 5.1 Owner voice (`voice/ownerVoice.ts`) — built now, wired in Phase 3
`ownerVoiceFor(contact) → voiceId`: heuristic gender from the contact's first name → pick from
`OWNER_VOICES` indexed by a **stable hash of the contact id**, so the same owner always sounds
the same. Fully unit-tested. A matching browser-speech selector picks a stable gendered system
voice when the key is absent. **No playback path is wired in Phase 2** — Phase 3's live call is
the first consumer.

---

## 6. Voice-in & greeting (client)

### 6.1 State
`voice/useVoice.ts` (new, reactive-only):
```
voiceEnabled: boolean   // default true — the on/off master
muted: boolean
paused: boolean
speaking: boolean       // engine sets true while playing
listening: boolean      // STT mic is hot
conversationMode: boolean  // hands-free loop is live
```
`useAssistant` gains exactly one field: **`greetedThisSession: boolean`** (+ a setter). Nothing
else in `useAssistant` changes.

### 6.2 Hands-free STT (`voice/useHandsFree.ts`)
Wraps `SpeechRecognition` (`lang="en-US"`, `interimResults=true`, `continuous=true`) per §5.3:
- **Own silence timer** (not the browser's): submit after a ~3.2 s pause once speech has
  started; wait ~10 s for the broker to begin; a `no-speech` error **keeps waiting** rather than
  aborting.
- **Rebuild the full transcript** from all result segments each `onresult` (continuous mode
  drops earlier words otherwise).
- **Live transcript renders in the sidebar composer**; the mic/listening indicator lights up.
- **On end:** take the transcript, clear the input, `sendMessage(text)`, and **flag that the
  resulting assistant turn should be spoken back**.
- **Re-arm** ~350 ms after Al *finishes speaking*, only if still in `conversationMode`.
  **Silence ends the loop** — never a perpetually-hot mic.
- **`stopForCall()`** — a hard stop (kills capture + exits `conversationMode`) that Phase 3
  calls when a live call opens, so an open mic can't capture call audio. Built now, unwired.
- **Unsupported / mic denied** → toast "type instead" and exit conversation mode cleanly.

**Speak-the-reply wiring:** the hands-free loop tags its submission; when that assistant turn
finishes streaming in `useChat`, the sidebar hands the final text to `voiceEngine.speak()`, and
on completion the loop re-arms. The speak trigger lives in the one place that already owns the
message stream (the sidebar), not inside the STT hook.

### 6.3 The greeting (`voice/greeting.ts` + `voice/useGreeting.ts`)
- **`composeGreeting(context)`** — a **pure, deterministic** function: time-of-day + first name
  (from `buildAssistantContext`), the **real** open-task count, an overnight-signal line **only
  if** the live context already carries one, ending in *"Want me to call your most important move
  first?"* Because it's deterministic, **the greeting speaks even with no Anthropic key.**
- **`useGreeting`** watches the sidebar `open` transition: on **first open per session**, if
  `voiceEnabled`, render the greeting as an assistant message, `voiceEngine.speak()` it, then —
  because it ends in a question — enter `conversationMode` (open the mic). If voice is off, still
  **show** the greeting; just don't speak or open the mic. Guarded by `greetedThisSession`.
- **Audio unlock:** armed at app load — a one-time `pointerdown`/`keydown` listener calls
  `voiceEngine.unlock()` (resume `AudioContext` + play a tiny silent clip) so the **real** TTS
  voice, not the robotic fallback, plays on the greeting.

### 6.4 Controls UI (in `AssistantSidebar`, no layout redesign)
- **Voice on/off toggle** in the header (speaker icon, `pro-regular`) — the `voiceEnabled` master.
- **Mic button** in the composer to start/stop hands-free manually.
- **While speaking:** pause/resume + stop affordance appears in the existing header/composer area.
- **Presenter kill-switch:** a global **`Escape`** hotkey (via the shell's existing `useHotkey`)
  calls `voiceEngine.cancel()` and exits `conversationMode` — instant silence mid-sentence for
  demo safety — paired with the visible stop button for discoverability.

All UI uses Blueprint components + Bootstrap utilities + `pro-regular` icons per project
conventions.

---

## 7. Degradation matrix

| Situation | Behavior |
|---|---|
| No `ELEVENLABS_API_KEY` | `tts` returns `503`; engine uses browser `SpeechSynthesis` (best system voice; gendered for owner lines). Voice works, quality degrades. |
| No `ANTHROPIC_API_KEY` | Greeting still **shows and speaks** (deterministic, no LLM). Hands-free still captures + submits; the *reply* degrades per Phase 1's no-key path. |
| `SpeechRecognition` unsupported / mic denied | Toast "type instead," exit conversation mode cleanly. Voice-out unaffected. |
| Both keys present (demo default) | Full path: ElevenLabs "Al" voice, hands-free loop, spoken grounded greeting. |

Nothing hard-fails; every gap is a normal state, matching the Phase 1 stance.

---

## 8. Testing

Vitest units (no live-API calls; audio/Web-Speech verified by hand — **no Playwright**, per
project rule):
- **`textPrep.prepForSpeech`** — strips HTML, decodes entities (`&#39;`→`'`), caps on a sentence
  boundary.
- **`ownerVoice.ownerVoiceFor`** — gender heuristic + **stable-per-contact** (same id → same
  voice across calls).
- **`greeting.composeGreeting`** — time-of-day branches, real task-count wording, conditional
  signal line, always ends in the offer.
- **`voiceEngine` generation guard** — a superseding `speak`/`cancel` bumps the generation so
  stale audio is dropped and the pending promise settles (mock `fetch` + `Audio`).
- **`tts` server fn** — voice whitelist + default fallback, `503` on no key, ~4000-char cap
  (mock `fetch`).

Audio playback and the Web Speech API don't exist in jsdom; those paths are manual. Manual test
script: open sidebar → hear grounded greeting → answer aloud → hear reply → `Escape` kills it.

---

## 9. Risks & open items

- **ElevenLabs free tier (~10 min/mo, non-commercial):** fine for local dev (chosen for now),
  but it **will not** survive rehearsals + a keynote, and its **non-commercial license means it
  shouldn't be used for the keynote itself.** Move to a paid tier before rehearsals — **Starter
  (~$5/mo)** already grants a commercial license + ~30 min of `flash` audio; **Creator
  (~$22/mo)** is comfortable for repeated rehearsals + live use. `eleven_flash_v2_5` is the
  lowest-latency and lowest-credit model, which is why it's the default. Pure billing/licensing
  decision — no code change.
- **ElevenLabs stock voice IDs** must be confirmed against the account during implementation and
  seeded into `ttsConfig`; they're env-overridable so a swap is trivial.
- **Web Speech API support** is Chromium-strong, weaker elsewhere; the unsupported path (toast +
  type-instead) is the guardrail.
- **Overnight-signal line in the greeting** depends on Phase 4's scripted signal; Phase 2 only
  surfaces it if the live context already carries one, so the greeting stays grounded until then.

---

## 10. Downstream phases (unchanged from Phase 1 §10)

- **Phase 3 — Live-call simulation:** dialing→ringing→connected UI, `call-turn` role-play, owner
  lines spoken via `ownerVoiceFor` (built here), hang-up recap. Wires `voiceEngine.cancel()` and
  `useHandsFree.stopForCall()` on call open.
- **Phase 4 — Hero-arc orchestration:** scripted director, self-arriving simulated owner email,
  the overnight signal that lights up the greeting, underwrite + BOV.
