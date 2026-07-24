# AI Phase 3 — Live-Call Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the live-call simulation — a global, AI-role-played phone call (dialing→ringing→connected→transcript) that speaks the owner aloud, offers varied broker lines, and ends in an "Al reports" recap that drafts follow-up tasks and can open an opportunity.

**Architecture:** Reuse the existing contact-page call machine by promoting it to one global `useCallStore` + an imperative `callFlow` controller (mirroring the Phase-2 `voiceEngine` + `useVoice` split). Two new `.server()` generators (`generateCallTurn`, `generateCallRecap`) follow the Phase-1 generator pattern. The bar renders once in `AppShell`; the agent's `start_call` tool, the contact-page button, and (later) the Phase-4 director all open a call through `callFlow.open`. The recap renders in the assistant sidebar reusing existing card infra.

**Tech Stack:** React 19 · TypeScript · TanStack Start · Zustand · Zod · `@tanstack/ai` · Blueprint React · FontAwesome Pro · Vitest.

## Global Constraints

- **Gates (must pass to finish a task):** `bun --bun run test` green, and `bun --bun x tsc --noEmit` reports **0 errors**.
- `vite build` does **not** type-check — never rely on it for types.
- **Non-gates to ignore:** biome (`bun --bun run check`), and the pre-existing `ReferenceError: module is not defined` line in Vitest stderr.
- **No Playwright** — audio / live-call behavior is verified by hand; everything else is Vitest.
- **Zod import is a default import:** `import z from "zod"` (named import resolves `z` to undefined under this repo's Vitest). This is the only zod import style in `src/`.
- **Icons:** FontAwesome **`pro-regular`** by default; **never** pass `fixedWidth` to `FontAwesomeIcon` (deprecated in this repo).
- **UI:** Blueprint React components + Bootstrap 5 utility classes (no Tailwind). No unsolicited visual redesigns of existing components.
- **Test style:** `import { describe, it, expect } from "vitest"` (no globals); Zustand stores tested via `useX.getState()` / `useX.setState()`.
- **Current-user persona:** Ethan Thompson (already the seed default; nothing to set).
- **Never re-arm the mic during/after a call** (§5.3); opening a call must `voiceEngine.cancel()` and stop hands-free capture.

---

### Task 1: Call generators (`generateCallTurn`, `generateCallRecap`)

**Files:**
- Modify: `src/ai/generate/schemas.ts` (append two schemas)
- Modify: `src/ai/generate/prompts.ts` (append two prompts)
- Modify: `src/ai/generate/fallbacks.ts` (append two fallbacks)
- Modify: `src/ai/generate/generators.ts` (append two server fns)
- Modify: `src/ai/generate/index.ts` (re-export)
- Test: `src/ai/generate/schemas.test.ts` (append), `src/ai/generate/fallbacks.test.ts` (append)

**Interfaces:**
- Produces:
  - `CallTurnSpec` / `CallTurnSpecT = { ownerReply: string; suggestions: string[]; shouldEnd: boolean }`
  - `CallRecapSpec` / `CallRecapSpecT = { sentiment: "positive"|"neutral"|"negative"; keyPoints: string[]; tasks: { title: string; due: string | null }[]; opportunity: { name: string; address: string } | null }`
  - `callTurnFallback(): CallTurnSpecT`
  - `callRecapFallback(transcript: { speaker: "you"|"them"; text: string }[], contactFirstName: string): CallRecapSpecT`
  - `generateCallTurn({ data: { candidate, property, history, brokerLine } }): Promise<CallTurnSpecT>`
  - `generateCallRecap({ data: { transcript, contact } }): Promise<CallRecapSpecT>`

- [ ] **Step 1: Write the failing schema + fallback tests**

Append to `src/ai/generate/schemas.test.ts`:

```ts
import { CallTurnSpec, CallRecapSpec } from "./schemas";

describe("call schemas", () => {
  it("accepts a valid call turn", () => {
    const r = CallTurnSpec.safeParse({
      ownerReply: "I might consider it.",
      suggestions: ["Great — can I send comps?", "When's a good time?", "No rush at all."],
      shouldEnd: false,
    });
    expect(r.success).toBe(true);
  });

  it("rejects more than 3 suggestions", () => {
    const r = CallTurnSpec.safeParse({
      ownerReply: "ok", suggestions: ["a", "b", "c", "d"], shouldEnd: false,
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid recap with a null opportunity", () => {
    const r = CallRecapSpec.safeParse({
      sentiment: "positive",
      keyPoints: ["Owner open to a valuation."],
      tasks: [{ title: "Send comps", due: "2026-07-28" }, { title: "Call back", due: null }],
      opportunity: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejects an out-of-enum sentiment", () => {
    const r = CallRecapSpec.safeParse({
      sentiment: "curious", keyPoints: [], tasks: [], opportunity: null,
    });
    expect(r.success).toBe(false);
  });
});
```

Append to `src/ai/generate/fallbacks.test.ts`:

```ts
import { callTurnFallback, callRecapFallback } from "./fallbacks";
import { CallTurnSpec, CallRecapSpec } from "./schemas";

describe("call fallbacks", () => {
  it("callTurnFallback satisfies the schema and never ends the call", () => {
    const f = callTurnFallback();
    expect(CallTurnSpec.safeParse(f).success).toBe(true);
    expect(f.shouldEnd).toBe(false);
  });

  it("callRecapFallback satisfies the schema and drafts one follow-up task", () => {
    const f = callRecapFallback(
      [{ speaker: "you", text: "hi" }, { speaker: "them", text: "hello" }],
      "Marcus",
    );
    expect(CallRecapSpec.safeParse(f).success).toBe(true);
    expect(f.tasks.length).toBeGreaterThanOrEqual(1);
    expect(f.tasks[0].title).toContain("Marcus");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test src/ai/generate/schemas.test.ts src/ai/generate/fallbacks.test.ts`
Expected: FAIL — `CallTurnSpec`/`CallRecapSpec`/`callTurnFallback`/`callRecapFallback` are not exported.

- [ ] **Step 3: Add the schemas**

Append to `src/ai/generate/schemas.ts`:

```ts
/** §3.7 live-call owner turn. */
export const CallTurnSpec = z.object({
  ownerReply: z.string(),
  suggestions: z.array(z.string()).max(3),
  shouldEnd: z.boolean(),
});
export type CallTurnSpecT = z.infer<typeof CallTurnSpec>;

/** §3.4 hang-up recap. */
export const CallRecapSpec = z.object({
  sentiment: z.enum(["positive", "neutral", "negative"]),
  keyPoints: z.array(z.string()),
  tasks: z.array(z.object({ title: z.string(), due: z.string().nullable() })),
  opportunity: z.object({ name: z.string(), address: z.string() }).nullable(),
});
export type CallRecapSpecT = z.infer<typeof CallRecapSpec>;
```

- [ ] **Step 4: Add the fallbacks**

Append to `src/ai/generate/fallbacks.ts` (add the imported types to the existing top import from `./schemas`):

```ts
import type { CallTurnSpecT, CallRecapSpecT } from "./schemas";

/** §3.7 — minimal owner turn when the model is unavailable: the owner nudges
 * the broker to keep talking and never ends the call on its own. */
export function callTurnFallback(): CallTurnSpecT {
  return { ownerReply: "Mhm, go on.", suggestions: [], shouldEnd: false };
}

/** §3.4 — deterministic recap when the model is unavailable: a neutral summary
 * derived from the transcript plus one generic follow-up task on the contact. */
export function callRecapFallback(
  transcript: { speaker: "you" | "them"; text: string }[],
  contactFirstName: string,
): CallRecapSpecT {
  const spoke = transcript.length > 0;
  return {
    sentiment: "neutral",
    keyPoints: spoke
      ? [`You spoke with ${contactFirstName}; review the transcript for details.`]
      : [`Call with ${contactFirstName} ended before much was said.`],
    tasks: [{ title: `Follow up with ${contactFirstName}`, due: null }],
    opportunity: null,
  };
}
```

- [ ] **Step 5: Add the prompts**

Append to `src/ai/generate/prompts.ts`:

```ts
export const CALL_TURN_PROMPT = `You are role-playing a commercial real-estate property OWNER on a live phone call with a broker. You are given the owner's profile (name, role, entity, a broker note), the property (or null), the conversation so far, and the broker's latest line.

Reply as the OWNER, in character, conversationally — not formally. One line, 1-2 short sentences. Reference one specific thing from the broker's line. Let the broker note shape your tone (decision-maker, retiring, family member, guarded, warm, busy).

Also return exactly 2-3 SUGGESTED NEXT LINES for the broker, tactically VARIED (e.g. one accepts/advances, one redirects, one closes for time). Each under 20 words, all fitting the same thread.

Set shouldEnd to true ONLY when you (the owner) are clearly wrapping up the call.

Return ONLY the structured object.`;

export const CALL_RECAP_PROMPT = `You are Al, a sharp CRE assistant, summarizing a broker's call that just ended. You are given the full transcript and the contact.

Produce: an overall sentiment (positive | neutral | negative); 1-3 concrete key points drawn ONLY from the transcript; 1-3 follow-up TASKS as concrete next steps (title + optional natural-language due like "Thursday" or "in 3 days", else null); and an opportunity ONLY if the call clearly implies a new deal to open (its name and address), otherwise null.

Never invent facts not in the transcript. Return ONLY the structured object.`;
```

- [ ] **Step 6: Add the generators**

Append to `src/ai/generate/generators.ts` (extend the existing imports from `./schemas`, `./prompts`, `./fallbacks` with the new names):

```ts
// add to the ./schemas import: CallTurnSpec, type CallTurnSpecT, CallRecapSpec, type CallRecapSpecT
// add to the ./prompts import: CALL_TURN_PROMPT, CALL_RECAP_PROMPT
// add to the ./fallbacks import: callTurnFallback, callRecapFallback

/** §3.7 — live-call owner turn. Fast model (short, latency-sensitive turn). */
export const generateCallTurn = createServerFn({ method: "POST" })
  .validator(
    (d: {
      candidate: { name: string; role: string; entity: string; note: string; phone: string };
      property: unknown | null;
      history: Array<{ speaker: "you" | "them"; text: string }>;
      brokerLine: string;
    }) => d,
  )
  .handler(({ data }): Promise<CallTurnSpecT> =>
    runGenerator({
      system: CALL_TURN_PROMPT,
      user: JSON.stringify({
        candidate: data.candidate,
        property: data.property ?? null,
        history: data.history,
        brokerLine: data.brokerLine,
      }),
      schema: CallTurnSpec,
      fallback: () => callTurnFallback(),
    }),
  );

/** §3.4 — hang-up recap. REASONING model (synthesis over the transcript). */
export const generateCallRecap = createServerFn({ method: "POST" })
  .validator(
    (d: {
      transcript: Array<{ speaker: "you" | "them"; text: string }>;
      contact: { name: string; firstName: string; entity: string };
    }) => d,
  )
  .handler(({ data }): Promise<CallRecapSpecT> =>
    runGenerator({
      model: AI_MODEL_REASONING,
      system: CALL_RECAP_PROMPT,
      user: JSON.stringify({ transcript: data.transcript, contact: data.contact }),
      schema: CallRecapSpec,
      fallback: () => callRecapFallback(data.transcript, data.contact.firstName),
    }),
  );
```

- [ ] **Step 7: Re-export from the index**

Append to `src/ai/generate/index.ts` inside the export block:

```ts
  generateCallTurn,
  generateCallRecap,
  callTurnFallback,
  callRecapFallback,
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `bun --bun run test src/ai/generate/schemas.test.ts src/ai/generate/fallbacks.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck**

Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add src/ai/generate
git commit -m "feat(ai): call-turn and call-recap generators (Phase 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Global call store + ring-tone helpers

**Files:**
- Create: `src/components/call/ringtone.ts`
- Create: `src/components/call/useCallStore.ts`
- Test: `src/components/call/useCallStore.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `ringtone.ts`: `playOneRing(): void`, `playAnsweredCue(): void` (moved verbatim from `useLiveCall.ts`).
  - `formatDuration(secs: number): string` (moved from `useLiveCall.ts`, re-exported here).
  - `useCallStore` with state `{ phase: "idle"|"calling"|"ringing"|"connected"; target: CallTarget | null; countdown: number; elapsedSecs: number; muted: boolean; transcript: TranscriptLine[]; suggestions: string[]; awaitingOwner: boolean; shouldEnd: boolean; recap: CallRecapSpecT | null }` and actions `startTarget(t)`, `setPhase(p)`, `setCountdown(n)`, `setElapsed(n)`, `toggleMute()`, `appendLine(speaker, text)`, `setSuggestions(s)`, `setAwaitingOwner(b)`, `setShouldEnd(b)`, `setRecap(r)`, `clearRecap()`, `reset()`.
  - Types `CallTarget = { contactId: string; name: string; entity: string; phone: string; initials: string; firstName: string; role: string; note: string }` and `TranscriptLine = { id: string; speaker: "you"|"them"; text: string }`.

- [ ] **Step 1: Write the failing store test**

Create `src/components/call/useCallStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useCallStore } from "./useCallStore";

