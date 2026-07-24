# AI Phase 4D — The Director (reset / replay + loop-closing beat) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** When the BOV is sent, Otto closes the loop with a completion beat + "Run it again"; the replay re-seeds a clean dataset, clears all AI stores, re-fires the greeting, and clears the chat — no page reload.

**Architecture:** A `heroDemo` module (`useHeroDemo` store + `resetHeroDemo()` composing the existing store clears/cancels + `useDataStore.reset()` + `setGreeted(false)` + `setOpen(true)`; a pure `arcCompleteText()`). `BovCard.send()` marks the arc complete; a `HeroDemoCard` renders the beat in the sidebar, spoken one-way; "Run it again" clears the chat + calls `resetHeroDemo()`.

**Tech Stack:** React 19 · TypeScript · Zustand · Vitest · Blueprint + Bootstrap · FontAwesome Pro.

**Design spec:** `docs/superpowers/specs/2026-07-24-ai-phase-4d-director-reset-replay-design.md`

## Global Constraints

- Gates: `bun --bun run test` green AND `bun --bun x tsc --noEmit` 0. `vite build` does NOT type-check. Ignore biome + the pre-existing `ReferenceError: module is not defined` Vitest stderr line.
- No Playwright. Assistant = **Otto**. FontAwesome `pro-regular`, never `fixedWidth`. Blueprint `Button` + Bootstrap; additive-only to `BovCard`/`AssistantSidebar`; no unsolicited redesigns. One-way spoken beat (no conversation mode / mic re-arm).
- Commit after every task. Branch `joel/ai-tools` — no merge/push/PR.

## Verified signatures (consume exactly)

- `useDataStore.getState().reset(): Promise<void>` (`src/data/dataStore.ts:98`, re-seeds + rewrites snapshot).
- `useCallStore.getState().reset()` (`useCallStore.ts`); `useHeroOffer.getState().clearOffer()` (`src/ai/heroOffer.ts`); `useInboundEmail.getState().clearInbound()` (`src/components/call/useInboundEmail.ts`); `useBovDraft.getState().clear()` (`src/components/call/useBovDraft.ts`).
- `heroInbound.cancel()` (`src/components/call/heroInbound.ts`); `callFlow.hangUp()` (`src/components/call/callFlow.ts` — safe when idle; also cancels voice + resets the call store); `voiceEngine.cancel()` (`src/ai/voice/voiceEngine.ts`).
- `useVoice.getState().setConversationMode(false)` (`src/ai/voice/useVoice.ts`); `useAssistant.getState().setGreeted(false)` / `.setOpen(true)` (`src/ai/useAssistant.ts`).
- `BovCard.send()` (`src/components/call/BovCard.tsx`, 4C) — the edit point to mark complete.
- Sidebar `setMessages` from `useChat`; the one-way spoken-effect pattern (mirror the BOV effect added in 4C).

## File Structure

- `src/components/call/heroDemo.ts` — **Create**: `useHeroDemo`, `resetHeroDemo`, `arcCompleteText`.
- `src/components/call/HeroDemoCard.tsx` — **Create**.
- `src/components/call/BovCard.tsx` — **Modify**: `send()` marks arc complete.
- `src/components/ai/AssistantSidebar.tsx` — **Modify**: render `HeroDemoCard` + one-way spoken beat.

---

### Task 1: `heroDemo` module — `useHeroDemo` + `resetHeroDemo` + `arcCompleteText`

**Files:** Create `src/components/call/heroDemo.ts`; Test `src/components/call/heroDemo.test.ts`

**Interfaces:** Produces — `useHeroDemo` (Zustand: `arcComplete: boolean`, `markArcComplete()`, `clearComplete()`); `resetHeroDemo(): Promise<void>`; `arcCompleteText(): string`.

