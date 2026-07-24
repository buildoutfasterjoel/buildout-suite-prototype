# AI Phase 1 — Generative Agent Layer + Live-Store Grounding

**Status:** Approved design, ready for implementation plan
**Date:** 2026-07-23
**Program:** AI & Voice integration (see `AI-VOICE-PRD.md`, `AI-VOICE-REQUIREMENTS.md`)
**Branch:** `joel/ai-tools`

---

## 1. Context

The `joel/ai-tools` branch already ships the correct AI *chassis* the requirements doc
prescribes (§1.1, §4, §8.4):

- `aiChat` server relay (`src/ai/relay.ts`) holds the Anthropic key server-side, streams
  SSE, and passes **tool definitions only** — so Claude's tool calls stream to the browser
  and execute against the live Zustand store. No data leaves the client.
- 16 CRUD/query client tools (`src/ai/toolDefs.ts` + `src/ai/tools.ts`) wired to the real
  action/selector catalog, a docked chat sidebar (`AssistantSidebar.tsx`) with interactive
  result cards, and an OmniSearch "Ask AI" hand-off.

**The gap:** every existing tool is CRUD/query. There are **zero generative (`.server()`)
tools**. The spec's highest-value "Al *reasons and drafts*" capabilities do not exist yet.

This is the AI program's first sub-project. It is deliberately scoped to the **"real
tools"** — the generative capabilities that operate on the prototype's live data — so that
during the keynote, any off-script request still actually does the thing against the store
rather than breaking. Voice (Phase 2), the live-call simulation (Phase 3), and the hero-arc
orchestration (Phase 4) build on top of this layer and are out of scope here.

### Verified ground truth

- `zod@4.4.3` is installed; `@tanstack/ai@0.40` exposes `outputSchema` and `.server()`.
  The spec's typed-generation pattern maps directly — no hand-rolled JSON parsing.
- Data layer already supports the writes: `createTask`, `createContact`, `createDeal`,
  `createCallList`, `createEmailDraft`, `updateContact` (`src/data/actions.ts`). Contacts
  carry a `notes` field; tasks are first-class. A thin `addNote` action is the only new
  write primitive needed.
- Grounding scaffolding exists (`src/components/dashboard/dashboardData.ts` `FOCUS_SIGNAL`,
  `DASHBOARD_TASKS`; `TodayPlanner`) but is **static seed data**, not computed from the
  live store.

---

## 2. Goals & non-goals

### Goals
- Add the generative capability layer as `.server()`-backed one-shot generators returning
  Zod-typed objects, consumed both in-context (screen affordances) and through the Al agent.
- Ground the agent/chat in a **live-store snapshot**, not static fixtures.
- Add the missing pure-client agent tools (`add_note`, `create_task`, `find_contact`,
  `plan_my_day`) and a `start_call` stub for Phase 3.
- Never hard-fail: replace the current no-key 500 with graceful behavior.

### Non-goals (later phases)
- Voice (TTS/STT/hands-free/greeting) — Phase 2.
- Live-call role-play simulation (`call-turn`, dialing UI, hang-up recap) — Phase 3.
- Hero-arc orchestration (scripted signal → call → recap → inbound email → underwrite →
  BOV) and the self-arriving simulated owner email (`draft-reply`, §3.6) — Phase 4.
- Full deterministic keyless parity for every capability (see §6).

---

## 3. Architecture — one generator, two consumers

The current relay stays **untouched** (definitions-only, client-executed). Generation is a
separate additive layer:

> **Each generative capability is one `createServerFn` that runs a one-shot
> `chat({ adapter, outputSchema })` with a Zod schema and returns a typed object.** The
> Anthropic key stays server-side, exactly like `relay.ts`.

Each generator has **two consumers**, with no duplicated capability logic:

1. **In-context** — the screen affordance calls the server fn directly and applies the
   result to that screen (e.g. the Listings filter box calls `generateFilter`, then applies
   the returned filter to the grid).
2. **Through the agent** — a client tool's `execute` calls the *same* server fn, then
   applies the result to the store/UI and returns a compact summary to the model.