const TARGET = {
  contactId: "c1", name: "Marcus Pinckney", entity: "Pinckney Holdings",
  phone: "843-555-0101", initials: "MP", firstName: "Marcus", role: "owner", note: "Retiring.",
};

describe("useCallStore", () => {
  beforeEach(() => useCallStore.getState().reset());

  it("starts idle with no target", () => {
    const s = useCallStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.target).toBeNull();
  });

  it("startTarget begins a fresh call in calling phase", () => {
    useCallStore.getState().appendLine("you", "stale line");
    useCallStore.getState().startTarget(TARGET);
    const s = useCallStore.getState();
    expect(s.phase).toBe("calling");
    expect(s.countdown).toBe(5);
    expect(s.target?.name).toBe("Marcus Pinckney");
    expect(s.transcript).toHaveLength(0);
    expect(s.recap).toBeNull();
  });

  it("appendLine adds unique transcript lines", () => {
    useCallStore.getState().appendLine("you", "Hi Marcus");
    useCallStore.getState().appendLine("them", "Who's this?");
    const t = useCallStore.getState().transcript;
    expect(t.map((l) => l.speaker)).toEqual(["you", "them"]);
    expect(t[0].id).not.toBe(t[1].id);
  });

  it("toggleMute flips muted", () => {
    expect(useCallStore.getState().muted).toBe(false);
    useCallStore.getState().toggleMute();
    expect(useCallStore.getState().muted).toBe(true);
  });

  it("reset clears everything back to idle", () => {
    useCallStore.getState().startTarget(TARGET);
    useCallStore.getState().appendLine("them", "hello");
    useCallStore.getState().reset();
    const s = useCallStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.target).toBeNull();
    expect(s.transcript).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test src/components/call/useCallStore.test.ts`
Expected: FAIL — module `./useCallStore` not found.

- [ ] **Step 3: Create the ring-tone helpers**

Create `src/components/call/ringtone.ts` by moving the Web-Audio helpers out of `useLiveCall.ts` verbatim:

```ts
// Synthesized call tones (Web Audio, no assets), moved from the contact-page
// useLiveCall hook so the global call flow can reuse them.
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!_ctx) _ctx = new Ctor();
  return _ctx;
}

