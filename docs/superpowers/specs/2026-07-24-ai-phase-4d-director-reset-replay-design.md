# AI Phase 4D — The Director (reset / replay + loop-closing beat)

**Status:** Approved design (user delegated judgement for 4C/4D), ready for implementation plan
**Date:** 2026-07-24
**Program:** AI & Voice — see [`AI-VOICE-PRD.md`](./AI-VOICE-PRD.md) §4.1 (the full hero arc) + §3.1 (loop-closing reminder)
**Builds on:** 4A + 4B + 4C (all built). The arc already self-sequences via `HeroInboundWatcher` / `BovWatcher` / arming.
**Branch:** `joel/ai-tools` (leave as-is; user handles PRs/merges)

> Assistant is **Otto**.

---

## 1. Context — what "the director" actually needs to do

By design, Phase 4 distributed the *sequencing* into the sub-phases: the greeting arms the
call offer (4A); the recap sets `heroActions` → `HeroInboundWatcher` arms the ~10s inbound
(4B); the inbound's "Underwrite" arms `useBovDraft` → `BovWatcher` drafts the BOV (4C). The
arc runs end-to-end with no central controller. So 4D is **not** a re-sequencer — it is the
**demo lifecycle controller**: the two things the specs attribute to the director that don't
exist yet are **reset/replay** (run the keynote demo repeatedly from a clean state) and the
**loop-closing completion beat** (PRD §3.1 — when the arc finishes, Otto closes the loop and
offers to run it again).