### Module layout
```
src/ai/
  relay.ts            (unchanged — agent loop transport)
  systemPrompt.ts     (extended — grounding + routing rules)
  toolDefs.ts         (extended — new tool schemas)
  tools.ts            (extended — new client tools; generative ones call server fns)
  generate/
    index.ts          (barrel)
    schemas.ts        (Zod schemas for every capability's I/O contract)
    prompts.ts        (system prompts per capability, per §3.x behavioral rules)
    filter.ts         (generateFilter        → §3.1)
    email.ts          (generateEmail         → §3.2)
    callList.ts       (generateCallList      → §3.3)
    doc.ts            (generateDoc           → §3.4, replaces deterministic client report)
    prospect.ts       (generateProspectAssessment → §3.5)
    contactBrief.ts   (generateContactBrief  → §3.10)
    strategy.ts       (generateStrategy      → §3.9)
    fallbacks.ts      (deterministic fallbacks for filter + callList)
  context.ts          (buildAssistantContext — live-store snapshot, §6.4)
```
A shared helper wraps `chat({ outputSchema })` + the no-key branch + a `try/catch` that
routes to the per-capability fallback (or a "not configured" object).

---

## 4. Capability catalog (Phase 1)

Each generator's system prompt encodes the behavioral rules from the cited spec section.
I/O shapes are the spec's contracts, expressed as Zod schemas in `generate/schemas.ts`.

| Capability | Server generator | In-context entry point | Agent tool | Fallback (§6) |
|---|---|---|---|---|
| NL listing filter (§3.1) | `generateFilter` | filter box on Listings grid | `filter_listings` | deterministic |
| Draft email (§3.2) | `generateEmail` | "Draft with Al" on property/deal | `draft_email` | "not configured" |
| Ranked call list (§3.3) | `generateCallList` | "Build call list" on People | `build_call_list` | deterministic |
| Marketing doc (§3.4) | `generateDoc` | "Marketing package" on property | `build_marketing_package` | "not configured" |
| Prospect assessment (§3.5) | `generateProspectAssessment` | off-market / prospect card | (via chat) | "not configured" |
| Contact brief (§3.10) | `generateContactBrief` | "Brief me" on contact page | `research_contact` / `answer_about_contact` | local fields |
| Book strategy (§3.9) | `generateStrategy` | dashboard "Ask about my book" | `analyze_book` | local ranking |

### 4.1 Output contracts (Zod)

Mirror the requirements doc exactly:

- **filter** → `{ search, savedView, assetClass|null, saleLease|null, explanation }` (§3.1)
- **email** → `{ subject, to[], body, signature }`; body < 140 words; honor supplied
  recipients (first names + real emails), else invent 1–3 plausible reps (§3.2)
- **callList** → `{ headline, calls: [{ contactId, score 0–100, reason <90 chars }] }`;
  5–8 contacts; every `contactId` must be a supplied id (§3.3)
- **doc** → `{ tagline, summary, highlights[4], callToAction }` (§3.4)
- **prospect** → `{ verdict: strong|moderate|challenging, headline, reasoning }`; honest,
  can say "challenging" (§3.5)
- **contactBrief** → `{ brief }`; two modes — targeted answer if `question` present, else the
  8-section ALL-CAPS long-form (§3.10)
- **strategy** → `{ answer }` light-HTML; names real contacts with why + next action,
  grounded only in the supplied book snapshot (§3.9)

### 4.2 `build_marketing_package` (mixed tool)

Client tool whose `execute` awaits `generateDoc` + `generateEmail` (+ financial figures
from the store), then renders the bundled deliverables. Requires an address; if missing,
asks for it, then owner/asset type — one short question at a time — before generating (§4.2
routing rule).

---

## 5. New pure-client agent tools

No key required; run against the store.