/** A classic North-American two-tone ring (440 + 480 Hz), one pulse. */
export function playOneRing() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const dur = 1.4;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.04);
  gain.gain.setValueAtTime(0.08, now + dur - 0.05);
  gain.gain.linearRampToValueAtTime(0, now + dur);
  [440, 480].forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + dur);
  });
}

/** A short ascending note played when the call connects. */
export function playAnsweredCue() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.06, now + 0.03);
  gain.gain.linearRampToValueAtTime(0, now + 0.35);
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, now);
  osc.frequency.linearRampToValueAtTime(880, now + 0.25);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.4);
}

/** `123` → `2:03`. */
export function formatDuration(secs: number): string {
  const mm = Math.floor(secs / 60);
  const ss = (secs % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
```

- [ ] **Step 4: Create the store**

Create `src/components/call/useCallStore.ts`:

```ts
import { create } from "zustand";
import type { CallRecapSpecT } from "#/ai/generate/schemas";

export type CallPhase = "idle" | "calling" | "ringing" | "connected";

/** Snapshot of the contact taken at call start so the call never depends on the
 * live record mid-call. `firstName` feeds ownerVoiceFor; role/note/entity feed
 * the call-turn candidate. */
export interface CallTarget {
  contactId: string;
  name: string;
  entity: string;
  phone: string;
  initials: string;
  firstName: string;
  role: string;
  note: string;
}

export interface TranscriptLine {
  id: string;
  speaker: "you" | "them";
  text: string;
}

interface CallState {
  phase: CallPhase;
  target: CallTarget | null;
  countdown: number;
  elapsedSecs: number;
  muted: boolean;
  transcript: TranscriptLine[];
  suggestions: string[];
  awaitingOwner: boolean;
  shouldEnd: boolean;
  recap: CallRecapSpecT | null;
  startTarget: (t: CallTarget) => void;
  setPhase: (p: CallPhase) => void;
  setCountdown: (n: number) => void;
  setElapsed: (n: number) => void;
  toggleMute: () => void;
  appendLine: (speaker: "you" | "them", text: string) => void;
  setSuggestions: (s: string[]) => void;
  setAwaitingOwner: (b: boolean) => void;
  setShouldEnd: (b: boolean) => void;
  setRecap: (r: CallRecapSpecT | null) => void;
  clearRecap: () => void;
  reset: () => void;
}

let _lineSeq = 0;

const IDLE = {
  phase: "idle" as CallPhase,
  target: null,
  countdown: 5,
  elapsedSecs: 0,
  muted: false,
  transcript: [] as TranscriptLine[],
  suggestions: [] as string[],
  awaitingOwner: false,
  shouldEnd: false,
  recap: null as CallRecapSpecT | null,
};

export const useCallStore = create<CallState>((set) => ({
  ...IDLE,
  startTarget: (target) =>
    set({
      ...IDLE,
      target,
      phase: "calling",
      countdown: 5,
    }),
  setPhase: (phase) => set({ phase }),
  setCountdown: (countdown) => set({ countdown }),
  setElapsed: (elapsedSecs) => set({ elapsedSecs }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  appendLine: (speaker, text) =>
    set((s) => ({
      transcript: [...s.transcript, { id: `line-${_lineSeq++}`, speaker, text }],
    })),
  setSuggestions: (suggestions) => set({ suggestions }),
  setAwaitingOwner: (awaitingOwner) => set({ awaitingOwner }),
  setShouldEnd: (shouldEnd) => set({ shouldEnd }),
  setRecap: (recap) => set({ recap }),
  clearRecap: () => set({ recap: null }),
  reset: () => set({ ...IDLE }),
}));
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun --bun run test src/components/call/useCallStore.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/call/ringtone.ts src/components/call/useCallStore.ts src/components/call/useCallStore.test.ts
git commit -m "feat(call): global call store + ring-tone helpers (Phase 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `callFlow` imperative controller

**Files:**
- Create: `src/components/call/callFlow.ts`
- Test: `src/components/call/callFlow.test.ts`

**Interfaces:**
- Consumes: `useCallStore` (Task 2), `playOneRing`/`playAnsweredCue` (Task 2), `generateCallTurn`/`generateCallRecap` (Task 1), `voiceEngine` + `ownerVoiceFor` (Phase 2), `addNote` (`src/data/actions`), `useAssistant` (`src/ai/useAssistant`), `contactFullName`/`contactInitials` (`src/components/contacts/contactDisplay`).
- Produces:
  - `registerStopForCall(fn: (() => void) | null): void` — the sidebar registers its `useHandsFree().stopForCall` here.
  - `callFlow.open(contact: Contact, phone?: string): void`
  - `callFlow.submitLine(text: string): void`
  - `callFlow.toggleMute(): void`
  - `callFlow.hangUp(): void` — abandon a not-yet-connected call (nothing logged).
  - `callFlow.endCall(): void` — end a connected call → recap.

- [ ] **Step 1: Write the failing controller test**

Create `src/components/call/callFlow.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const cancel = vi.fn();
const speak = vi.fn(() => Promise.resolve());
vi.mock("#/ai/voice/voiceEngine", () => ({ voiceEngine: { cancel, speak } }));
vi.mock("#/ai/voice/ownerVoice", () => ({ ownerVoiceFor: () => "voice-x" }));
vi.mock("#/data/actions", () => ({ addNote: vi.fn() }));
vi.mock("#/ai/generate", () => ({
  generateCallTurn: vi.fn(async () => ({
    ownerReply: "Who's this?", suggestions: ["It's Ethan.", "Got a sec?", "Bad time?"], shouldEnd: false,
  })),
  generateCallRecap: vi.fn(async () => ({
    sentiment: "positive", keyPoints: ["Open to a valuation."],
    tasks: [{ title: "Send comps", due: null }], opportunity: null,
  })),
}));

import { callFlow, registerStopForCall } from "./callFlow";
import { useCallStore } from "./useCallStore";
import { generateCallTurn } from "#/ai/generate";

const CONTACT = {
  id: "c1", firstName: "Marcus", lastName: "Pinckney", company: "Pinckney Holdings",
  phone: "843-555-0101", role: "owner", notes: "Retiring.",
} as never;

describe("callFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useCallStore.getState().reset();
    registerStopForCall(null);
  });

  it("open() silences Al, kills the mic, and starts the countdown at 5", () => {
    const stop = vi.fn();
    registerStopForCall(stop);
    callFlow.open(CONTACT);
    expect(cancel).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
    const s = useCallStore.getState();
    expect(s.phase).toBe("calling");
    expect(s.countdown).toBe(5);
    expect(s.target?.name).toBe("Marcus Pinckney");
  });

  it("advances calling → ringing → connected and seeds the opening owner line", async () => {
    callFlow.open(CONTACT);
    await vi.advanceTimersByTimeAsync(900 * 5 + 3400 + 10); // countdown + ring → connect
    expect(useCallStore.getState().phase).toBe("connected");
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    expect(generateCallTurn).toHaveBeenCalled();
    expect(useCallStore.getState().transcript.some((l) => l.speaker === "them")).toBe(true);
  });

  it("submitLine is a no-op when not connected", () => {
    callFlow.open(CONTACT); // still 'calling'
    callFlow.submitLine("hello?");
    expect(useCallStore.getState().transcript).toHaveLength(0);
  });

  it("hangUp resets the store and cancels audio", () => {
    callFlow.open(CONTACT);
    callFlow.hangUp();
    expect(cancel).toHaveBeenCalled();
    expect(useCallStore.getState().phase).toBe("idle");
    expect(useCallStore.getState().target).toBeNull();
  });

  it("endCall on a connected call sets a recap and leaves idle", async () => {
    callFlow.open(CONTACT);
    await vi.advanceTimersByTimeAsync(900 * 5 + 3400 + 10);
    useCallStore.getState().appendLine("you", "Hi Marcus");
    await callFlow.endCall();
    expect(useCallStore.getState().phase).toBe("idle");
    expect(useCallStore.getState().recap?.sentiment).toBe("positive");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test src/components/call/callFlow.test.ts`
Expected: FAIL — module `./callFlow` not found.

- [ ] **Step 3: Implement the controller**

Create `src/components/call/callFlow.ts`:

```ts
import type { Contact } from "#/data/types";
import { useCallStore } from "./useCallStore";
import { playOneRing, playAnsweredCue } from "./ringtone";
import { voiceEngine } from "#/ai/voice/voiceEngine";
import { ownerVoiceFor } from "#/ai/voice/ownerVoice";
import { generateCallTurn, generateCallRecap } from "#/ai/generate";
import { useAssistant } from "#/ai/useAssistant";
import { addNote } from "#/data/actions";
import { contactFullName, contactInitials } from "#/components/contacts/contactDisplay";

/**
 * Imperative live-call controller (Phase-3 design §3/§4). Owns the phase timers,
 * ring tones, owner-turn fetches, and owner-voice playback — the messy work that
 * mustn't live in React, so start_call/the Phase-4 director can drive a call from
 * anywhere. Reactive state lives in useCallStore; audio in voiceEngine.
 */

// The sidebar registers its hands-free stopForCall here so a call can hard-stop
// the mic even though callFlow lives outside React (§7). No-op if unregistered
// (sidebar closed → no live mic anyway).
let _stopForCall: (() => void) | null = null;
export function registerStopForCall(fn: (() => void) | null) {
  _stopForCall = fn;
}

// A monotonic session id: every open/hangUp/endCall bumps it, so an in-flight
// owner-turn or recap fetch that resolves after the call moved on is dropped.
let session = 0;
let timers: ReturnType<typeof setTimeout>[] = [];
let ticker: ReturnType<typeof setInterval> | null = null;
let ringLoop: ReturnType<typeof setInterval> | null = null;
let connectedAt = 0;

function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms));
}
function stopRing() {
  if (ringLoop) {
    clearInterval(ringLoop);
    ringLoop = null;
  }
}
function clearAll() {
  timers.forEach(clearTimeout);
  timers = [];
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
  stopRing();
}

async function runOwnerTurn(brokerLine: string) {
  const mySession = session;
  const st = useCallStore.getState();
  const target = st.target;
  if (!target) return;
  st.setAwaitingOwner(true);
  const history = st.transcript.map((l) => ({ speaker: l.speaker, text: l.text }));
  let res;
  try {
    res = await generateCallTurn({
      data: {
        candidate: {
          name: target.name,
          role: target.role,
          entity: target.entity,
          note: target.note,
          phone: target.phone,
        },
        property: null,
        history,
        brokerLine,
      },
    });
  } catch {
    res = { ownerReply: "Mhm, go on.", suggestions: [], shouldEnd: false };
  }
  // Superseded (hung up / new call) or no longer connected → drop silently.
  if (mySession !== session || useCallStore.getState().phase !== "connected") return;
  const store = useCallStore.getState();
  store.appendLine("them", res.ownerReply);
  store.setSuggestions(res.suggestions);
  store.setShouldEnd(res.shouldEnd);
  store.setAwaitingOwner(false);
  void voiceEngine.speak(res.ownerReply, {
    voiceId: ownerVoiceFor({ id: target.contactId, firstName: target.firstName }),
  });
}

function toConnected() {
  stopRing();
  playAnsweredCue();
  connectedAt = Date.now();
  useCallStore.setState({ phase: "connected", elapsedSecs: 0 });
  ticker = setInterval(() => {
    useCallStore.getState().setElapsed(Math.floor((Date.now() - connectedAt) / 1000));
  }, 500);
  void runOwnerTurn(""); // the owner answers first
}

function startRing() {
  stopRing();
  if (!useCallStore.getState().muted) playOneRing();
  ringLoop = setInterval(() => {
    if (!useCallStore.getState().muted) playOneRing();
  }, 3000);
}

function toRinging() {
  useCallStore.getState().setPhase("ringing");
  startRing();
  later(toConnected, 3400);
}

export const callFlow = {
  open(contact: Contact, phone?: string) {
    clearAll();
    session += 1;
    voiceEngine.cancel(); // Al goes quiet
    _stopForCall?.(); // mic can't capture call audio (§5.3)
    useCallStore.getState().startTarget({
      contactId: contact.id,
      name: contactFullName(contact),
      entity: contact.company,
      phone: phone ?? contact.phone,
      initials: contactInitials(contact),
      firstName: contact.firstName,
      role: contact.role,
      note: contact.notes ?? "",
    });
    let n = 5;
    const step = () => {
      n -= 1;
      if (n >= 1) {
        useCallStore.getState().setCountdown(n);
        later(step, 900);
      } else {
        toRinging();
      }
    };
    later(step, 900);
  },

  submitLine(text: string) {
    const t = text.trim();
    if (!t) return;
    const st = useCallStore.getState();
    if (st.phase !== "connected" || st.awaitingOwner) return;
    st.appendLine("you", t);
    st.setSuggestions([]);
    st.setShouldEnd(false);
    void runOwnerTurn(t);
  },

  toggleMute() {
    useCallStore.getState().toggleMute();
  },

  hangUp() {
    clearAll();
    session += 1;
    voiceEngine.cancel();
    useCallStore.getState().reset();
  },

  async endCall() {
    const st = useCallStore.getState();
    const target = st.target;
    const transcript = st.transcript.map((l) => ({ speaker: l.speaker, text: l.text }));
    clearAll();
    session += 1; // invalidate any in-flight owner turn / audio
    voiceEngine.cancel();
    useCallStore.setState({
      phase: "idle",
      suggestions: [],
      awaitingOwner: false,
      shouldEnd: false,
    });
    if (!target) {
      useCallStore.getState().reset();
      return;
    }
    let recap;
    try {
      recap = await generateCallRecap({
        data: {
          transcript,
          contact: { name: target.name, firstName: target.firstName, entity: target.entity },
        },
      });
    } catch {
      recap = {
        sentiment: "neutral" as const,
        keyPoints: [`Call with ${target.firstName} ended.`],
        tasks: [{ title: `Follow up with ${target.firstName}`, due: null }],
        opportunity: null,
      };
    }
    // Log the call to the contact's record (persists; replaces the old LogCallModal).
    addNote(
      target.contactId,
      `Call with ${target.name} — ${recap.sentiment}. ${recap.keyPoints.join(" ")}`.trim(),
    );
    useCallStore.getState().setRecap(recap);
    useAssistant.getState().setOpen(true); // sidebar renders + speaks the recap
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test src/components/call/callFlow.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/call/callFlow.ts src/components/call/callFlow.test.ts
git commit -m "feat(call): imperative callFlow controller with owner-turn loop (Phase 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Extend `LiveCallBar` and mount it globally

**Files:**
- Create: `src/components/call/LiveCallBar.tsx` (the extended bar; supersedes `src/components/contacts/LiveCallBar.tsx`)
- Modify: `src/components/layout/AppShell.tsx` (mount `<LiveCallBar/>` once)
- Modify: `src/main.scss` (extend the existing `.contact-call-bar` styles for the connected transcript/chips — keep the existing class names)

**Interfaces:**
- Consumes: `useCallStore` (Task 2), `callFlow` (Task 3), `formatDuration` (Task 2).
- Produces: a globally-mounted `<LiveCallBar/>` that renders nothing when `phase === "idle"`, the countdown/ringing bar for `calling`/`ringing`, and the expanded connected panel (status + timer + transcript + suggestion chips + type-a-line input + End/Mute) for `connected`.

- [ ] **Step 1: Create the extended, store-driven bar**

Create `src/components/call/LiveCallBar.tsx`:

```tsx
import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faMicrophoneSlash,
  faPhoneSlash,
  faPaperPlaneTop,
} from "@fortawesome/pro-regular-svg-icons";
import { useCallStore } from "#/components/call/useCallStore";
import { formatDuration } from "#/components/call/ringtone";
import { callFlow } from "#/components/call/callFlow";

/**
 * The global live-call bar (Phase-3 design §3). Renders from useCallStore and
 * drives callFlow. Docks full-width above the app content; on connect it expands
 * to carry the transcript, the owner's suggested broker lines, and a type-a-line
 * input. Broker input during a call is chips/typing only — never voice (§5.3).
 */
export function LiveCallBar() {
  const phase = useCallStore((s) => s.phase);
  const target = useCallStore((s) => s.target);
  const countdown = useCallStore((s) => s.countdown);
  const elapsedSecs = useCallStore((s) => s.elapsedSecs);
  const muted = useCallStore((s) => s.muted);
  const transcript = useCallStore((s) => s.transcript);
  const suggestions = useCallStore((s) => s.suggestions);
  const awaitingOwner = useCallStore((s) => s.awaitingOwner);
  const shouldEnd = useCallStore((s) => s.shouldEnd);
  const [draft, setDraft] = useState("");

  if (phase === "idle" || !target) return null;

  if (phase === "calling") {
    return (
      <div className="contact-call-bar contact-call-bar--calling">
        <span className="contact-call-bar__avatar contact-call-bar__avatar--calling">
          {target.initials}
        </span>
        <div className="contact-call-bar__info">
          <div className="contact-call-bar__name">Calling {target.name}</div>
          <div className="contact-call-bar__meta">{target.phone} · audio starts at zero</div>
        </div>
        <span className="contact-call-bar__count">{countdown}</span>
        <button type="button" className="contact-call-bar__cancel" onClick={() => callFlow.hangUp()}>
          Cancel
        </button>
      </div>
    );
  }

  const connected = phase === "connected";

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    callFlow.submitLine(t);
  };

  return (
    <div className="contact-call-bar contact-call-bar--live d-flex flex-column">
      <div className="d-flex align-items-center gap-3 flex-wrap">
        <div className="contact-call-bar__status">
          <span className="contact-call-bar__pulse" aria-hidden="true" />
          <span className="contact-call-bar__status-label">{connected ? "LIVE" : "RINGING"}</span>
          {connected && <span className="contact-call-bar__conn">Connected</span>}
          <span className="contact-call-bar__timer">{formatDuration(elapsedSecs)}</span>
        </div>

        <div className="contact-call-bar__target">
          <span className="contact-call-bar__avatar">{target.initials}</span>
          <div className="contact-call-bar__info">
            <div className="contact-call-bar__name">{target.name}</div>
            <div className="contact-call-bar__meta">
              {target.entity} · {target.phone}
            </div>
          </div>
        </div>

        <div className="contact-call-bar__actions ms-auto">
          <button
            type="button"
            className={`contact-call-bar__mute ${muted ? "is-active" : ""}`}
            onClick={() => callFlow.toggleMute()}
          >
            <FontAwesomeIcon icon={muted ? faMicrophoneSlash : faMicrophone} />
            {muted ? "Muted" : "Mute"}
          </button>
          <button
            type="button"
            className="contact-call-bar__end"
            onClick={() => (connected ? void callFlow.endCall() : callFlow.hangUp())}
          >
            <FontAwesomeIcon icon={faPhoneSlash} />
            {connected ? "End call & log" : "Hang up"}
          </button>
        </div>
      </div>

      {connected && (
        <div className="contact-call-bar__panel">
          <div className="contact-call-bar__transcript">
            {transcript.length === 0 && (
              <div className="contact-call-bar__hint">Connecting you…</div>
            )}
            {transcript.map((l) => (
              <div
                key={l.id}
                className={`contact-call-bar__line contact-call-bar__line--${l.speaker}`}
              >
                <span className="contact-call-bar__speaker">
                  {l.speaker === "you" ? "You" : target.firstName}
                </span>
                <span>{l.text}</span>
              </div>
            ))}
            {awaitingOwner && (
              <div className="contact-call-bar__hint">{target.firstName} is responding…</div>
            )}
          </div>

          {shouldEnd && (
            <div className="contact-call-bar__wrapup">Wrapping up — hang up when ready.</div>
          )}

          {suggestions.length > 0 && (
            <div className="contact-call-bar__chips">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="contact-call-bar__chip"
                  disabled={awaitingOwner}
                  onClick={() => callFlow.submitLine(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="contact-call-bar__compose d-flex align-items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              className="form-control form-control-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Say something to ${target.firstName}…`}
              aria-label="Your line"
              disabled={awaitingOwner}
            />
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              aria-label="Send line"
              disabled={awaitingOwner || !draft.trim()}
            >
              <FontAwesomeIcon icon={faPaperPlaneTop} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the expanded-panel styles**

Append to `src/main.scss` (after the existing `.contact-call-bar` block — do not alter the existing rules):

```scss
.contact-call-bar__panel {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.contact-call-bar__transcript {
  max-height: 8rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.9rem;
}
.contact-call-bar__line { display: flex; gap: 0.5rem; }
.contact-call-bar__line--you { color: rgba(255, 255, 255, 0.95); }
.contact-call-bar__line--them { color: rgba(255, 255, 255, 0.8); }
.contact-call-bar__speaker { font-weight: 600; min-width: 3.5rem; }
.contact-call-bar__hint,
.contact-call-bar__wrapup { font-size: 0.85rem; opacity: 0.8; font-style: italic; }
.contact-call-bar__chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.contact-call-bar__chip {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.35);
  color: #fff;
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
}
.contact-call-bar__chip:disabled { opacity: 0.5; cursor: default; }
.contact-call-bar__compose .form-control { max-width: 28rem; }
```

- [ ] **Step 3: Mount the bar globally in AppShell**

In `src/components/layout/AppShell.tsx`: add the import and render the bar at the top of `main`, above `<Outlet />`, so it docks over whatever page is shown.

Add import:

```tsx
import { LiveCallBar } from "#/components/call/LiveCallBar";
```

Change the `<main>` block to:

```tsx
          <main className="app-shell__main flex-grow-1 overflow-auto">
            {hydrated && <LiveCallBar />}
            {hydrated ? (
              <Outlet />
            ) : (
              <div className="d-flex justify-content-center align-items-center py-8 w-100 h-100">
                <CircularProgress size="lg" />
              </div>
            )}
          </main>
```

- [ ] **Step 4: Typecheck and run the full suite (no unit test for pure UI)**

Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.

Run: `bun --bun run test`
Expected: all pass (no regressions).

- [ ] **Step 5: Manual smoke (assistant runs the dev server; user verifies)**

Note in the commit body that this needs a manual check: with the app running, the global bar is not yet reachable until Task 5 wires an entry point — so this task's manual check is deferred to Task 5's smoke. Confirm only that the app still builds and existing pages render (the contact page still uses its own local bar until Task 5).

- [ ] **Step 6: Commit**

```bash
git add src/components/call/LiveCallBar.tsx src/components/layout/AppShell.tsx src/main.scss
git commit -m "feat(call): global LiveCallBar with connected transcript/chips (Phase 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Wire the entry points (agent tool + contact page) and register the mic kill-switch

**Files:**
- Modify: `src/ai/tools.ts:472-479` (`startCallDef.client` → `callFlow.open`)
- Modify: `src/routes/_shell/backoffice/contacts/$contactId.tsx` (drop local `useLiveCall`/local `LiveCallBar`/`LogCallModal`; point the Call button at `callFlow.open`)
- Modify: `src/components/ai/AssistantSidebar.tsx` (register `stopForCall` via `registerStopForCall`)
- Delete: `src/components/contacts/LiveCallBar.tsx`, `src/components/contacts/useLiveCall.ts` (moved/retired)

**Interfaces:**
- Consumes: `callFlow.open` / `registerStopForCall` (Task 3), `resolveContactByName` (`src/ai/tools.ts`).
- Produces: calls open from the agent's `start_call` and the contact-page button through the one global path; the sidebar's hands-free capture is registered so a call hard-stops it.

- [ ] **Step 1: Make `start_call` open the real call**

In `src/ai/tools.ts`, add the import near the other imports:

```ts
import { callFlow } from "#/components/call/callFlow";
```

Replace the `startCallDef.client(...)` body (currently `tools.ts:472-479`):

```ts
    startCallDef.client(async (args) => {
      const { contact_name } = args as { contact_name: string };
      const c = resolveContactByName(contact_name);
      if (!c) return { started: false, error: `No contact named "${contact_name}".` };
      callFlow.open(c);
      return { started: true, contactId: c.id };
    }),
```

- [ ] **Step 2: Register the mic kill-switch from the sidebar**

In `src/components/ai/AssistantSidebar.tsx`, add the import:

```ts
import { registerStopForCall } from "#/components/call/callFlow";
```

Replace the existing line `void stopForCall; // exported for Phase 3; referenced to satisfy lint` with an effect that registers/unregisters it:

```tsx
  useEffect(() => {
    registerStopForCall(stopForCall);
    return () => registerStopForCall(null);
  }, [stopForCall]);
```

- [ ] **Step 3: Migrate the contact page to the global call flow**

In `src/routes/_shell/backoffice/contacts/$contactId.tsx`:

Remove these imports:

```tsx
import { LiveCallBar } from "#/components/contacts/LiveCallBar";
import { LogCallModal } from "#/components/contacts/LogCallModal";
import { useLiveCall } from "#/components/contacts/useLiveCall";
```

Add:

```tsx
import { callFlow } from "#/components/call/callFlow";
```

Remove the `const liveCall = useLiveCall({ contact: detail?.contact ?? null });` line (near `$contactId.tsx:87`).

Remove the local `<LiveCallBar .../>` render block (`$contactId.tsx:101-109`) — the bar is now global in `AppShell`.

Remove the `<LogCallModal .../>` block (`$contactId.tsx:164-173`) — the call now ends in the sidebar recap.

Change the engagement panel's call handler (`$contactId.tsx:131`) from `onStartCall={liveCall.startCall}` to (the panel's prop is `onStartCall: (phone: string) => void`, so forward the phone):

```tsx
            onStartCall={(phone) => callFlow.open(contact, phone)}
```

> The `logged`/`addLog` state and the compose module stay untouched (they serve manual log entries, not the live call).

- [ ] **Step 4: Delete the retired contact-scoped call files**

```bash
git rm src/components/contacts/LiveCallBar.tsx src/components/contacts/useLiveCall.ts
```

> If `git grep -n "useLiveCall\|contacts/LiveCallBar"` returns any remaining references outside the files edited above, update them to the global equivalents before continuing.

- [ ] **Step 5: Typecheck and run the full suite**

Run: `bun --bun x tsc --noEmit`
Expected: 0 errors. (If `LogCallModal` becomes an unused import anywhere else, remove it; if `$contactId.tsx` has now-unused `logged`/`addLog`, leave them only if the compose module still uses them — verify with `git grep`.)

Run: `bun --bun run test`
Expected: all pass.

- [ ] **Step 6: Manual smoke (assistant starts the dev server; user verifies)**

Start: `bun --bun run dev`. User checks:
1. Open the assistant sidebar; type "call Marcus Pinckney" (or any real contact) → the global call bar docks, counts 5→1, rings, connects.
2. On connect, the owner speaks a line aloud (ElevenLabs "Al"/owner voice) and 2–3 chips appear.
3. Tap a chip or type a line → owner replies aloud; chips refresh.
4. From a contact record, the "Call" button opens the same bar.
5. During the call, the mic never re-arms (no "Listening…" indicator).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(call): wire start_call + contact page to global callFlow; retire LogCallModal path (Phase 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: The hang-up recap — "Al reports" in the sidebar

**Files:**
- Create: `src/components/call/callRecap.ts` (pure `composeRecapReport`)
- Create: `src/components/call/CallRecapCard.tsx`
- Modify: `src/components/ai/AssistantSidebar.tsx` (render `CallRecapCard` + speak the summary when `useCallStore.recap` appears)
- Test: `src/components/call/callRecap.test.ts`

**Interfaces:**
- Consumes: `CallRecapSpecT` (Task 1), `useCallStore` (Task 2), `voiceEngine` (Phase 2), `createTask`/`createDeal`/`parseDueDate`, `useAddTask`, `emptyDraft`.
- Produces:
  - `composeRecapReport(recap: CallRecapSpecT, contactName: string): { message: string; tasks: { title: string; due: string | null }[]; opportunity: { name: string; address: string } | null }` (pure).
  - `<CallRecapCard/>` rendering the message + keep/edit/drop task drafts + open-opportunity, driven by `useCallStore.recap`.

- [ ] **Step 1: Write the failing pure-function test**

Create `src/components/call/callRecap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { composeRecapReport } from "./callRecap";

describe("composeRecapReport", () => {
  it("leads with sentiment and key points and carries the drafts", () => {
    const r = composeRecapReport(
      {
        sentiment: "positive",
        keyPoints: ["Owner open to a valuation.", "Wants comps first."],
        tasks: [{ title: "Send comps", due: "Thursday" }],
        opportunity: { name: "123 East Bay", address: "123 East Bay St" },
      },
      "Marcus Pinckney",
    );
    expect(r.message).toContain("Marcus Pinckney");
    expect(r.message.toLowerCase()).toContain("positive");
    expect(r.message).toContain("Owner open to a valuation.");
    expect(r.tasks).toHaveLength(1);
    expect(r.opportunity?.address).toBe("123 East Bay St");
  });

  it("handles no tasks and no opportunity", () => {
    const r = composeRecapReport(
      { sentiment: "neutral", keyPoints: [], tasks: [], opportunity: null },
      "Jane Doe",
    );
    expect(r.tasks).toHaveLength(0);
    expect(r.opportunity).toBeNull();
    expect(r.message).toContain("Jane Doe");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test src/components/call/callRecap.test.ts`
Expected: FAIL — module `./callRecap` not found.

- [ ] **Step 3: Implement the pure composer**

Create `src/components/call/callRecap.ts`:

```ts
import type { CallRecapSpecT } from "#/ai/generate/schemas";

const SENTIMENT_LABEL: Record<CallRecapSpecT["sentiment"], string> = {
  positive: "positive",
  neutral: "neutral",
  negative: "cool",
};

/**
 * Turn a CallRecapSpec into the "Al reports" message (light HTML) plus the
 * interactive card payload. Pure — no store or data writes here.
 */
export function composeRecapReport(
  recap: CallRecapSpecT,
  contactName: string,
): {
  message: string;
  tasks: { title: string; due: string | null }[];
  opportunity: { name: string; address: string } | null;
} {
  const points = recap.keyPoints.length
    ? ` ${recap.keyPoints.join(" ")}`
    : "";
  const message =
    `Here's your recap with <strong>${contactName}</strong> — the call felt ` +
    `${SENTIMENT_LABEL[recap.sentiment]}.${points}`;
  return { message, tasks: recap.tasks, opportunity: recap.opportunity };
}

/** Strip the light HTML for text-to-speech (voiceEngine also strips, but keep the
 * spoken line clean). */
export function recapSpeechText(message: string): string {
  return message.replace(/<[^>]+>/g, "");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test src/components/call/callRecap.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the recap card**

Create `src/components/call/CallRecapCard.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faListCheck, faBriefcase, faXmark, faPen } from "@fortawesome/pro-regular-svg-icons";
import { renderLightHtml } from "#/ai/renderLightHtml";
import { useCallStore } from "#/components/call/useCallStore";
import { composeRecapReport } from "#/components/call/callRecap";
import { createTask, createDeal } from "#/data/actions";
import { parseDueDate } from "#/ai/dueDate";
import { useAddTask } from "#/data/useAddTask";
import { emptyDraft } from "#/data/createListing";

/**
 * "Al reports" recap card (Phase-3 design §6.1). Renders when useCallStore.recap
 * is set, after a call ends. Drafts follow-up tasks (keep / edit / drop) and can
 * open an opportunity. Kept tasks + the opportunity create real records.
 */
export function CallRecapCard() {
  const recap = useCallStore((s) => s.recap);
  const target = useCallStore((s) => s.target);
  const clearRecap = useCallStore((s) => s.clearRecap);
  const reset = useCallStore((s) => s.reset);
  const router = useRouter();

  const contactName = target?.name ?? "your contact";
  const contactId = target?.contactId ?? null;
  const report = useMemo(
    () => (recap ? composeRecapReport(recap, contactName) : null),
    [recap, contactName],
  );

  const [drafts, setDrafts] = useState<{ title: string; due: string | null }[]>([]);
  const [oppOpen, setOppOpen] = useState(false);

  // Seed the editable drafts when a new recap arrives.
  useEffect(() => {
    if (recap) {
      setDrafts(recap.tasks);
      setOppOpen(false);
    }
  }, [recap]);

  if (!recap || !report) return null;

  const keep = (i: number) => {
    const d = drafts[i];
    createTask({
      name: d.title,
      dueDate: d.due ? parseDueDate(d.due) : null,
      contactId,
      source: "contact",
      type: "call",
    });
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
  };

  const edit = (i: number) => {
    const d = drafts[i];
    const { task } = createTask({
      name: d.title,
      dueDate: d.due ? parseDueDate(d.due) : null,
      contactId,
      source: "contact",
      type: "call",
    });
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));
    useAddTask.getState().openEdit(task.id);
  };

  const drop = (i: number) => setDrafts((prev) => prev.filter((_, idx) => idx !== i));

  const openOpportunity = () => {
    if (!report.opportunity) return;
    const { deal } = createDeal({
      ...emptyDraft(),
      name: report.opportunity.name,
      address: report.opportunity.address,
      sellerContactId: contactId ?? "",
      dealSide: "seller",
    });
    setOppOpen(true);
    router.navigate({ to: `/listings/${deal.id}` as never });
  };

  const dismiss = () => {
    clearRecap();
    reset();
  };

  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-3">
      <div className="d-flex align-items-start gap-2">
        <div
          className="assistant-markdown flex-grow-1"
          dangerouslySetInnerHTML={{ __html: renderLightHtml(report.message) }}
        />
        <Button variant="ghost" size="icon-sm" aria-label="Dismiss recap" onClick={dismiss}>
          <FontAwesomeIcon icon={faXmark} />
        </Button>
      </div>

      {drafts.length > 0 && (
        <div className="d-flex flex-column gap-2">
          <div className="d-flex align-items-center gap-2 small text-muted text-uppercase fw-semibold">
            <FontAwesomeIcon icon={faListCheck} />
            Follow-up tasks
          </div>
          {drafts.map((d, i) => (
            <div key={i} className="border rounded p-2 d-flex align-items-center gap-2">
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="fw-semibold text-truncate">{d.title}</div>
                {d.due && <div className="small text-muted">Due {d.due}</div>}
              </div>
              <Button variant="primary" size="sm" onClick={() => keep(i)}>
                Keep
              </Button>
              <Button variant="outline" size="icon-sm" aria-label="Edit task" onClick={() => edit(i)}>
                <FontAwesomeIcon icon={faPen} />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Drop task" onClick={() => drop(i)}>
                <FontAwesomeIcon icon={faXmark} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {report.opportunity && !oppOpen && (
        <div className="border rounded p-2 d-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faBriefcase} className="text-buildout-blue-700" />
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="fw-semibold text-truncate">{report.opportunity.name}</div>
            <div className="small text-muted text-truncate">{report.opportunity.address}</div>
          </div>
          <Button variant="primary" size="sm" onClick={openOpportunity}>
            Open opportunity
          </Button>
        </div>
      )}
      {oppOpen && (
        <Badge variant="secondary" appearance="muted">
          Opportunity opened
        </Badge>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Render + speak the recap in the sidebar**

In `src/components/ai/AssistantSidebar.tsx`:

Add imports:

```tsx
import { useCallStore } from "#/components/call/useCallStore";
import { CallRecapCard } from "#/components/call/CallRecapCard";
import { composeRecapReport, recapSpeechText } from "#/components/call/callRecap";
```

Add a speak-on-recap effect (near the other voice effects, after the reply-speak effect). It speaks the recap once when it appears, without entering conversation mode (one-way report):

```tsx
  const recap = useCallStore((s) => s.recap);
  const recapTarget = useCallStore((s) => s.target);
  const spokenRecapRef = useRef<object | null>(null);
  useEffect(() => {
    if (!recap || recap === spokenRecapRef.current) return;
    spokenRecapRef.current = recap;
    if (!voiceEnabled) return;
    const { message } = composeRecapReport(recap, recapTarget?.name ?? "your contact");
    void voiceEngine.speak(recapSpeechText(message)); // no re-arm: not in conversationMode
  }, [recap, recapTarget, voiceEnabled]);
```

Render `<CallRecapCard />` at the top of the messages scroll area, before the messages map. Change the messages container's content so the card shows above the conversation:

```tsx
      <div ref={scrollRef} className="flex-grow-1 overflow-auto p-3 d-flex flex-column gap-2">
        {recap && <CallRecapCard />}
        {messages.length === 0 && !recap ? (
          <div className="text-muted small">
            Ask about your properties, contacts, and deals — or have me draft an email, build a
            call list, or move a deal along.
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        {/* …existing isLoading / listening / error blocks unchanged… */}
      </div>
```

- [ ] **Step 7: Run the tests and typecheck**

Run: `bun --bun run test`
Expected: all pass.

Run: `bun --bun x tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 8: Manual smoke (assistant starts the dev server; user verifies)**

With `bun --bun run dev`: run a call to connect, exchange a couple of lines, press **End call & log**. Confirm:
1. The sidebar opens and Al posts a recap; it's **spoken once** (if voice on) and the mic does **not** re-arm.
2. Task drafts show Keep / Edit (opens the Add/Edit Task modal) / Drop; Keep creates a task on the contact.
3. If an opportunity is offered, "Open opportunity" creates a deal and navigates to it.
4. No owner/Al audio plays after End-call.

- [ ] **Step 9: Commit**

```bash
git add src/components/call/callRecap.ts src/components/call/callRecap.test.ts src/components/call/CallRecapCard.tsx src/components/ai/AssistantSidebar.tsx
git commit -m "feat(call): Al-reports hang-up recap with task drafts + open-opportunity (Phase 3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `bun --bun run test` — all green.
- [ ] `bun --bun x tsc --noEmit` — 0 errors.
- [ ] `git grep -n "useLiveCall\|contacts/LiveCallBar\|contacts/LogCallModal"` — no stale references (LogCallModal.tsx may remain in the tree unused; remove it only if nothing imports it).
- [ ] Manual hero-slice: sidebar → "call &lt;contact&gt;" → 5→1 → ring → connect → owner speaks → chips/typing exchange → End call → sidebar recap (spoken, no re-arm) → Keep a task / Open opportunity. Repeat with voice off and (if feasible) with `ANTHROPIC_API_KEY` unset to confirm the deterministic fallbacks still run the call end-to-end.

## Self-review notes (coverage against the spec)

- Spec §3 generators → Task 1. §3.1 store / §2 ring tones → Task 2. §4 open + §5 turn loop + §7 bridge → Task 3. §3/§4 bar UI + global mount → Task 4. §4 entry points (start_call, contact page) + §5.3 mic kill → Task 5. §6 recap → Task 6.
- §8 call brief and the Phase-4 director extensions are explicitly out of scope (design §2 non-goals) — no task, by design.
- §9 degradation is covered by the fallbacks in Task 1 + `voiceEngine`'s existing browser-speech path; verified in the final manual step.
- §10 testing maps to the Vitest files in Tasks 1–3 and 6; audio/live-call is manual per project rule.
```
