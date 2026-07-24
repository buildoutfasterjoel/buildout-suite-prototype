# AI Phase 2 — Voice Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Buildout Suite assistant ("Al") a voice — an ElevenLabs TTS server function with a browser-speech fallback, a hands-free STT loop, a full speak lifecycle with controls, owner-voice selection (a Phase-3 contract), and a proactive spoken greeting with audio unlock.

**Architecture:** An imperative `voiceEngine` singleton owns audio playback, the generation guard, and cancel/pause/mute; a thin `useVoice` Zustand store holds reactive UI state; a `useHandsFree` hook wraps the Web Speech API and feeds the existing `sendMessage`. Voice-out is a `createServerFn` returning MP3 bytes behind a swappable `synthesize()` seam (mirrors `src/ai/relay.ts`). All voice code lives under `src/ai/voice/` plus `src/ai/tts.ts`.

**Tech Stack:** TanStack Start (`createServerFn`), React 19, Zustand, `@tanstack/react-hotkeys`, ElevenLabs REST API, browser Web Speech API (`SpeechSynthesis` / `SpeechRecognition`), Vitest. Blueprint React + Bootstrap utilities + FontAwesome `pro-regular` for UI.

## Global Constraints

- **Package manager / runner:** Bun — `bun --bun run test`, `bun --bun run dev`. Tests are Vitest (`vitest run`).
- **Keys never reach the client.** `ELEVENLABS_API_KEY` and `ANTHROPIC_API_KEY` are read via `process.env` **only** inside server functions.
- **No hard failures.** Missing key → a normal state (`503` / browser fallback / on-screen greeting), never a 500 or thrown error the user sees.
- **No Playwright** (project rule). Browser-only paths (audio playback, Web Speech) are verified by a manual checklist; all pure logic is unit-tested.
- **Icons:** FontAwesome `pro-regular` by default; **never** pass `fixedWidth` to `FontAwesomeIcon`. No margin utility classes on Blueprint `Badge` icons.
- **UI:** Blueprint React components + Bootstrap utility classes. Do **not** restructure the existing `AssistantSidebar` layout — add controls, don't redesign.
- **Durable modules only.** All new code lives in `src/ai/**` and existing non-route components. Do not edit CLI-managed route files (`__root.tsx`, `login.tsx`).
- **Commit after every task.** Do not push, merge, or open PRs — leave the branch as-is.
- **Model default:** ElevenLabs `eleven_flash_v2_5`. **Voice settings:** `{ stability: 0.45, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true }`.
- **Spoken text caps:** ~650 chars (client, cut on sentence boundary); ~4000 chars (server hard cap).

---

## File Structure

**Create:**
- `src/ai/tts.ts` — `tts` (POST → MP3 bytes) + `ttsConfigured` (GET) server fns; pure `buildTtsRequest`/`synthesize` seam.
- `src/ai/voice/ttsConfig.ts` — voice IDs, model id, voice settings, owner pools; `resolveVoiceId`.
- `src/ai/voice/textPrep.ts` — `prepForSpeech()`.
- `src/ai/voice/ownerVoice.ts` — `genderFromFirstName()`, `ownerVoiceFor()`.
- `src/ai/voice/greeting.ts` — `composeGreeting()`.
- `src/ai/voice/generationGuard.ts` — `createGenerationGuard()`.
- `src/ai/voice/voiceEngine.ts` — the imperative singleton.
- `src/ai/voice/useVoice.ts` — reactive Zustand store.
- `src/ai/voice/useHandsFree.ts` — STT loop hook + `assembleTranscript()` helper.
- `src/ai/voice/useGreeting.ts` — greeting orchestration + audio-unlock arming.
- Test files: `src/ai/voice/*.test.ts`, `src/ai/tts.test.ts`.

**Modify:**
- `.env.sample` — add `ELEVENLABS_API_KEY`.
- `src/ai/useAssistant.ts` — add `greetedThisSession` + setter.
- `src/components/ai/AssistantSidebar.tsx` — voice controls, mic button, live transcript, speak-the-reply wiring, Escape kill-switch, greeting hook.

---

### Task 1: Text preparation for speech (`textPrep.ts`)

**Files:**
- Create: `src/ai/voice/textPrep.ts`
- Test: `src/ai/voice/textPrep.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `prepForSpeech(raw: string, maxChars?: number): string` — strips HTML tags, decodes common HTML entities to real characters, and truncates to `maxChars` (default 650) on the nearest sentence boundary at or before the cap.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/voice/textPrep.test.ts
import { describe, it, expect } from "vitest";
import { prepForSpeech } from "./textPrep";

describe("prepForSpeech", () => {
  it("strips HTML tags", () => {
    expect(prepForSpeech("<strong>Call</strong> Marcus now")).toBe("Call Marcus now");
  });

  it("decodes HTML entities to real characters", () => {
    expect(prepForSpeech("It&#39;s Marcus&rsquo;s deal &amp; more")).toBe("It's Marcus's deal & more");
  });

  it("collapses whitespace left by stripped tags", () => {
    expect(prepForSpeech("<p>Hi</p>\n<p>there</p>")).toBe("Hi there");
  });

  it("caps on a sentence boundary at or before the limit", () => {
    const text = "One sentence here. Two sentence here. Three runs over the cap now.";
    const out = prepForSpeech(text, 40);
    expect(out).toBe("One sentence here. Two sentence here.");
  });

  it("hard-truncates when no sentence boundary exists before the cap", () => {
    const out = prepForSpeech("wordwordwordwordwordwordword", 10);
    expect(out.length).toBeLessThanOrEqual(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/voice/textPrep.test.ts`
Expected: FAIL — cannot find module `./textPrep`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/voice/textPrep.ts
/**
 * Prepare assistant/owner text for TTS: strip HTML, decode entities to real
 * characters (a naked `&#39;` reads as gibberish otherwise), collapse
 * whitespace, and cap length on a sentence boundary so the voice never trails
 * off mid-word. See voice-foundation design §5.
 */
const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&apos;": "'", "&rsquo;": "'", "&lsquo;": "'",
  "&rdquo;": '"', "&ldquo;": '"', "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–",
};

function decodeEntities(s: string): string {
  let out = s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  for (const [name, ch] of Object.entries(NAMED_ENTITIES)) out = out.split(name).join(ch);
  return out;
}