- [ ] **Step 1: Write the failing test** — `src/components/call/heroDemo.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "#/data/dataStore";
import { useHeroOffer } from "#/ai/heroOffer";
import { useInboundEmail } from "#/components/call/useInboundEmail";
import { useBovDraft } from "#/components/call/useBovDraft";
import { useCallStore } from "#/components/call/useCallStore";
import { useAssistant } from "#/ai/useAssistant";
import { useHeroDemo, resetHeroDemo, arcCompleteText } from "./heroDemo";

describe("useHeroDemo", () => {
  it("marks and clears arc completion", () => {
    useHeroDemo.getState().markArcComplete();
    expect(useHeroDemo.getState().arcComplete).toBe(true);
    useHeroDemo.getState().clearComplete();
    expect(useHeroDemo.getState().arcComplete).toBe(false);
  });
});

describe("arcCompleteText", () => {
  it("closes the loop and offers a rerun", () => {
    const t = arcCompleteText().toLowerCase();
    expect(t).toContain("loop");
    expect(t).toContain("again");
  });
});

describe("resetHeroDemo", () => {
  beforeEach(() => {
    // seed some hero state to prove it all gets cleared
    useHeroOffer.getState().setOffer({ kind: "call", contactId: "m" });
    useInboundEmail.getState().setInbound({
      dealId: "d", from: "Marcus", subject: "s", body: "b", tone: "interested",
      attachments: [], canUnderwrite: true,
    });
    useBovDraft.setState({ armedDealId: "d", draft: null } as never);
    useCallStore.setState({ heroActions: { dealId: "d" } } as never);
    useAssistant.getState().setGreeted(true);
    useHeroDemo.getState().markArcComplete();
  });

  it("re-seeds a clean dataset, clears all hero stores, and re-arms the greeting", async () => {
    await resetHeroDemo();
    expect(useHeroOffer.getState().pendingOffer).toBeNull();
    expect(useInboundEmail.getState().inbound).toBeNull();
    expect(useBovDraft.getState().armedDealId).toBeNull();
    expect(useCallStore.getState().heroActions).toBeNull();
    expect(useHeroDemo.getState().arcComplete).toBe(false);
    expect(useAssistant.getState().greetedThisSession).toBe(false);
    // re-seeded: Marcus exists again with a signal
    const marcus = [...useDataStore.getState().contacts.values()].find((c) => c.heroKey === "marcus");
    expect(marcus?.signal).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run** `bun --bun run test heroDemo` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/components/call/heroDemo.ts`:

```ts
import { create } from "zustand";
import { useDataStore } from "#/data/dataStore";
import { useHeroOffer } from "#/ai/heroOffer";
import { useInboundEmail } from "#/components/call/useInboundEmail";
import { useBovDraft } from "#/components/call/useBovDraft";
import { useCallStore } from "#/components/call/useCallStore";
import { useAssistant } from "#/ai/useAssistant";
import { useVoice } from "#/ai/voice/useVoice";
import { voiceEngine } from "#/ai/voice/voiceEngine";
import { callFlow } from "#/components/call/callFlow";
import { heroInbound } from "#/components/call/heroInbound";

interface HeroDemoState {
  arcComplete: boolean;
  markArcComplete: () => void;
  clearComplete: () => void;
}

export const useHeroDemo = create<HeroDemoState>((set) => ({
  arcComplete: false,
  markArcComplete: () => set({ arcComplete: true }),
  clearComplete: () => set({ arcComplete: false }),
}));

/** Otto's loop-closing line spoken/shown when the arc completes (PRD §3.1). */
export function arcCompleteText(): string {
  return (
    "That's the full loop — from an overnight signal on Marcus to a sent BOV, all captured " +
    "on one record. Want me to run it again?"
  );
}

/** Smooth in-session replay: stop in-flight work, re-seed a clean dataset, clear every hero
 * store, and re-fire the greeting from the top — no page reload. */
export async function resetHeroDemo(): Promise<void> {
  heroInbound.cancel();
  callFlow.hangUp(); // also cancels voice + resets the call store
  voiceEngine.cancel();
  await useDataStore.getState().reset();
  useHeroOffer.getState().clearOffer();
  useInboundEmail.getState().clearInbound();
  useBovDraft.getState().clear();
  useCallStore.getState().reset();
  useHeroDemo.getState().clearComplete();
  useVoice.getState().setConversationMode(false);
  useAssistant.getState().setGreeted(false);
  useAssistant.getState().setOpen(true);
}
```