Verified ground truth:
- **A whole-store `reset()` already exists + is tested.** `useDataStore.reset()`
  (`src/data/dataStore.ts:98`) clears the IndexedDB snapshot and re-seeds via `seedSlice()`
  (→ `generateDataset()`), cleanly replacing all data and **re-establishing Marcus's 4A
  signal + no-deal state**. `src/data/dataStore.test.ts:36` pins its semantics (re-seeds to
  50 properties + rewrites the snapshot). → **prefer the whole-store reset over surgical
  deletion** (there is no `deleteListing`; deal-child removers don't exist).
- **All the AI-store clears exist:** `useCallStore.reset()`/`clearHeroActions()`
  (`useCallStore.ts`), `useHeroOffer.clearOffer()` (`heroOffer.ts:14`),
  `useInboundEmail.clearInbound()` (`useInboundEmail.ts:22`), `useBovDraft.clear()`
  (`useBovDraft.ts:28`), `heroInbound.cancel()` (`heroInbound.ts:110`), `callFlow.hangUp()`
  (`callFlow.ts:175`, which already calls `voiceEngine.cancel()` + `useCallStore.reset()`),
  `voiceEngine.cancel()` (`voiceEngine.ts:135`), `useVoice.setConversationMode(false)`,
  `useAssistant.setGreeted(false)` (`useAssistant.ts:28` — re-fires the greeting) /
  `setOpen(true)`.
- **The greeting re-fires** when `open` is true and `greetedThisSession` is false
  (`useGreeting.ts:39`) — so `setGreeted(false)` (with the panel open) replays the arc from
  the top, re-arming the offer against the freshly re-seeded Marcus.
- **A navbar "Reset demo" already ships** (`GlobalNavbar.tsx:332`) → `reset()` +
  `window.location.reload()` (a hard, pristine reset; user re-clicks the sparkle). 4D adds a
  **smooth, no-reload, in-session replay** and leaves the navbar item untouched.
- **No loop-closing beat exists.** Proactive Otto messages use the greeting pattern
  (`setMessages([...])`); one-way spoken beats use `voiceEngine.speak(text)` with **no**
  conversation-mode / mic re-arm (matching recap/inbound/BOV).
- **The BOV send** (`BovCard.send()`, 4C) is the arc's terminal action — the natural place to
  mark the arc complete.

---

## 2. Decisions (autonomous, per delegation)

1. **Reset via the existing whole-store `reset()`**, not surgical deletion — it re-seeds
   Marcus + wipes every created record in one tested call.
2. **No-reload in-session replay:** a `resetHeroDemo()` director composes `reset()` + all AI
   clears/cancels + `setGreeted(false)` + `setOpen(true)`, so the greeting re-fires
   immediately — a smooth "run it again" with no page-reload flash. The navbar "Reset demo"
   (reload) stays as the hard-reset escape hatch (untouched).
3. **Loop-closing completion beat:** when the BOV is sent, Otto posts a completion message +
   a **"Run it again"** control (→ `resetHeroDemo`). This is both PRD §3.1's loop-closing
   reminder and the replay trigger, unified. Spoken one-way (no mic re-arm).
4. **The "Run it again" handler also clears the chat** (`setMessages([])`) so the replay
   starts on a pristine transcript (the handler lives in the sidebar, which owns
   `setMessages`).

### Non-goals
- Re-implementing the arc sequencing (already distributed; YAGNI). Touching the navbar
  "Reset demo". Surgical per-record deletion. A separate mid-arc "restart" control (the
  navbar reset covers a botched take).

---

## 3. Architecture

```
src/components/call/heroDemo.ts (NEW)
  useHeroDemo   # Zustand: arcComplete: boolean; markArcComplete(); clearComplete()
  resetHeroDemo(): Promise<void>   # the in-session replay composition (§4)
  arcCompleteText(): string        # Otto's loop-closing line (pure)

src/components/call/BovCard.tsx   ~ send() also useHeroDemo.getState().markArcComplete()
src/components/call/HeroDemoCard.tsx (NEW)  # completion beat: message + "Run it again" / "Done"
src/components/ai/AssistantSidebar.tsx
  ~ render <HeroDemoCard onRunAgain={...} /> ; one-way spoken arcCompleteText effect;
    onRunAgain = () => { setMessages([]); void resetHeroDemo(); }
```

Reuses every existing clear/cancel; the only new state is `useHeroDemo.arcComplete`.

### 3.1 `useHeroDemo`

```ts
interface HeroDemoState {
  arcComplete: boolean;
  markArcComplete: () => void;   // set true (BOV sent)
  clearComplete: () => void;     // set false (reset / dismiss)
}
```

## 4. `resetHeroDemo()` — the in-session replay

Ordered so cancels stop in-flight work, data re-seeds, stores clear, then the greeting
re-fires against fresh data:

```ts
export async function resetHeroDemo(): Promise<void> {
  // 1. stop anything in flight (hangUp also cancels voice + resets the call store)
  heroInbound.cancel();
  callFlow.hangUp();
  voiceEngine.cancel();
  // 2. clean data (re-seeds Marcus + wipes created records; async, rewrites the snapshot)
  await useDataStore.getState().reset();
  // 3. clear the AI stores
  useHeroOffer.getState().clearOffer();
  useInboundEmail.getState().clearInbound();
  useBovDraft.getState().clear();
  useCallStore.getState().reset();
  useHeroDemo.getState().clearComplete();
  useVoice.getState().setConversationMode(false);
  // 4. re-arm the greeting and ensure the panel is open → the arc replays from the top
  useAssistant.getState().setGreeted(false);
  useAssistant.getState().setOpen(true);
}
```

`arcCompleteText()`: *"That's the full loop — from an overnight signal on Marcus to a sent
BOV, all captured on one record. Want me to run it again?"*

## 5. The completion beat

- **Mark complete:** `BovCard.send()` (4C) adds `useHeroDemo.getState().markArcComplete()`
  after filing the doc + activity + `clear()`.
- **Render:** `HeroDemoCard` (reads `useHeroDemo.arcComplete`) shows the `arcCompleteText`
  message + a **"Run it again"** primary button and a **"Done"** ghost button. `onRunAgain`
  is passed by the sidebar: `() => { setMessages([]); void resetHeroDemo(); }`. **Done** →
  `clearComplete()`.
- **Speak:** the sidebar adds a one-way spoken-summary effect (mirrors the BOV/inbound
  effects): when `arcComplete` flips true, `voiceEngine.speak(arcCompleteText())` once, only
  if `voiceEnabled`, **no** conversation-mode / mic re-arm.

## 6. Degradation / testing / gates

- **Keyless / voice-off:** the beat renders; the spoken line is skipped when voice is off;
  reset/replay is fully deterministic (store operations only). Nothing hard-fails.
- **Vitest:** `useHeroDemo` (markArcComplete / clearComplete); `arcCompleteText` (mentions
  the loop + offers a rerun); `resetHeroDemo` (integration, with `fake-indexeddb/auto`):
  seed hero state into `useHeroOffer`/`useInboundEmail`/`useBovDraft`/`useCallStore` +
  `setGreeted(true)` + `markArcComplete()`, call `await resetHeroDemo()`, then assert all
  those stores are cleared, `greetedThisSession` is false, `arcComplete` is false, and
  `useDataStore` is re-seeded (a `heroKey==='marcus'` contact exists again). `HeroDemoCard` /
  the sidebar wiring → manual smoke.
- **Gates:** `bun --bun run test` green AND `bun --bun x tsc --noEmit` 0. FontAwesome
  pro-regular, never fixedWidth; Blueprint `Button` + Bootstrap; additive-only to
  `BovCard`/`AssistantSidebar`; no unsolicited redesigns; one-way spoken beat.

## 7. Acceptance criteria (4D slice)

- [ ] When the BOV is sent, Otto posts a loop-closing completion beat + "Run it again" and
      speaks it once (no mic re-arm).
- [ ] "Run it again" clears the chat, re-seeds a clean dataset (Marcus back to signal/no-deal,
      the created deal/tasks/docs/activities gone), clears all AI stores, and re-fires the
      greeting with the call offer re-armed — no page reload.
- [ ] "Done" dismisses the beat without resetting.
- [ ] Everything runs key-less; the navbar "Reset demo" (reload) is unchanged.
- [ ] `bun --bun run test` green; `bun --bun x tsc --noEmit` 0.

## 8. Downstream — Phase 4 complete

With 4D, the hero arc is end-to-end and repeatable: overnight signal → greeting → call →
recap hero-extensions → self-arriving email → underwrite + occupancy flag + BOV → send →
Activity timeline → loop-closing replay. Remaining program items are the **manual browser
smoke tests** (4A–4D, real keys) the user runs.