| Tool | Required input | Behavior |
|---|---|---|
| `add_note` | `contact_name`, `note_text` | Resolve contact → append to `notes` via new `addNote` action. If a note reads task-oriented, the app auto-creates a follow-up task; the client de-dupes so a paired `add_note` + `create_task` drops the `create_task` (§4.3). |
| `create_task` | `task_title` (opt: `contact_name`, `due` NL) | Parse `due` to a real date, create task via `createTask`, optionally attached to the contact. |
| `find_contact` | `query` | Local retrieval → render a clickable result card (reuses existing card rendering). |
| `plan_my_day` | *(none)* | Compute the top move (headline + action) from the live-store context; render it. (Spoken in Phase 2.) |
| `start_call` | `contact_name` | **Phase 1 stub:** announce + navigate to the contact. Full live-call flow lands in Phase 3. Definition/description written now so routing ("call X now" vs "remind me to call X" → `create_task") is correct from the start. |

Routing distinctions are encoded in tool **descriptions** (load-bearing per §4.2): reminder
to call *later* → `create_task`; broad "tell me about" → `research_contact` vs specific
question → `answer_about_contact`; any portfolio/strategy question not about one named
person → `analyze_book` (never refuse for lack of a tool); "build my call list" →
`build_call_list` immediately, no confirmation.

New write primitive: `addNote(contactId, text)` in `src/data/actions.ts` (append with
timestamp), with a unit test.

---

## 6. Grounding & degradation

### 6.1 Live-store context (`src/ai/context.ts`)
`buildAssistantContext()` composes a **capped** snapshot from the live Zustand store per
§6.4: broker identity, task buckets (overdue / due-today) from real `Task`/`DealTask`
records, pipeline totals + stage-weighted forecast from real deals, and top contacts
(name, role, entity, relationship, last-touch, short note). Injected into the agent system
prompt (~3 KB cap) and passed to `generateStrategy`/chat (~6 KB cap). Replaces reliance on
the static `FOCUS_SIGNAL` for grounding; the scripted overnight signal remains a Phase-4
concern.

### 6.2 Degradation stance (approved)
The spec treats keyless fallbacks as non-negotiable, but this always demos with a key.
Build **real deterministic fallbacks only where a keyless failure breaks a demo click**:
- `generateFilter` → dump the whole query into `search` with a plain explanation.
- `generateCallList` → local ranking by recency/stage, top 5–8 with generic reasons.

Every other generator returns a clean **"AI not configured"** typed object the UI renders
as a normal state — never a 500. The current `relay.ts` no-key 500 is replaced with the
same graceful surface so the agent path degrades to an informative message.

---

## 7. UI wiring (in-context entry points)

- **Listings grid** — natural-language filter box above the grid; on submit calls
  `generateFilter`, applies the returned filter, shows the one-sentence explanation.
- **Property / deal** — "Draft with Al" action → `generateEmail`, opens the resulting draft
  (editable) in the Email module / a draft view.
- **People** — "Build call list" → `generateCallList`, applies the ranked order to the
  People grid and enables power-dial affordance (dialer itself is Phase 3).
- **Property** — "Marketing package" → `build_marketing_package` deliverables view.
- **Off-market / prospect card** — "Is this worth a call?" → `generateProspectAssessment`
  verdict card.
- **Contact page** — "Brief me" → `generateContactBrief` long-form; a question field routes
  to the targeted-answer mode.
- **Dashboard** — "Ask about my book" → `generateStrategy` rendered answer.
- **Chat sidebar** — brief/strategy render as formatted assistant messages (light HTML per
  §6.3); email/doc/call-list results render as their respective cards/previews.

All UI uses Blueprint components + Bootstrap utilities + `pro-regular` FontAwesome icons per
project conventions.

---

## 8. Testing

Vitest units following existing `src/data/*.test.ts` patterns:
- Each generator: schema-validation of a representative payload + its fallback path (model
  calls mocked; no live-API calls in tests).
- New `addNote` action (append semantics, timestamp).
- `create_task` natural-language due-date parsing (relative dates → absolute).
- `buildAssistantContext` size cap and shape.
- The add_note/create_task de-dup rule.

---

## 9. Risks & open items

- **TanStack AI structured-output API specifics** (`chat({ outputSchema })` exact signature
  in 0.40) to be confirmed against installed types during implementation; the shared
  generator helper isolates any adaptation.
- **`generateDoc` replacement** — current deterministic client-report generator is used by
  the existing `generateDoc` tool; replacing it must preserve the `reportPath` behavior the
  chat card relies on.
- **Contact "last-touch" / relationship data** completeness for grounding — verify the
  store carries enough per contact; degrade gracefully where fields are absent.

---

## 10. Downstream phases (for reference, not this spec)

- **Phase 2 — Voice foundation:** provider-swappable TTS server fn (ElevenLabs/OpenAI +
  browser `SpeechSynthesis` fallback), STT hands-free loop, speak lifecycle/controls,
  owner-voice selection, proactive greeting + audio unlock.
- **Phase 3 — Live-call simulation:** dialing→ringing→connected UI, `call-turn` role-play
  server fn, suggested lines, transcript, hang-up recap → tasks/opportunity.
- **Phase 4 — Hero-arc orchestration:** scripted director sequencing the end-to-end demo,
  self-arriving simulated owner email (`draft-reply`), file attachments, underwrite (reusing
  Cactus), BOV send + timeline.