- [ ] **Step 4: Run** `bun --bun run test heroDemo` → PASS; full suite → PASS; `bun --bun x tsc --noEmit` → 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/call/heroDemo.ts src/components/call/heroDemo.test.ts
git commit -m "feat(call): heroDemo director — useHeroDemo + resetHeroDemo replay"
```

---

### Task 2: mark arc complete on BOV send + `HeroDemoCard` + sidebar beat

**Files:** Create `src/components/call/HeroDemoCard.tsx`; Modify `src/components/call/BovCard.tsx`, `src/components/ai/AssistantSidebar.tsx`
(No unit test — UI wiring; the store/reset/text logic is tested in Task 1.)

**Interfaces:** Consumes — `useHeroDemo`, `resetHeroDemo`, `arcCompleteText` (Task 1); `voiceEngine`, `voiceEnabled`, `scrollRef` (existing in AssistantSidebar); `setMessages` (useChat, in AssistantSidebar).

- [ ] **Step 1: Mark complete on send** — in `src/components/call/BovCard.tsx`, import `useHeroDemo` from `#/components/call/heroDemo`; in `send()`, after the existing `addDealActivity(...)` and before/with `clear()`, add `useHeroDemo.getState().markArcComplete();`.

- [ ] **Step 2: `HeroDemoCard.tsx`**:

```tsx
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateRight } from "@fortawesome/pro-regular-svg-icons";
import { useHeroDemo, arcCompleteText } from "#/components/call/heroDemo";

/** Loop-closing completion beat shown when the hero arc finishes (BOV sent). "Run it again"
 * is wired by the sidebar (clears the chat + resetHeroDemo). */
export function HeroDemoCard({ onRunAgain }: { onRunAgain: () => void }) {
  const arcComplete = useHeroDemo((s) => s.arcComplete);
  const clearComplete = useHeroDemo((s) => s.clearComplete);
  if (!arcComplete) return null;
  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-3">
      <div className="d-flex align-items-center gap-2 small text-muted text-uppercase fw-semibold">
        <FontAwesomeIcon icon={faRotateRight} />
        That's the loop
      </div>
      <div>{arcCompleteText()}</div>
      <div className="d-flex gap-2">
        <Button variant="primary" size="sm" onClick={onRunAgain}>Run it again</Button>
        <Button variant="ghost" size="sm" onClick={() => clearComplete()}>Done</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Sidebar render + one-way speak** — in `src/components/ai/AssistantSidebar.tsx`:
  - Import `HeroDemoCard` from `#/components/call/HeroDemoCard`; `useHeroDemo`, `arcCompleteText` from `#/components/call/heroDemo`; `resetHeroDemo` from `#/components/call/heroDemo`.
  - Render next to `<BovCard />`: `<HeroDemoCard onRunAgain={() => { setMessages([]); void resetHeroDemo(); }} />`.
  - Add a one-way spoken-beat effect (mirror the BOV effect):

```tsx
const arcComplete = useHeroDemo((s) => s.arcComplete);
const spokenArcRef = useRef(false);
useEffect(() => {
  if (!arcComplete) { spokenArcRef.current = false; return; }
  if (spokenArcRef.current) return;
  spokenArcRef.current = true;
  requestAnimationFrame(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); });
  if (!voiceEnabled) return;
  void voiceEngine.speak(arcCompleteText()); // one-way: no re-arm
}, [arcComplete, voiceEnabled]);
```

- [ ] **Step 4: Verify** `bun --bun x tsc --noEmit` → 0; `bun --bun run test` → full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/components/call/HeroDemoCard.tsx src/components/call/BovCard.tsx src/components/ai/AssistantSidebar.tsx
git commit -m "feat(ai): loop-closing completion beat + Run-it-again replay"
```

---

## Final verification

- [ ] `bun --bun run test` — full suite green.
- [ ] `bun --bun x tsc --noEmit` — 0 errors.
- [ ] Whole-branch review (superpowers:requesting-code-review) of the 4D range.

## Manual smoke test (hand to the user — real ANTHROPIC + ELEVENLABS keys)

1. Run the arc through 4C and click **Send BOV**.
2. Otto posts a **completion beat** ("That's the full loop…") and speaks it once (no mic re-arm), with **Run it again** / **Done**.
3. **Run it again** → the chat clears, a fresh dataset loads (open Marcus / the deals — the created hero deal + tour + docs + BOV are gone; Marcus is back to signal/no-deal), and the greeting re-fires with the "Yes, call now" / "Brief me first" offer — no page reload.
4. **Done** dismisses the beat without resetting.
5. The navbar account menu → **Reset demo** still works (hard reset + reload).
6. Key-less: the beat + replay work with no ANTHROPIC key.