export function prepForSpeech(raw: string, maxChars = 650): string {
  const stripped = raw.replace(/<[^>]*>/g, " ");
  const decoded = decodeEntities(stripped);
  const text = decoded.replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;

  const slice = text.slice(0, maxChars);
  const lastBoundary = Math.max(
    slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "),
  );
  if (lastBoundary > 0) return slice.slice(0, lastBoundary + 1).trim();
  return slice.trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/voice/textPrep.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/voice/textPrep.ts src/ai/voice/textPrep.test.ts
git commit -m "feat(voice): prepForSpeech — strip HTML, decode entities, cap on sentence boundary"
```

---

### Task 2: Voice config + env (`ttsConfig.ts`)

**Files:**
- Create: `src/ai/voice/ttsConfig.ts`
- Test: `src/ai/voice/ttsConfig.test.ts`
- Modify: `.env.sample`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `AL_VOICE_ID: string`, `TTS_MODEL: string`, `AL_VOICE_SETTINGS: { stability; similarity_boost; style; use_speaker_boost }`.
  - `OWNER_VOICES: { female: string[]; male: string[] }`.
  - `ALLOWED_VOICE_IDS: Set<string>` (Al + all owner voices).
  - `resolveVoiceId(id: string | undefined): string` — returns `id` if whitelisted, else `AL_VOICE_ID`.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/voice/ttsConfig.test.ts
import { describe, it, expect } from "vitest";
import { resolveVoiceId, AL_VOICE_ID, OWNER_VOICES, ALLOWED_VOICE_IDS } from "./ttsConfig";

describe("ttsConfig", () => {
  it("resolves a whitelisted voice id unchanged", () => {
    const known = OWNER_VOICES.female[0];
    expect(resolveVoiceId(known)).toBe(known);
  });

  it("falls back to the Al voice for an unknown id", () => {
    expect(resolveVoiceId("not-a-real-voice")).toBe(AL_VOICE_ID);
    expect(resolveVoiceId(undefined)).toBe(AL_VOICE_ID);
  });

  it("includes the Al voice and every owner voice in the whitelist", () => {
    expect(ALLOWED_VOICE_IDS.has(AL_VOICE_ID)).toBe(true);
    for (const id of [...OWNER_VOICES.female, ...OWNER_VOICES.male]) {
      expect(ALLOWED_VOICE_IDS.has(id)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/voice/ttsConfig.test.ts`
Expected: FAIL — cannot find module `./ttsConfig`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/voice/ttsConfig.ts
/**
 * Voice configuration for the ElevenLabs TTS path. Voice ids are ElevenLabs
 * stock voices, overridable via env so a swap needs no code change.
 * NOTE: confirm these ids against the ElevenLabs account during setup
 * (voice-foundation design §9); they are the documented public premade ids.
 */
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

/** Warm, neutral "Al" delivery. Default: ElevenLabs "Adam". */
export const AL_VOICE_ID = env.ELEVENLABS_AL_VOICE_ID || "pNInz6obpgDQGcFmaJgB";

/** Low-latency, low-credit model for hands-free + the Phase-3 live call. */
export const TTS_MODEL = env.ELEVENLABS_MODEL || "eleven_flash_v2_5";

/** Warmth comes from voice + settings (ElevenLabs has no `instructions` field). */
export const AL_VOICE_SETTINGS = {
  stability: 0.45,
  similarity_boost: 0.75,
  style: 0.4,
  use_speaker_boost: true,
};

/** Gendered owner pools (Phase 3 owner lines). Stock ElevenLabs voices. */
export const OWNER_VOICES = {
  female: [
    "21m00Tcm4TlvDq8ikWAM", // Rachel
    "AZnzlk1XvdvUeBnXmlld", // Domi
    "EXAVITQu4vr4xnSDxMaL", // Bella
    "MF3mGyEYCl7XYWbV9V6O", // Elli
  ],
  male: [
    "ErXwobaYiN019PkySvjV", // Antoni
    "TxGEqnHWrfWFTfGW9XjX", // Josh
    "VR6AewLTigWG4xSOukaG", // Arnold
    "yoZ06aMxZJJ28mfd3POQ", // Sam
  ],
};

export const ALLOWED_VOICE_IDS = new Set<string>([
  AL_VOICE_ID,
  ...OWNER_VOICES.female,
  ...OWNER_VOICES.male,
]);

export function resolveVoiceId(id: string | undefined): string {
  return id && ALLOWED_VOICE_IDS.has(id) ? id : AL_VOICE_ID;
}
```

- [ ] **Step 4: Add the env var to `.env.sample`**

Append to `.env.sample`:

```bash

# ElevenLabs API key for text-to-speech (Al's voice). Read server-side only by
# the TTS server fn (src/ai/tts.ts); never exposed to the client. Without it,
# voice falls back to the browser SpeechSynthesis API. Optional overrides:
# ELEVENLABS_AL_VOICE_ID, ELEVENLABS_MODEL.
ELEVENLABS_API_KEY=""
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --bun run test src/ai/voice/ttsConfig.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/ai/voice/ttsConfig.ts src/ai/voice/ttsConfig.test.ts .env.sample
git commit -m "feat(voice): TTS config (voice ids, model, settings, owner pools) + env"
```

---

### Task 3: Owner-voice selection (`ownerVoice.ts`)

**Files:**
- Create: `src/ai/voice/ownerVoice.ts`
- Test: `src/ai/voice/ownerVoice.test.ts`

**Interfaces:**
- Consumes: `OWNER_VOICES` from `./ttsConfig`; `Contact` from `#/data/types` (uses `id`, `firstName`).
- Produces:
  - `genderFromFirstName(firstName: string): "female" | "male"` — heuristic; defaults to `"male"` when unknown.
  - `ownerVoiceFor(contact: Pick<Contact, "id" | "firstName">): string` — a stable ElevenLabs voice id: gendered pool indexed by a stable hash of `contact.id`, so the same owner always sounds the same. **Built now; playback wiring is Phase 3.**

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/voice/ownerVoice.test.ts
import { describe, it, expect } from "vitest";
import { genderFromFirstName, ownerVoiceFor } from "./ownerVoice";
import { OWNER_VOICES } from "./ttsConfig";

describe("genderFromFirstName", () => {
  it("classifies common female names", () => {
    expect(genderFromFirstName("Sarah")).toBe("female");
    expect(genderFromFirstName("Emily")).toBe("female");
  });
  it("classifies common male names", () => {
    expect(genderFromFirstName("Marcus")).toBe("male");
    expect(genderFromFirstName("John")).toBe("male");
  });
  it("defaults unknown names to male", () => {
    expect(genderFromFirstName("Xyzzy")).toBe("male");
  });
});

describe("ownerVoiceFor", () => {
  it("returns a voice from the gendered pool", () => {
    const v = ownerVoiceFor({ id: "c1", firstName: "Sarah" });
    expect(OWNER_VOICES.female).toContain(v);
  });
  it("is stable per contact id across calls", () => {
    const a = ownerVoiceFor({ id: "c-42", firstName: "Marcus" });
    const b = ownerVoiceFor({ id: "c-42", firstName: "Marcus" });
    expect(a).toBe(b);
  });
  it("different ids can map to different voices in the pool", () => {
    const voices = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) =>
        ownerVoiceFor({ id, firstName: "Marcus" }),
      ),
    );
    expect(voices.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/voice/ownerVoice.test.ts`
Expected: FAIL — cannot find module `./ownerVoice`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/voice/ownerVoice.ts
import type { Contact } from "#/data/types";
import { OWNER_VOICES } from "./ttsConfig";

/**
 * Small curated first-name → gender map plus a suffix heuristic. This only
 * chooses a voice for the simulated owner in a call; it never affects data.
 * Unknown names default to male so a voice is always produced.
 */
const FEMALE_NAMES = new Set([
  "sarah", "emily", "jessica", "ashley", "amanda", "jennifer", "elizabeth",
  "linda", "susan", "karen", "nancy", "lisa", "margaret", "sandra", "patricia",
  "mary", "barbara", "carol", "diane", "grace", "rachel", "anna", "laura",
]);
const MALE_NAMES = new Set([
  "marcus", "john", "james", "robert", "michael", "william", "david", "richard",
  "joseph", "thomas", "charles", "daniel", "matthew", "anthony", "mark", "paul",
  "steven", "andrew", "kenneth", "george", "edward", "frank", "carl", "henry",
]);

export function genderFromFirstName(firstName: string): "female" | "male" {
  const name = firstName.trim().toLowerCase();
  if (FEMALE_NAMES.has(name)) return "female";
  if (MALE_NAMES.has(name)) return "male";
  if (name.endsWith("a") || name.endsWith("ie") || name.endsWith("elle")) return "female";
  return "male";
}

/** Stable non-negative hash of a string (djb2). */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

export function ownerVoiceFor(contact: Pick<Contact, "id" | "firstName">): string {
  const pool = OWNER_VOICES[genderFromFirstName(contact.firstName)];
  return pool[hashString(contact.id) % pool.length];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/voice/ownerVoice.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/voice/ownerVoice.ts src/ai/voice/ownerVoice.test.ts
git commit -m "feat(voice): ownerVoiceFor — stable gendered voice per contact (Phase-3 contract)"
```

---

### Task 4: TTS server function (`tts.ts`)

**Files:**
- Create: `src/ai/tts.ts`
- Test: `src/ai/tts.test.ts`

**Interfaces:**
- Consumes: `resolveVoiceId`, `TTS_MODEL`, `AL_VOICE_SETTINGS` from `./voice/ttsConfig`.
- Produces:
  - `synthesizeResponse(args: { text: string; voiceId?: string; apiKey?: string; fetchImpl?: typeof fetch }): Promise<Response>` — pure, testable core: `503` when no `apiKey`; caps text at 4000 chars; whitelists the voice; calls ElevenLabs; returns an `audio/mpeg` `Response` on success, `502` on provider failure.
  - `tts` — `createServerFn` POST wrapper calling `synthesizeResponse` with `process.env.ELEVENLABS_API_KEY`.
  - `ttsConfigured` — `createServerFn` GET returning `{ configured: boolean }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/tts.test.ts
import { describe, it, expect, vi } from "vitest";
import { synthesizeResponse } from "./tts";
import { AL_VOICE_ID } from "./voice/ttsConfig";

describe("synthesizeResponse", () => {
  it("returns 503 when no api key is configured", async () => {
    const res = await synthesizeResponse({ text: "hello", apiKey: undefined });
    expect(res.status).toBe(503);
  });

  it("calls ElevenLabs with the resolved voice and returns audio bytes", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
    ) as unknown as typeof fetch;

    const res = await synthesizeResponse({ text: "hi", voiceId: "bogus", apiKey: "k", fetchImpl });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain(AL_VOICE_ID); // unknown voice fell back to Al
  });

  it("caps text at 4000 chars before sending", async () => {
    let sentText = "";
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      sentText = JSON.parse(init.body as string).text;
      return new Response(new Uint8Array([1]), { status: 200 });
    }) as unknown as typeof fetch;

    await synthesizeResponse({ text: "x".repeat(5000), apiKey: "k", fetchImpl });
    expect(sentText.length).toBe(4000);
  });

  it("returns 502 when the provider fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
    const res = await synthesizeResponse({ text: "hi", apiKey: "k", fetchImpl });
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/tts.test.ts`
Expected: FAIL — cannot find module `./tts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/tts.ts
import { createServerFn } from "@tanstack/react-start";
import { resolveVoiceId, TTS_MODEL, AL_VOICE_SETTINGS } from "./voice/ttsConfig";

const MAX_TTS_CHARS = 4000;

/**
 * Provider seam. Pure and injectable so it unit-tests without network or env.
 * Swapping TTS providers later means rewriting only this function; the server
 * fn contract and all client code stay put (voice-foundation design §4).
 */
export async function synthesizeResponse(args: {
  text: string;
  voiceId?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<Response> {
  const { text, voiceId, apiKey, fetchImpl = fetch } = args;
  if (!apiKey) {
    return new Response("ELEVENLABS_API_KEY is not set on the server.", {
      status: 503,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  }

  const id = resolveVoiceId(voiceId);
  const capped = text.slice(0, MAX_TTS_CHARS);

  let providerRes: Response;
  try {
    providerRes = await fetchImpl(
      `https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: capped, model_id: TTS_MODEL, voice_settings: AL_VOICE_SETTINGS }),
      },
    );
  } catch {
    return new Response("TTS provider request failed.", { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  if (!providerRes.ok) {
    return new Response("TTS provider error.", { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const bytes = await providerRes.arrayBuffer();
  return new Response(bytes, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}

/** POST { text, voiceId? } → audio/mpeg bytes (503 no key, 502 provider fail). */
export const tts = createServerFn({ method: "POST" })
  .validator((data: { text: string; voiceId?: string }) => data)
  .handler(async ({ data }) =>
    synthesizeResponse({ text: data.text, voiceId: data.voiceId, apiKey: process.env.ELEVENLABS_API_KEY }),
  );

/** Lets the client choose server-TTS vs browser speech before any audio call. */
export const ttsConfigured = createServerFn({ method: "GET" }).handler(async () => ({
  configured: Boolean(process.env.ELEVENLABS_API_KEY),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/tts.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/tts.ts src/ai/tts.test.ts
git commit -m "feat(voice): ElevenLabs TTS server fn (MP3 bytes) + ttsConfigured, provider seam"
```

---

### Task 5: Greeting composer (`greeting.ts`)

**Files:**
- Create: `src/ai/voice/greeting.ts`
- Test: `src/ai/voice/greeting.test.ts`

**Interfaces:**
- Consumes: `AssistantContext` from `#/ai/context` (uses `broker.name`, `tasks.overdue`, `tasks.dueToday`).
- Produces: `composeGreeting(ctx: AssistantContext, opts?: { now?: Date; overnightSignal?: string }): string` — deterministic; time-of-day + first name + real open-task count, an overnight-signal line only when `opts.overnightSignal` is provided, always ending in the offer. **No LLM — speaks even with no Anthropic key.**

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/voice/greeting.test.ts
import { describe, it, expect } from "vitest";
import { composeGreeting } from "./greeting";
import type { AssistantContext } from "#/ai/context";

const ctx = (over = 0, today = 0): AssistantContext => ({
  broker: { name: "John Whitfield", role: "Broker" },
  tasks: { overdue: over, dueToday: today },
  pipeline: { openDeals: 0, totalValue: 0 },
  contacts: [],
});

describe("composeGreeting", () => {
  it("uses the broker first name and time of day", () => {
    const g = composeGreeting(ctx(0, 3), { now: new Date("2026-07-23T08:00:00") });
    expect(g).toMatch(/^Morning, John/);
  });

  it("switches to Afternoon and Evening by hour", () => {
    expect(composeGreeting(ctx(), { now: new Date("2026-07-23T13:00:00") })).toMatch(/^Afternoon, John/);
    expect(composeGreeting(ctx(), { now: new Date("2026-07-23T20:00:00") })).toMatch(/^Evening, John/);
  });

  it("states the real open-task count", () => {
    expect(composeGreeting(ctx(0, 5), { now: new Date("2026-07-23T08:00:00") })).toContain("5 tasks");
    expect(composeGreeting(ctx(0, 1), { now: new Date("2026-07-23T08:00:00") })).toContain("1 task ");
  });

  it("mentions an overnight signal only when provided", () => {
    const withSig = composeGreeting(ctx(0, 2), { now: new Date("2026-07-23T08:00:00"), overnightSignal: "a maturing loan on Marcus Pinckney" });
    expect(withSig).toContain("overnight");
    const without = composeGreeting(ctx(0, 2), { now: new Date("2026-07-23T08:00:00") });
    expect(without).not.toContain("overnight");
  });

  it("always ends in the offer", () => {
    expect(composeGreeting(ctx(0, 0), { now: new Date("2026-07-23T08:00:00") }))
      .toContain("Want me to call your most important move first?");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/voice/greeting.test.ts`
Expected: FAIL — cannot find module `./greeting`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/voice/greeting.ts
import type { AssistantContext } from "#/ai/context";

const OFFER = "Want me to call your most important move first?";

function partOfDay(now: Date): "Morning" | "Afternoon" | "Evening" {
  const h = now.getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

/**
 * Deterministic, grounded spoken greeting (voice-foundation design §6.3).
 * No LLM — composed from the live-store context so it works key-less.
 */
export function composeGreeting(
  ctx: AssistantContext,
  opts: { now?: Date; overnightSignal?: string } = {},
): string {
  const now = opts.now ?? new Date();
  const first = ctx.broker.name.split(" ")[0] || "there";
  const count = ctx.tasks.overdue + ctx.tasks.dueToday;
  const taskLine =
    count > 0
      ? `you've got ${count} task${count === 1 ? "" : "s"} on the calendar today.`
      : "your calendar's clear today — good time to prospect.";
  const signalLine = opts.overnightSignal
    ? ` A signal also came in overnight — ${opts.overnightSignal}. I pinned it to the top of your list.`
    : "";
  return `${partOfDay(now)}, ${first}. ${taskLine}${signalLine} ${OFFER}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/voice/greeting.test.ts`
Expected: PASS (5 tests). *(Note the `"1 task "` assertion includes a trailing space to avoid matching "1 tasks".)*

- [ ] **Step 5: Commit**

```bash
git add src/ai/voice/greeting.ts src/ai/voice/greeting.test.ts
git commit -m "feat(voice): composeGreeting — deterministic grounded spoken greeting"
```

---

### Task 6: Generation guard (`generationGuard.ts`)

**Files:**
- Create: `src/ai/voice/generationGuard.ts`
- Test: `src/ai/voice/generationGuard.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `createGenerationGuard()` → `{ current(): number; next(): number; isCurrent(gen: number): boolean }`. `next()` increments and returns the new generation (a newer speak or a cancel calls it); `isCurrent(gen)` reports whether `gen` is still the latest.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/voice/generationGuard.test.ts
import { describe, it, expect } from "vitest";
import { createGenerationGuard } from "./generationGuard";

describe("createGenerationGuard", () => {
  it("starts at generation 0 and is current", () => {
    const g = createGenerationGuard();
    expect(g.current()).toBe(0);
    expect(g.isCurrent(0)).toBe(true);
  });

  it("next() invalidates the previous generation", () => {
    const g = createGenerationGuard();
    const mine = g.current();
    g.next();
    expect(g.isCurrent(mine)).toBe(false);
    expect(g.isCurrent(g.current())).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/voice/generationGuard.test.ts`
Expected: FAIL — cannot find module `./generationGuard`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/voice/generationGuard.ts
/**
 * Monotonic generation counter. Every speak captures the current generation;
 * a newer speak or a cancel calls next(), so stale in-flight TTS never plays
 * (voice-foundation design §5). Pure and framework-free.
 */
export function createGenerationGuard() {
  let gen = 0;
  return {
    current: () => gen,
    next: () => ++gen,
    isCurrent: (g: number) => g === gen,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/voice/generationGuard.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/voice/generationGuard.ts src/ai/voice/generationGuard.test.ts
git commit -m "feat(voice): generation guard for aborting stale speech"
```

---

### Task 7: The voice engine (`voiceEngine.ts`)

**Files:**
- Create: `src/ai/voice/voiceEngine.ts`
- Test: `src/ai/voice/voiceEngine.test.ts`

**Interfaces:**
- Consumes: `createGenerationGuard` (`./generationGuard`); `prepForSpeech` (`./textPrep`); `tts` (`#/ai/tts`); `useVoice` store getState (`./useVoice`) for `voiceEnabled`/`muted` and to set `speaking`.
- Produces a singleton `voiceEngine`:
  - `unlock(): void` — resume `AudioContext` + play a tiny silent clip (call on first user gesture).
  - `speak(text: string, opts?: { voiceId?: string }): Promise<void>` — resolves when playback ends **or** is cancelled/superseded.
  - `cancel(): void` — hard stop; bumps generation; stops `Audio` + `speechSynthesis`; force-resolves the awaiting promise.
  - `pause(): void` / `resume(): void`.
  - `isSpeaking(): boolean`.

**Note on testability:** jsdom has no `Audio`/`speechSynthesis`. The test stubs `#/ai/tts` and the two globals. The engine reads `#/ai/tts`'s `ttsConfigured` result lazily and caches it; expose an internal `__setTtsConfiguredForTest(v)` used only in tests.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/voice/voiceEngine.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("#/ai/tts", () => ({
  tts: vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
  ttsConfigured: vi.fn(async () => ({ configured: false })), // force browser-speech path
}));

class FakeUtterance { text: string; onend: (() => void) | null = null; constructor(t: string) { this.text = t; } }
beforeEach(() => {
  (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance;
  (globalThis as Record<string, unknown>).speechSynthesis = {
    speak: (u: FakeUtterance) => setTimeout(() => u.onend?.(), 5),
    cancel: vi.fn(),
    getVoices: () => [],
  };
});

describe("voiceEngine", () => {
  it("speak() resolves after browser speech ends", async () => {
    const { voiceEngine } = await import("./voiceEngine");
    voiceEngine.__setTtsConfiguredForTest(false);
    await expect(voiceEngine.speak("hello there")).resolves.toBeUndefined();
  });

  it("cancel() force-resolves an in-flight speak and bumps generation", async () => {
    const { voiceEngine } = await import("./voiceEngine");
    voiceEngine.__setTtsConfiguredForTest(false);
    (globalThis as Record<string, unknown>).speechSynthesis = {
      speak: vi.fn(), cancel: vi.fn(), getVoices: () => [],   // never fires onend
    };
    const p = voiceEngine.speak("this will be cancelled");
    voiceEngine.cancel();
    await expect(p).resolves.toBeUndefined(); // settled despite no `ended`
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/voice/voiceEngine.test.ts`
Expected: FAIL — cannot find module `./voiceEngine`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/voice/voiceEngine.ts
import { createGenerationGuard } from "./generationGuard";
import { prepForSpeech } from "./textPrep";
import { tts, ttsConfigured } from "#/ai/tts";
import { useVoice } from "./useVoice";

/**
 * Imperative voice singleton (voice-foundation design §5). Owns audio playback,
 * the browser-speech fallback, the generation guard, and cancel/pause/mute.
 * Callable from anywhere (React or a client-tool handler); reads reactive
 * gates from the useVoice store.
 */
function createVoiceEngine() {
  const guard = createGenerationGuard();
  let audio: HTMLAudioElement | null = null;
  let audioCtx: AudioContext | null = null;
  let ttsReady: boolean | null = null;
  let pendingResolve: (() => void) | null = null;

  function settle() {
    const r = pendingResolve;
    pendingResolve = null;
    r?.();
  }

  async function ensureTtsReady(): Promise<boolean> {
    if (ttsReady !== null) return ttsReady;
    try {
      ttsReady = (await ttsConfigured()).configured;
    } catch {
      ttsReady = false;
    }
    return ttsReady;
  }

  function stopPlayback() {
    if (audio) {
      audio.pause();
      audio.src = "";
      audio = null;
    }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }

  function speakViaBrowser(text: string, gen: number): Promise<void> {
    return new Promise<void>((resolve) => {
      pendingResolve = resolve;
      if (typeof speechSynthesis === "undefined") return settle();
      const u = new SpeechSynthesisUtterance(text);
      u.onend = () => { if (guard.isCurrent(gen)) settle(); };
      u.onerror = () => { if (guard.isCurrent(gen)) settle(); };
      speechSynthesis.speak(u);
    });
  }

  async function speakViaServer(text: string, voiceId: string | undefined, gen: number): Promise<void> {
    let res: Response;
    try {
      res = (await tts({ data: { text, voiceId } })) as unknown as Response;
    } catch {
      return speakViaBrowser(text, gen);
    }
    if (!guard.isCurrent(gen)) return;              // superseded during fetch — drop
    if (!res.ok) return speakViaBrowser(text, gen); // 503/502 → fallback
    const url = URL.createObjectURL(await res.blob());
    return new Promise<void>((resolve) => {
      pendingResolve = resolve;
      const el = new Audio(url);
      audio = el;
      el.onended = () => { if (guard.isCurrent(gen)) { URL.revokeObjectURL(url); settle(); } };
      el.onerror = () => { if (guard.isCurrent(gen)) { URL.revokeObjectURL(url); settle(); } };
      void el.play().catch(() => settle());
    });
  }

  return {
    unlock() {
      try {
        const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext });
        const AC = Ctx.AudioContext ?? Ctx.webkitAudioContext;
        if (AC) {
          audioCtx = audioCtx ?? new AC();
          void audioCtx.resume();
        }
        const silent = new Audio(
          "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA",
        );
        silent.volume = 0;
        void silent.play().catch(() => {});
      } catch { /* unlock is best-effort */ }
    },

    async speak(text: string, opts?: { voiceId?: string }): Promise<void> {
      const store = useVoice.getState();
      if (!store.voiceEnabled || store.muted) return;
      const clean = prepForSpeech(text);
      if (!clean) return;
      const gen = guard.next();     // supersede any prior speak
      stopPlayback();
      useVoice.setState({ speaking: true });
      try {
        if (await ensureTtsReady()) await speakViaServer(clean, opts?.voiceId, gen);
        else await speakViaBrowser(clean, gen);
      } finally {
        if (guard.isCurrent(gen)) useVoice.setState({ speaking: false });
      }
    },

    cancel() {
      guard.next();                 // invalidate in-flight speak
      stopPlayback();
      useVoice.setState({ speaking: false });
      settle();                     // force-resolve awaiters (pause() fires no `ended`)
    },

    pause() { audio?.pause(); if (typeof speechSynthesis !== "undefined") speechSynthesis.pause(); },
    resume() { void audio?.play().catch(() => {}); if (typeof speechSynthesis !== "undefined") speechSynthesis.resume(); },
    isSpeaking() { return useVoice.getState().speaking; },

    /** Test-only: force the server-TTS readiness flag. */
    __setTtsConfiguredForTest(v: boolean) { ttsReady = v; },
  };
}

export const voiceEngine = createVoiceEngine();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/voice/voiceEngine.test.ts`
Expected: PASS (2 tests). *(This task depends on Task 8's `useVoice`; if executed strictly in order, do Task 8 first or create a minimal `useVoice` stub. See note below.)*

> **Ordering note:** `voiceEngine` imports `useVoice`. If you implement strictly top-to-bottom, create `useVoice.ts` (Task 8) before running this task's tests, or the import fails. Both are committed together-adjacent; the subagent runner should treat Task 8 as a prerequisite of Task 7's test run.

- [ ] **Step 5: Commit**

```bash
git add src/ai/voice/voiceEngine.ts src/ai/voice/voiceEngine.test.ts
git commit -m "feat(voice): imperative voiceEngine — TTS playback, browser fallback, cancel/generation guard"
```

---

### Task 8: Voice UI store (`useVoice.ts`)

> **Do this before running Task 7's tests** (Task 7 imports it).

**Files:**
- Create: `src/ai/voice/useVoice.ts`
- Test: `src/ai/voice/useVoice.test.ts`

**Interfaces:**
- Consumes: `zustand` `create`.
- Produces: `useVoice` store with state `{ voiceEnabled: boolean; muted: boolean; paused: boolean; speaking: boolean; listening: boolean; conversationMode: boolean }` and actions `setVoiceEnabled(b)`, `setMuted(b)`, `setPaused(b)`, `setSpeaking(b)`, `setListening(b)`, `setConversationMode(b)`. Defaults: `voiceEnabled: true`, everything else `false`.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/voice/useVoice.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useVoice } from "./useVoice";

describe("useVoice", () => {
  beforeEach(() => {
    useVoice.setState({
      voiceEnabled: true, muted: false, paused: false,
      speaking: false, listening: false, conversationMode: false,
    });
  });

  it("defaults to voice enabled, nothing active", () => {
    const s = useVoice.getState();
    expect(s.voiceEnabled).toBe(true);
    expect(s.speaking).toBe(false);
    expect(s.conversationMode).toBe(false);
  });

  it("setters update state", () => {
    useVoice.getState().setVoiceEnabled(false);
    expect(useVoice.getState().voiceEnabled).toBe(false);
    useVoice.getState().setConversationMode(true);
    expect(useVoice.getState().conversationMode).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/voice/useVoice.test.ts`
Expected: FAIL — cannot find module `./useVoice`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/voice/useVoice.ts
import { create } from "zustand";

/**
 * Reactive voice UI state (voice-foundation design §6.1). The imperative work
 * lives in voiceEngine; this store only holds flags the UI renders from.
 */
interface VoiceState {
  voiceEnabled: boolean;
  muted: boolean;
  paused: boolean;
  speaking: boolean;
  listening: boolean;
  conversationMode: boolean;
  setVoiceEnabled: (b: boolean) => void;
  setMuted: (b: boolean) => void;
  setPaused: (b: boolean) => void;
  setSpeaking: (b: boolean) => void;
  setListening: (b: boolean) => void;
  setConversationMode: (b: boolean) => void;
}

export const useVoice = create<VoiceState>((set) => ({
  voiceEnabled: true,
  muted: false,
  paused: false,
  speaking: false,
  listening: false,
  conversationMode: false,
  setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
  setMuted: (muted) => set({ muted }),
  setPaused: (paused) => set({ paused }),
  setSpeaking: (speaking) => set({ speaking }),
  setListening: (listening) => set({ listening }),
  setConversationMode: (conversationMode) => set({ conversationMode }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/voice/useVoice.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/voice/useVoice.ts src/ai/voice/useVoice.test.ts
git commit -m "feat(voice): useVoice reactive store"
```

---

### Task 9: Session greeting flag on `useAssistant`

**Files:**
- Modify: `src/ai/useAssistant.ts`
- Test: `src/ai/useAssistant.test.ts` (create)

**Interfaces:**
- Consumes: existing `useAssistant`.
- Produces: adds `greetedThisSession: boolean` (default `false`) and `setGreeted(b: boolean): void` to the store.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/useAssistant.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useAssistant } from "./useAssistant";

describe("useAssistant greetedThisSession", () => {
  beforeEach(() => useAssistant.setState({ greetedThisSession: false }));

  it("defaults to not greeted", () => {
    expect(useAssistant.getState().greetedThisSession).toBe(false);
  });
  it("setGreeted flips it", () => {
    useAssistant.getState().setGreeted(true);
    expect(useAssistant.getState().greetedThisSession).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/useAssistant.test.ts`
Expected: FAIL — `greetedThisSession` / `setGreeted` undefined.

- [ ] **Step 3: Add the field to `src/ai/useAssistant.ts`**

In the `AssistantUIState` interface, add after `focusNonce: number;`:

```ts
  /** True once Al has greeted the broker this session (greeting fires once). */
  greetedThisSession: boolean;
  setGreeted: (greeted: boolean) => void;
```

In the `create(...)` store body, add after `focusNonce: 0,`:

```ts
  greetedThisSession: false,
  setGreeted: (greetedThisSession) => set({ greetedThisSession }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/useAssistant.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ai/useAssistant.ts src/ai/useAssistant.test.ts
git commit -m "feat(voice): greetedThisSession flag on useAssistant"
```

---

### Task 10: Hands-free STT loop (`useHandsFree.ts`)

**Files:**
- Create: `src/ai/voice/useHandsFree.ts`
- Test: `src/ai/voice/useHandsFree.test.ts` (covers the pure `assembleTranscript` helper only)

**Interfaces:**
- Consumes: `useVoice` (`setListening`, `setConversationMode`, reads `conversationMode`); `notify` from `#/lib/notify`; browser `SpeechRecognition`.
- Produces:
  - `assembleTranscript(results: Array<{ transcript: string }>): string` — pure: joins recognition segments, collapses whitespace, trims. (In the browser, callers pass `[...event.results].map(r => ({ transcript: r[0].transcript }))`.)
  - `useHandsFree(opts: { onSubmit: (text: string) => void }): { start: () => void; stopForCall: () => void; supported: boolean }` — the hook wiring the Web Speech API per design §6.2.

- [ ] **Step 1: Write the failing test**

```ts
// src/ai/voice/useHandsFree.test.ts
import { describe, it, expect } from "vitest";
import { assembleTranscript } from "./useHandsFree";

describe("assembleTranscript", () => {
  it("joins all segments in order (continuous mode keeps earlier words)", () => {
    expect(assembleTranscript([
      { transcript: "call " }, { transcript: "Marcus " }, { transcript: "today" },
    ])).toBe("call Marcus today");
  });
  it("collapses whitespace and trims", () => {
    expect(assembleTranscript([{ transcript: "  hey   " }, { transcript: " there " }])).toBe("hey there");
  });
  it("returns empty string for no segments", () => {
    expect(assembleTranscript([])).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/ai/voice/useHandsFree.test.ts`
Expected: FAIL — cannot find module `./useHandsFree`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ai/voice/useHandsFree.ts
import { useCallback, useEffect, useRef } from "react";
import { useVoice } from "./useVoice";
import { notify } from "#/lib/notify";

const SILENCE_MS = 3200;   // pause after speech starts → submit
const NO_START_MS = 10000; // wait this long for speech to begin at all

/** Pure: rebuild the full transcript from all recognition segments. */
export function assembleTranscript(results: Array<{ transcript: string }>): string {
  return results.map((r) => r.transcript).join("").replace(/\s+/g, " ").trim();
}

type SpeechRecognitionCtor = new () => {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Hands-free mic loop (voice-foundation design §6.2). Own silence timer, never
 * a perpetually-hot mic. Live transcript is surfaced by the caller via onSubmit
 * of interim text is NOT sent — only the final transcript on silence.
 */
export function useHandsFree(opts: { onSubmit: (text: string) => void }) {
  const setListening = useVoice((s) => s.setListening);
  const setConversationMode = useVoice((s) => s.setConversationMode);
  const recRef = useRef<ReturnType<SpeechRecognitionCtor> | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef = useRef("");
  const supported = typeof window !== "undefined" && getRecognitionCtor() !== null;

  const clearTimers = useCallback(() => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (startTimer.current) clearTimeout(startTimer.current);
    silenceTimer.current = null;
    startTimer.current = null;
  }, []);

  const teardown = useCallback(() => {
    clearTimers();
    recRef.current?.abort();
    recRef.current = null;
    setListening(false);
  }, [clearTimers, setListening]);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      notify({ title: "Voice input isn't supported here", description: "Type your message instead." });
      setConversationMode(false);
      return;
    }
    const rec = new Ctor();
    recRef.current = rec;
    transcriptRef.current = "";
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;

    const finish = () => {
      clearTimers();
      const text = transcriptRef.current.trim();
      teardown();
      if (text) opts.onSubmit(text);
    };

    startTimer.current = setTimeout(() => { if (!transcriptRef.current) teardown(); }, NO_START_MS);

    rec.onresult = (e) => {
      const segs = Array.from({ length: e.results.length }, (_, i) => ({ transcript: e.results[i][0].transcript }));
      transcriptRef.current = assembleTranscript(segs);
      if (startTimer.current) { clearTimeout(startTimer.current); startTimer.current = null; }
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(finish, SILENCE_MS);
    };
    rec.onerror = (e) => { if (e.error !== "no-speech") teardown(); }; // keep waiting on no-speech
    rec.onend = () => { /* silence timer drives submission; nothing to do here */ };

    setListening(true);
    try { rec.start(); } catch { teardown(); }
  }, [clearTimers, opts, setConversationMode, setListening, teardown]);

  /** Hard stop for when a live call opens (Phase 3) — no mic over call audio. */
  const stopForCall = useCallback(() => {
    teardown();
    setConversationMode(false);
  }, [teardown, setConversationMode]);

  useEffect(() => () => teardown(), [teardown]); // cleanup on unmount

  return { start, stopForCall, supported };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/ai/voice/useHandsFree.test.ts`
Expected: PASS (3 tests). The hook body is verified in the manual checklist (Task 12).

- [ ] **Step 5: Commit**

```bash
git add src/ai/voice/useHandsFree.ts src/ai/voice/useHandsFree.test.ts
git commit -m "feat(voice): hands-free STT loop (Web Speech API) + assembleTranscript"
```

---

### Task 11: Greeting orchestration + audio unlock (`useGreeting.ts`)

**Files:**
- Create: `src/ai/voice/useGreeting.ts`

**Interfaces:**
- Consumes: `useAssistant` (`open`, `greetedThisSession`, `setGreeted`); `useVoice` (`voiceEnabled`, `setConversationMode`); `voiceEngine`; `composeGreeting`; `buildAssistantContext` (`#/ai/context`).
- Produces: `useGreeting(opts: { onGreeting: (text: string) => void; onEnterConversation: () => void }): void` — a hook mounted once in `AssistantSidebar` that (a) arms audio-unlock on first gesture at mount, and (b) fires the once-per-session greeting when the sidebar first opens.

- [ ] **Step 1: Write the implementation** *(no unit test — this is browser-glue orchestration; `composeGreeting` is already tested in Task 5, and behavior is verified in the Task 12 manual checklist)*

```ts
// src/ai/voice/useGreeting.ts
import { useEffect } from "react";
import { useAssistant } from "#/ai/useAssistant";
import { useVoice } from "./useVoice";
import { voiceEngine } from "./voiceEngine";
import { composeGreeting } from "./greeting";
import { buildAssistantContext } from "#/ai/context";

/**
 * Proactive spoken greeting (voice-foundation design §6.3). Fires once per
 * session the first time the assistant opens: renders the greeting, speaks it
 * (if voice is on), then enters hands-free conversation. Also arms audio-unlock
 * on the first user gesture so real TTS — not the robotic fallback — plays.
 */
export function useGreeting(opts: {
  onGreeting: (text: string) => void;
  onEnterConversation: () => void;
}) {
  const { onGreeting, onEnterConversation } = opts;

  // Arm audio unlock once, at mount, before any greeting can fire.
  useEffect(() => {
    const unlock = () => {
      voiceEngine.unlock();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const open = useAssistant((s) => s.open);
  const greeted = useAssistant((s) => s.greetedThisSession);
  const setGreeted = useAssistant((s) => s.setGreeted);

  useEffect(() => {
    if (!open || greeted) return;
    setGreeted(true);
    const text = composeGreeting(buildAssistantContext());
    onGreeting(text);
    if (!useVoice.getState().voiceEnabled) return; // show only, no speech/mic
    void voiceEngine.speak(text).then(() => {
      useVoice.getState().setConversationMode(true);
      onEnterConversation();
    });
  }, [open, greeted, setGreeted, onGreeting, onEnterConversation]);
}
```

- [ ] **Step 2: Type-check**

Run: `bun --bun run build` (or the project's `tsc` step) and confirm no new type errors in `src/ai/voice/useGreeting.ts`.
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add src/ai/voice/useGreeting.ts
git commit -m "feat(voice): greeting orchestration + audio-unlock arming"
```

---

### Task 12: Wire voice controls into `AssistantSidebar`

**Files:**
- Modify: `src/components/ai/AssistantSidebar.tsx`

**Interfaces:**
- Consumes: `useVoice`, `voiceEngine`, `useHandsFree`, `useGreeting`; `useHotkey` (`@tanstack/react-hotkeys`); FontAwesome `pro-regular` icons.
- Produces: the wired UI — voice on/off toggle, mic button, speak-the-reply, live transcript, Escape kill-switch, greeting on first open. **No layout restructure** — additive controls only.

- [ ] **Step 1: Add imports and hooks (top of the component)**

Add to the icon import from `@fortawesome/pro-regular-svg-icons`: `faMicrophone`, `faVolumeHigh`, `faVolumeXmark`.

Add imports:

```tsx
import { useHotkey } from "@tanstack/react-hotkeys";
import { useVoice } from "#/ai/voice/useVoice";
import { voiceEngine } from "#/ai/voice/voiceEngine";
import { useHandsFree } from "#/ai/voice/useHandsFree";
import { useGreeting } from "#/ai/voice/useGreeting";
```

Inside `AssistantSidebar`, after the existing `useChat` destructure, add:

```tsx
  const voiceEnabled = useVoice((s) => s.voiceEnabled);
  const setVoiceEnabled = useVoice((s) => s.setVoiceEnabled);
  const listening = useVoice((s) => s.listening);
  const conversationMode = useVoice((s) => s.conversationMode);
  const setConversationMode = useVoice((s) => s.setConversationMode);
  const speakNextReplyRef = useRef(false);

  // Hands-free: submit final transcript to Al, and mark that the reply should
  // be spoken back so the loop can re-arm after Al finishes.
  const { start: startHandsFree, stopForCall } = useHandsFree({
    onSubmit: (text) => { speakNextReplyRef.current = true; send(text); },
  });
  void stopForCall; // exported for Phase 3; referenced to satisfy lint

  // Greeting: render + speak once per session on first open; then open the mic.
  useGreeting({
    onGreeting: (text) =>
      setMessages((prev) => [
        ...prev,
        { id: `greeting-${Date.now()}`, role: "assistant", parts: [{ type: "text", content: text }] },
      ]),
    onEnterConversation: () => startHandsFree(),
  });

  // Speak Al's reply when a voice turn completes, then re-arm the mic.
  const prevLoading = useRef(isLoading);
  useEffect(() => {
    const finished = prevLoading.current && !isLoading;
    prevLoading.current = isLoading;
    if (!finished || !speakNextReplyRef.current) return;
    speakNextReplyRef.current = false;
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    const text = last?.parts.filter((p) => p.type === "text").map((p) => (p as { content: string }).content).join("") ?? "";
    if (!text || !voiceEnabled) return;
    void voiceEngine.speak(text).then(() => {
      if (useVoice.getState().conversationMode) setTimeout(() => startHandsFree(), 350);
    });
  }, [isLoading, messages, voiceEnabled, startHandsFree]);

  // Presenter kill-switch: Escape silences Al instantly and ends conversation.
  useHotkey("Escape", () => { voiceEngine.cancel(); setConversationMode(false); });
```

> If `send`, `setMessages`, `messages`, `isLoading` aren't already in scope at that point, move this block below their declarations. `send` is defined mid-component today — place this block **after** the `send` `useCallback`.

- [ ] **Step 2: Add the voice toggle to the header**

In the header block, immediately before the existing scope `<Badge>`, add:

```tsx
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={voiceEnabled ? "Turn voice off" : "Turn voice on"}
          onClick={() => {
            const next = !voiceEnabled;
            setVoiceEnabled(next);
            if (!next) { voiceEngine.cancel(); setConversationMode(false); }
          }}
        >
          <FontAwesomeIcon icon={voiceEnabled ? faVolumeHigh : faVolumeXmark} />
        </Button>
```

- [ ] **Step 3: Add the mic button to the composer**

In the `<form>` input row, before the send/stop button, add:

```tsx
        <Button
          type="button"
          variant={listening ? "primary" : "outline"}
          size="icon"
          aria-label={listening ? "Listening — tap to stop" : "Speak to the assistant"}
          onClick={() => {
            if (listening) { voiceEngine.cancel(); setConversationMode(false); }
            else { setConversationMode(true); startHandsFree(); }
          }}
        >
          <FontAwesomeIcon icon={faMicrophone} />
        </Button>
```

- [ ] **Step 4: Show a listening indicator**

In the messages area, after the `isLoading` "Working…" block, add:

```tsx
        {listening && (
          <div className="text-buildout-blue-700 small d-inline-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faMicrophone} beatFade />
            Listening…
          </div>
        )}
```

- [ ] **Step 5: Type-check + full test run**

Run: `bun --bun run test`
Expected: all suites PASS (existing + new voice suites).

Run: `bun --bun run build`
Expected: builds clean, **no new TypeScript warnings** (scan the output — a project rule).

- [ ] **Step 6: Manual verification (browser — no Playwright)**

Start `bun --bun run dev`, then verify with `ELEVENLABS_API_KEY` set (free tier) and `ANTHROPIC_API_KEY` set:
1. Open the assistant → the greeting appears **and is spoken** in the ElevenLabs voice; the mic opens (Listening…).
2. Speak a short request → after a ~3 s pause it submits; Al replies **and speaks**; the mic re-arms.
3. Press **Escape** mid-sentence → speech stops instantly, conversation ends, mic closes.
4. Toggle the header speaker **off** → no speech; greeting text still shows on next session.
5. Unset `ELEVENLABS_API_KEY`, restart → greeting still speaks via the **browser** voice (fallback).
6. Unset `ANTHROPIC_API_KEY`, restart → greeting still shows and speaks (deterministic); replies degrade per Phase 1.

- [ ] **Step 7: Commit**

```bash
git add src/components/ai/AssistantSidebar.tsx
git commit -m "feat(voice): wire greeting, TTS replies, hands-free mic, and kill-switch into the sidebar"
```

---

## Self-Review

**Spec coverage (design §-by-§):**
- §3 module layout → Tasks 1–12 create exactly those files. ✓
- §4 TTS server fn (provider seam, 503/502, whitelist, 4000 cap, ttsConfigured, env) → Task 4 + Task 2 env. ✓
- §4.1 ttsConfig (Al voice, model, settings, owner pools) → Task 2. ✓
- §5 voiceEngine (unlock, speak, cancel, pause/resume, generation guard, browser fallback, text prep, speak gate) → Tasks 6 + 7 (+ 1 textPrep). ✓
- §5.1 ownerVoiceFor (stable gendered, no playback) → Task 3. ✓
- §6.1 useVoice + greetedThisSession → Tasks 8 + 9. ✓
- §6.2 hands-free (timers, transcript rebuild, re-arm, stopForCall, unsupported toast) → Task 10 + wiring in 12. ✓
- §6.3 greeting (deterministic, once/session, audio unlock, show-only when off) → Tasks 5 + 11. ✓
- §6.4 controls (toggle, mic, pause/stop, Escape kill-switch) → Task 12. ✓
- §7 degradation matrix → Task 4 (503), Task 7 (fallback), Task 10 (unsupported), Task 11 (deterministic greeting); verified in Task 12 manual steps 5–6. ✓
- §8 testing (textPrep, ownerVoice, composeGreeting, generation guard, tts) → Tasks 1,3,5,6,4. ✓
- §5.1/§10 owner playback deferred to Phase 3 → `stopForCall` + `ownerVoiceFor` built, not wired. ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code; manual-only paths are explicitly listed with click-by-click steps. ✓

**Type consistency:** `voiceEngine.speak/cancel/unlock/pause/resume/isSpeaking`, `useVoice` setter names, `resolveVoiceId`, `synthesizeResponse`, `composeGreeting`, `ownerVoiceFor`, `assembleTranscript`, `useHandsFree({onSubmit}) → {start, stopForCall, supported}`, `useGreeting({onGreeting,onEnterConversation})`, `greetedThisSession/setGreeted` — names used in later tasks match their defining tasks. ✓

**Known ordering constraint:** Task 7 (`voiceEngine`) imports Task 8 (`useVoice`) — the plan flags this in both tasks; implement `useVoice` before running `voiceEngine`'s tests.
