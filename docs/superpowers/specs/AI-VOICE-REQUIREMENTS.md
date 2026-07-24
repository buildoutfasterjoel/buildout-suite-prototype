# Buildout AI & Voice — Implementation Requirements

**Audience:** The engineering agent building the new prototype.
**Stack:** TanStack Start + React, with **TanStack AI** (`@tanstack/ai` + `@tanstack/ai-react`) orchestrating the LLM work through a **Claude adapter** (Anthropic key held server-side).
**Goal:** Reproduce the AI-assistant ("Al") and voice features of the existing prototype at feature parity. This document describes *what* each capability does and its input/output contract — not how the old prototype was built. There is nothing to port; build it fresh, idiomatically, on the new stack.

**Altitude:** Treat the **behavior and data shapes** as the spec (they define parity), and the **wiring** as yours to decide. Where this doc names an "endpoint" or a request/response body, read it as *"a capability with this input and this output shape"* — map it onto whatever TanStack AI primitive fits (an agent tool, a server function, the `useChat` transport). Don't hand-roll plumbing that TanStack AI already provides (the agent loop, tool dispatch, client-tool execution, streaming, approval gates).

> **Read the companion PRD (`AI-VOICE-PRD.md`) first** for the product intent and the signature flows. This document is the buildable spec.

---

## 0. How to read this document

- Every AI capability is defined by: **Purpose · Trigger · Input · Output contract · Behavioral rules · Fallback.**
- Output contracts describe the **shape the capability must produce**. Prefer TanStack AI typed tool results / structured output to get these shapes safely. If you instead prompt for raw JSON, ask for **strict JSON only** (no prose, no fences), strip accidental ``` fences before parsing, and fall back to a safe default object if parsing fails.
- "The model" = Claude via the TanStack AI Claude adapter (§2). "Server-side" = a TanStack Start server function or a TanStack AI **server tool** — anywhere the Anthropic key is in scope and the browser is not.
- All examples use the demo persona (broker "John Whitfield," Charleston SC). Keep them data-driven, not hard-coded.

---

## 1. Architecture requirements

### 1.1 Non-negotiables (regardless of wiring)

1. **Keys never reach the client.** The Anthropic (and TTS) key lives in server-side env only. In TanStack AI terms: the Claude adapter runs server-side; the browser talks to your TanStack Start server functions / the `useChat` server transport, never to Anthropic directly. Client tools that need secrets must round-trip through the server.
2. **Graceful degradation is a hard requirement.** With **no keys set**, the product still runs end-to-end. If the LLM key is absent, each capability falls back to the deterministic behavior described per capability. If the TTS key is absent, voice-out falls back to the browser `SpeechSynthesis` API. Surface "not configured" as a normal state, not an error the user sees.
3. **Fallbacks live client-side.** Every AI call site catches a failure (missing key, network, provider error) and runs a local, deterministic substitute so nothing ever hard-fails.

### 1.2 Where each capability lives in TanStack AI

The old prototype exposed each of these as a separate REST endpoint and hand-rolled the tool-calling loop. **You should not.** Map each capability to its natural TanStack AI home:

| Capability | § | Natural TanStack AI home |
|---|---|---|
| The Al agent (primary brain) | 4 | An **agent** using the Claude adapter + the **agent loop** (Agentic Cycle). Its actions are **tools** (below). This is the spine; most things below are its tools or are reachable through it. |
| add_note, create_task, navigate_to_contact, start_call, find_contact, plan_my_day, build_call_list | 4 | **Client tools** — they mutate app state, navigate, open the dialer, or update a grid in the browser. |
| research_contact / answer_about_contact → contact brief | 3.10 | **Server tool** (needs the key) invoked by the agent. |
| analyze_book → strategy | 3.9 | **Server tool** invoked by the agent. |
| build_marketing_package | 3.4/3.2 | A tool that composes the doc + email server tools. |
| Natural-language listing filter | 3.1 | **Server function** (one-shot structured generation) called from the listings screen. |
| Draft outreach email | 3.2 | **Server function / server tool** (one-shot). |
| Ranked call list | 3.3 | **Server function / server tool** (one-shot). |
| Marketing doc / flyer | 3.4 | **Server function / server tool** (one-shot). |
| Cold-prospect callability | 3.5 | **Server function** (one-shot). |
| Simulated owner email reply | 3.6 | **Server function** (one-shot). |
| Live-call owner turn + suggestions | 3.7 | **Server function** (short chat turn), or a small dedicated chat instance. |
| Open-ended "Ask Al" chat | 3.8 | The **`useChat`** conversation surface (also the agent's conversational fallback). |
| Text-to-speech | 5.1 | **Server function** returning audio bytes (not an LLM/TanStack-AI concern). |

Naming, routing, and file layout are yours. What must hold is the **behavior and I/O shape** of each capability (§3–§5) and the **agent routing rules** (§4).

### 1.3 The two LLM interaction shapes

Everything reduces to two shapes; TanStack AI supports both natively:

- **One-shot structured generation** — a system prompt + a single user payload → a typed object or text. Used by the standalone capabilities (filter, draft-email, call-list, doc, prospect-assessment, draft-reply, contact-brief, strategy, call-turn). Prefer typed tool/structured output to guarantee the shape.
- **Agentic chat** — a running conversation + tool schemas, with the **agent loop** deciding when to call tools and TanStack AI dispatching them (client or server). Used by the Al agent (§4). Let the library run the loop; don't reconstruct "return tool_use blocks, then execute on the client" by hand.

Keep responses modest in length per capability (see each). Favor settings that keep structured output stable.

---

## 2. Provider guidance

The stack decision is made: **Claude via the TanStack AI Claude adapter, key server-side.** Keep it behind the adapter so a swap stays cheap, but you don't need to design for provider-agnosticism beyond that.

- **LLM / agent:** Claude (Anthropic) through the TanStack AI Claude adapter, for both one-shot generations and the tool-calling agent loop. Use the latest capable Claude model available to the key.
- **Text-to-speech:** A **steerable, natural** TTS model (one that accepts a delivery/persona `instructions` field) — this is *separate from* the Claude/TanStack-AI path and lives in its own server function. *Recommended:* OpenAI `gpt-4o-mini-tts`, falling back to `tts-1-hd` → `tts-1`, output MP3. Steerability is what makes "Al" sound warm rather than robotic; any natural TTS works.
- **Speech-to-text:** The **browser Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`). No server or provider needed. Degrade cleanly where unsupported (show a "type instead" message).

---

## 3. AI capabilities

### 3.1 Natural-language listing filter — `POST /api/ai/filter`

**Purpose:** Convert a plain-English listings query into a structured filter the grid applies.
**Trigger:** Broker types a query in the listings AI filter box.
**Input:** `{ "query": string }`
**Output contract:**
```json
{
  "search": "free-text for name/address/city/state/zip (may be empty)",
  "savedView": "all | active-listings | under-contract | my-deals | chicago | stale",
  "assetClass": "Retail | Office | Multifamily | Industrial | Land | null",
  "saleLease": "Sale | Lease | null",
  "explanation": "one-sentence plain-English summary of what was filtered to"
}
```
**Behavioral rules (system prompt intent):**
- Map city mentions → `search`. "stale/old/lingering" → `savedView:"stale"`. "active" → `active-listings`. "my deals/mine" → `my-deals`.
- Asset words map to `assetClass`; "for sale/asking price" → `saleLease:"Sale"`, "lease/$ per SF" → `"Lease"`.
- If unclear, leave fields null/empty and say so in `explanation`.
- Return the raw JSON object only.
**Fallback:** Put the whole query into `search`, set an explanation like "showing everything matching '<query>'."

---

### 3.2 Draft outreach email — `POST /api/ai/draft-email`

**Purpose:** Draft a broker outreach email about a property.
**Input:** `{ "property": {…}, "intent": string, "recipients": [{ "name", "company", "role", "email" }] }`
**Output contract:**
```json
{
  "subject": "string (< 70 chars)",
  "to": ["First Last <email@company.com>", "..."],
  "body": "string (email body, no signature)",
  "signature": "string (short broker sign-off)"
}
```
**Behavioral rules:**
- Tone: warm but direct, American CRE conventions, no salesy fluff. Reference 1–2 concrete property details. End with a clear next step. Body **< 140 words**.
- **Recipient handling:** if `recipients` is non-empty, address them by first name and use their real emails exactly — don't invent extras. If empty, invent 1–3 plausible reps at major brokerages as the audience.
**Fallback:** `{ subject:"Outreach", body:<model text or template>, to:[], signature:"" }`.

---

### 3.3 Ranked call list — `POST /api/ai/call-list`

**Purpose:** Pick and rank the best people to call about a property/intent from the CRM pool.
**Input:** `{ "property": {…}, "intent": string, "contacts": [{ "id", "name", "role", "market", "assetFocus", "lastInteraction", … }] }` — the client sends the contact pool.
**Output contract:**
```json
{
  "headline": "one sentence on who was targeted",
  "calls": [ { "contactId": number, "score": 0-100, "reason": "string < 90 chars" } ]
}
```
**Behavioral rules:** Return **5–8** contacts ranked by likelihood to convert, using role, market, asset focus, and last-interaction recency. `contactId` must be one of the supplied ids.
**Client behavior:** Apply the ranked list to the People grid and enable "Start calling" to power-dial through it.
**Fallback:** Rank the supplied contacts locally by recency/stage and return the top few with generic reasons.

---

### 3.4 Marketing doc / flyer — `POST /api/ai/draft-doc`

**Purpose:** Generate a one-page marketing flyer spec for a property.
**Input:** `{ "property": {…}, "docType": "marketing_flyer" | … }`
**Output contract:**
```json
{
  "tagline": "hook < 70 chars",
  "summary": "2-3 sentence positioning",
  "highlights": ["bullet < 70 chars", "…4 total"],
  "callToAction": "next step < 60 chars"
}
```
**Behavioral rules:** Confident, factual, broker-grade; no fluff. Exactly ~4 highlights.
**Fallback:** `{ tagline: property.name, summary:<text>, highlights:[], callToAction:"Contact us to schedule a tour" }`.
**Note:** This is one deliverable of the larger **marketing package** agent tool (§4, `build_marketing_package`), which bundles an offering memorandum, flyer, financial summary, and launch email. The package composes this doc plus a `draft-email` call and financial figures.

---

### 3.5 Cold-prospect callability assessment — `POST /api/ai/prospect-assessment`

**Purpose:** Advise whether an off-market building flagged by a public-records signal is worth a cold call this week.
**Input:** `{ "property": { name, signal, address, city, sf, asset, … } }`
**Output contract:**
```json
{
  "verdict": "strong | moderate | challenging",
  "headline": "4-6 word broker-grade summary",
  "reasoning": "2-3 sentences on why it is / isn't a good cold-call target now"
}
```
**Behavioral rules:** Weigh the signal (loan maturity, hold-period expiry, ownership churn, market pressure), asset class, submarket, owner-motivation cues. **Be honest** — if weak or mistimed, say so; if strong, say so without hedging. CRE-native, no fluff.
**Fallback:** `{ verdict:"moderate", headline:"Worth a first-touch call", reasoning:<text> }`.

---

### 3.6 Simulated owner email reply — `POST /api/ai/draft-reply`

**Purpose:** Generate a realistic reply from a property owner to the broker's outreach email (used to render an inbound response on the timeline).
**Input:** `{ "original": { subject, body }, "candidate": { name, role, entity, note, phone }, "property": { name, signal, … } }`
**Output contract:**
```json
{ "tone": "interested | open | decline", "body": "2-4 sentence reply, ending with the owner's first-name signoff" }
```
**Behavioral rules:** Write as the owner would on a phone mid-day: busy, terse, sometimes warm/guarded. Let the `note` shape tone (decision-maker, retiring, family member, etc.). Reference one specific thing from the broker's email. Roughly balanced odds across interested-curious / cautiously-open / polite-decline; pick what fits this owner.
**Fallback:** `{ tone:"open", body:<text> }`.

---

### 3.7 Live-call owner turn — `POST /api/ai/call-turn`

**Purpose:** During a simulated live call, the model plays the owner: given the conversation so far and the broker's latest line, return one owner reply plus suggested broker follow-ups.
**Input:**
```json
{
  "candidate": { "name", "role", "entity", "note", "phone" },
  "property": { "name", "signal", "address", "city", "sf", "asset" } | null,
  "history": [ { "speaker": "you" | "them", "text": string } ],
  "brokerLine": string
}
```
**Output contract:**
```json
{
  "ownerReply": "one line, 1-2 short sentences, as the owner",
  "suggestions": ["broker next-line < 20 words", "…3 total, varied"],
  "shouldEnd": boolean
}
```
**Behavioral rules:** Stay tightly in character; conversational not formal; reference one specific thing from the broker's line. The 3 suggestions should be tactically varied (e.g. one accepts, one redirects, one closes for time) and fit the same thread. Set `shouldEnd:true` only when the owner is clearly wrapping up.
**Client behavior:** Render the owner reply in the transcript, **speak it aloud** (§5.2 owner voice), show the 3 suggestions as tap-to-fill chips, and show a "wrapping up, hang up when ready" hint when `shouldEnd`.
**Fallback:** `{ ownerReply:"Mhm, go on.", suggestions:[], shouldEnd:false }`.

---

### 3.8 Open-ended "Ask Al" chat — `POST /api/ai/chat`

**Purpose:** Free-form copilot Q&A grounded in the broker's current dashboard state. This is the *fallback conversational brain* when the agent (§4) returns no tool and no text, and is used directly for informational questions.
**Input:** `{ "query": string, "context": {…dashboard snapshot}, "history": [ { "role":"user"|"assistant", "content": string } ] }`
**Output contract:** `{ "answer": string }` (light HTML in the answer — see §6.3)
**Behavioral rules — the "playbook" (system prompt intent):** Al mirrors the same priority logic the dashboard uses so answers never contradict the UI:
- *"What should I do next / what's next / coach me / top priority"* → lead with the top prescription (if active); else the first overdue task + contact; else first due-today / reply-due task, or the focus narrative.
- *"Brief me / what's going on / walk me through my day"* → use the focus narrative as the spine; mention the top prescription, overdue count, hot signals; 3–4 sentences.
- *"Tell me about [Name]"* → look them up; give role + entity + last touch + strategic note; mention their property's signal.
- *"What's stalled / who's gone cold"* → name 2–3 contacts with old last-touch.
- *"Find prospects / run a scan"* → suggest a prospect-scan filter fitting their book.
- *"How are my deals / closing / LOIs / DD"* → check opps in tours-offers / under-contract; name specific deals + values.
- **Grounding:** if asked about a contact/opp/address/amount not in the context, say you don't have it and offer what you do know. Never invent.
- **Tone/brevity:** conversational, broker-natural, 2–4 sentences, ≤ ~120 words; light HTML only (`<strong>`, `<em>`), no markdown, no headers.
**Context object:** the client builds a compact snapshot (broker identity, top prescription, focus narrative, overdue/due-today/reply-due tasks, hot signals, opps, contacts). Cap the serialized context (~6 KB) so prompts stay bounded.
**Fallback:** a deterministic client-side composer that answers the common playbook cases from local state.

---

### 3.9 Book-level strategy — `POST /api/ai/strategy`

**Purpose:** Portfolio-level reasoning across the whole book ("who should I work / who can close in 90 days / who's gone cold / how do I drum up business / review my pipeline"). This backs the agent's `analyze_book` tool.
**Input:** `{ "book": string, "question": string, "context": {…} }` — `book` is a text snapshot the client composes (see below).
**Output contract:** `{ "answer": string }` (light HTML)
**Behavioral rules:** Use **only** the supplied book data. Name actual contacts; for each, give the **why** (stage, signal, deal value, days since last touch) and a concrete **next action**; rank by what moves revenue fastest. For time-window questions, reason from stage + signal (under-contract & tours/offers closest; proposal/active mid-funnel; nurturing needs warming; cold needs first touch). Honest, concise; light HTML on names/numbers; a short ranked list is ideal.
**Book snapshot (client-composed) — include per contact:** name, (role, entity), relationship label, open-deal side + stage + value (or "no open deal"), last-touch days-ago, open-task count, signal, short note. Prepend a PIPELINE line (open deal count, total value, stage-weighted forecast).
**Fallback:** rank the book locally by stage proximity to close + recency; list the top ~5 with stage labels.

---

### 3.10 Contact intelligence brief — `POST /api/ai/contact-brief`

**Purpose:** Either a long-form sectioned analyst brief on one contact, or a targeted answer to a specific question about them.
**Input:** `{ "data": string, "name": string, "question": string (optional) }` — `data` is a text dump of that contact's CRM record the client composes (ownership, deals, occupied spaces, inquiries, activity, plus a sampled MARKET INTEL block).
**Output contract:** `{ "brief": string }`
**Behavioral rules:**
- **If `question` is present:** answer that specific question directly and concisely (2–4 sentences) using only the data; lead with the answer; if not present in data, say so and offer the closest fact. Plain prose, no headers.
- **If no `question`:** produce a comprehensive brief with these sections (include only where data exists), plain ALL-CAPS section headers, no markdown/asterisks:
  1. CONTACT OVERVIEW  2. PROPERTY OWNERSHIP  3. DEAL HISTORY  4. OCCUPIED SPACES  5. INQUIRIES & REQUIREMENTS  6. MARKET INTEL (from supplied data only)  7. RECENT ACTIVITY  8. BROKER TAKEAWAYS (2–3 bullets).
- Never invent facts beyond the supplied data.
**Fallback:** show whatever structured fields the client already has for the contact.

---

## 4. The Agent (primary brain)

This is what makes Al *act*. Build it as a **TanStack AI agent** on the Claude adapter: the broker's message + recent conversation + the tool set go into the **agent loop**; the model decides to reply with text (a clarifying question / answer) or to call one-or-more tools, and TanStack AI **dispatches those tools and feeds results back** until the turn resolves. Let the library own that loop — you define the tools, the system prompt, and how each tool's result renders. Don't rebuild the old "server returns `tool_use` blocks, client executes them" handshake by hand; that is what the agent loop + client/server tool split is for.

### 4.1 Turn inputs (what the agent needs each turn)

Whatever transport `useChat` / the agent uses, each turn must have access to:

- **`query`** — the broker's latest message (typed or from voice STT).
- **conversation history** — recent turns. Normalize before sending to the model: merge consecutive same-role turns, strip HTML from prior assistant turns, ensure it starts with a user turn, cap to ~12 turns and a sane per-message length.
- **`context`** — the compact dashboard snapshot (§6.4).
- **`contacts`** — the known-contact names, for name/pronoun resolution.

The model's per-turn result is naturally either assistant text or tool call(s) — TanStack AI surfaces both; you don't need to define a custom `{ blocks: [...] }` envelope. When the key is absent, the agent path is unavailable → fall back to the deterministic intent router + `useChat` conversational fallback (§4.4, §3.8).

### 4.2 Tool set

Define these as TanStack AI tools with typed input schemas. **Client tools** run in the browser (state/nav/UI); **server tools** need the key. Descriptions are load-bearing — they are how the model routes — so keep them specific.

| Tool | Kind | Required input | What it does |
|---|---|---|---|
| `add_note` | client | `contact_name`, `note_text` | Save a note on a contact's record. |
| `create_task` | client | `task_title` (opt: `contact_name`, `due` as natural language) | Create a follow-up task/reminder. |
| `research_contact` | server | `contact_name` | Produce a full research brief (→ §3.10 no-question path). |
| `answer_about_contact` | server | `contact_name`, `question` | Answer a specific question about a contact (→ §3.10 question path). |
| `navigate_to_contact` | client | `contact_name` | Open/go to a contact's record. |
| `start_call` | client | `contact_name` | Open the call brief and start a call **now**. |
| `find_contact` | client | `query` | Search CRM and show a clickable result card. |
| `plan_my_day` | client | *(none)* | Name the broker's immediate next move and start the queue. |
| `analyze_book` | server | `question` | Portfolio strategy across the whole book (→ §3.9). |
| `build_call_list` | client | *(none)* | Build a ranked, dialable call list from the broker's book, apply to People grid, start dialer. |
| `build_marketing_package` | mixed | `address` (opt: `owner_name`, `asset_type`, `asking_price`, `notes`) | Build OM + flyer + financials + launch email (server generations) then render/apply them (client). |

Routing distinctions the descriptions must encode:
- A reminder to call *later* → `create_task`, not `start_call`.
- Broad "tell me about / research / who is" → `research_contact`; a *specific* question → `answer_about_contact`.
- Any portfolio/strategy question not about one named person → `analyze_book` (never refuse for lack of a tool).
- "build my call list / who should I call / call queue" → `build_call_list`, called **immediately**, no confirmation. (Distinct from `analyze_book`, which is a written answer.)
- `build_marketing_package` needs the address; if missing, ask for it, then owner and asset type — one short question at a time — before calling.

### 4.3 Agent system-prompt intent (behavioral rules)

- **Act by calling tools.** Prefer the right tool over describing. Never claim an action was done without calling its tool.
- **Notes vs tasks:** on an add-note request, call `add_note` only — the app auto-creates a follow-up task from a task-oriented note, so don't also emit `create_task` for the same thing. (The client also de-dupes: if both `add_note` and `create_task` come back together, drop the `create_task`.)
- **Missing info → ask one question and stop.** Don't call a tool without its required input. The next message fills the slot.
- **Resolve people** using the conversation + `contacts` list; pass the exact full name. If clearly not in the list, ask who they mean.
- **Confirmation carries the thread:** "yes / go ahead / do it" after an offer → carry it out immediately. Stay on the same contact across follow-ups until the subject clearly changes.
- **Style:** concise, broker-natural, no "as an AI" preamble; light HTML (`<strong>`) only, never markdown.
- Include the broker identity, `KNOWN CONTACTS` names, and a capped dashboard context (~3 KB) in the prompt.

### 4.4 What each tool does when it runs

When the agent loop invokes a tool, it performs the real action and confirms in chat (and speaks the confirmation if the turn came by voice). This is the tool *implementation*, not a separate dispatch layer:

| Tool | Behavior when invoked |
|---|---|
| `add_note` | Resolve contact → write note to record; if unresolved/empty, ask. |
| `create_task` | Parse `due` to a real date; create task (optionally on the contact). |
| `research_contact` / `answer_about_contact` | Run the contact-brief generation (§3.10, with/without question) and render. |
| `navigate_to_contact` | Show an "opening X" card, then route to the contact record. |
| `start_call` | Announce, then open the call brief and start the call flow (§3.7 / live-call UI). |
| `find_contact` | Resolve or run local retrieval; render a result card. |
| `plan_my_day` | Compute and show the top-move prompt (headline + action); speak it. |
| `analyze_book` | Run the strategy generation (§3.9) over the composed book snapshot; render (fallback = local ranking). |
| `build_call_list` | Rank the book locally (or via the call-list generation §3.3), apply to People grid, start dialer. |
| `build_marketing_package` | Run the package build (compose flyer §3.4 + email §3.2 + financials), render deliverables; speak "your package is ready." |

**Fallback when the agent is unavailable (no key / offline):** a deterministic intent router that recognizes the common phrasings above (note/task/call/find/navigate/plan/strategy/call-list) and runs the same clarify-then-act slot-filling, so voice and chat still work with no key. In TanStack AI terms, this is a non-LLM path the client takes when the adapter can't run the loop.

---

## 5. Voice requirements

### 5.1 Text-to-speech — `POST /api/tts`

**Purpose:** Speak Al's replies, the greeting, and owner lines.
**Input:** `{ "text": string, "voice": string }`
**Output:** `audio/mpeg` (MP3) bytes on success; **503** if no key; 502 on provider failure. `no-store` cache.
**Server behavior:**
- Whitelist accepted voice ids; default to a warm neutral voice (the original default: `nova`) if the requested one isn't allowed.
- Cap input length (~4000 chars).
- Prefer the steerable model with an **`instructions` persona** and fall back down a model list on failure. Persona instruction to use:
  > *"You are Al, a sharp, warm commercial-real-estate assistant. Speak like a trusted colleague: calm, confident, and personable, with natural conversational pacing and light energy. Friendly but professional, never robotic or sing-songy."*
**Client playback:** fetch the MP3, play via an `Audio` element; track the current audio so it can be paused/cancelled. **Fallback:** if the response isn't OK (503) or the fetch fails, speak via the browser `SpeechSynthesis` API.

### 5.2 Owner voice selection (live call)

- Pick a voice by **heuristic gender from the owner's first name**, and make it **stable per contact** (e.g. index by a stable contact id) so the same owner always sounds the same.
- With the server TTS available, map to a small set of provider voices split by gender (e.g. female: `nova`/`shimmer`/`alloy`; male: `echo`/`onyx`). With only browser speech, prefer the most natural available system/cloud voices (network/"Google …"/premium/enhanced/neural) filtered by gender and English locale.

### 5.3 Speech-to-text & the hands-free loop (browser)

Use the Web Speech API. Requirements:
- **One voice session drives all on-screen omni inputs** in lockstep (top bar + rail): whichever mic is tapped, both light up "listening" and both show the live transcript.
- Config: `lang="en-US"`, `interimResults=true`, `continuous=true`. In continuous mode, rebuild the full transcript from all result segments each `onresult` (don't drop earlier words).
- **Silence handling (own timer, not the browser's):** submit only after a comfortable pause (~3.2 s) once speech has started; wait ~10 s for the broker to begin at all; a `no-speech` error keeps waiting rather than aborting.
- On end: take the transcript, clear the inputs, submit it to Al, and mark that the reply should be **spoken back**.
- **Hands-free re-arm:** after Al finishes *speaking* a reply, if still in conversation mode, re-open the mic (~350 ms later). **Silence ends the loop** — never leave a perpetually-hot mic.
- **Never re-arm during a live call** — an open mic would capture the call audio and let Al talk over it. Opening a live call hard-stops the voice conversation and any in-progress capture.
- Where `SpeechRecognition` is unsupported or mic permission is denied, show a toast telling the broker to type instead, and exit conversation mode cleanly.

### 5.4 Proactive spoken greeting

- The first time Al opens in a session (rail/AI Mode), speak a greeting personalized by **time of day** (Morning/Afternoon/Evening + first name), grounded in **real numbers**: today's open-task count and whether an overnight signal exists. End with the offer *"Want me to call your most important move first?"*
  - Example shape: *"Evening, John. It's a full one, you've got 5 tasks on the calendar today. A signal also came in overnight, I pinned it to the top of your Now Wall. Want me to call your most important move first?"*
- Because it ends in a question, enter hands-free conversation mode so the broker can answer out loud. Greet **once per session**.
- **Audio unlock:** browsers block audio until a user gesture. Prime playback on the first `pointerdown`/`keydown` (resume an `AudioContext` + play a tiny silent clip) so the natural TTS voice — not the robotic fallback — plays on the greeting.
- If voice is turned off, still show the greeting on screen; just don't speak or open the mic.

### 5.5 Speech lifecycle & controls

- **Single speak gate:** Al speaks **only** when engaged — the rail is open, the legacy sidebar is open, or a hands-free session is live. When Al is fully closed, nothing speaks unprompted.
- **Text prep before speaking:** strip HTML tags and **decode HTML entities to real characters** (e.g. `&#39;` → `'`) before TTS, or the voice reads gibberish. Cap spoken length (~650 chars, cut on a sentence boundary).
- **Generation guard:** tag each speak/owner-speak call with a monotonically increasing generation id; a newer call or a hang-up bumps the generation so in-flight TTS fetches abort before playing (prevents Al talking after End-call).
- **Controls:** mute (drop pending speech), pause/resume, and a hard **cancel** that stops provider audio + browser speech and force-resolves any awaiting promises (pausing an `Audio` element doesn't fire `ended`, so awaiters must be settled explicitly).
- **Presenter kill-switch:** a way to silence Al instantly mid-sentence (demo safety).

---

## 6. Cross-cutting requirements

### 6.1 Graceful degradation matrix

| Feature | With keys | Without keys |
|---|---|---|
| All one-shot generations (§3) | Claude via server tool / server fn | deterministic client fallback (per capability) |
| Agent (§4) | TanStack AI agent loop on Claude | deterministic intent router + slot-filling |
| Voice out | natural TTS server fn | browser `SpeechSynthesis` |
| Voice in | Web Speech API | Web Speech API (no server dependency); "type instead" where unsupported |

### 6.2 Grounding

Never invent contacts, deals, addresses, or dollar amounts. Answer from the supplied context/data; if something isn't there, say so and offer the closest real fact. The copilot, cards, brief, and voice must all use the same priority logic so they never contradict each other.

### 6.3 Output formatting

- Conversational answers: **light HTML only** (`<strong>`, `<em>`, `<br>`), never markdown (`**bold**`), never H1/H2/H3. `<strong>` sparingly on the one or two words that matter.
- Structured capabilities: return the typed shape (prefer TanStack AI structured output; if prompting raw JSON, strict JSON only, no prose, no fences, and strip fences defensively).
- Long briefs: plain ALL-CAPS section headers, no markdown.

### 6.4 The dashboard context object

The client composes a compact snapshot passed to `chat`, `agent`, and `strategy`. Include (as available): broker identity (name, role), top prescription (headline + action), focus narrative, task buckets (overdue / due-today / reply-due), hot signals, opportunities (stage + value), and contacts (name, role, entity, relationship, last-touch, signal, short note). Cap the serialized size (chat ~6 KB, agent ~3 KB).

---

## 7. Acceptance criteria (parity checklist)

**AI capabilities**
- [ ] Each of the 11 capabilities produces its exact output shape and a sane fallback; all run key-less via their deterministic fallback.
- [ ] Listing filter turns plain English into a valid filter + explanation.
- [ ] Draft email honors provided recipients (first names, real emails) and stays < 140 words.
- [ ] Call list returns 5–8 ranked contacts with valid `contactId`s and applies to the People grid.
- [ ] Prospect assessment gives an honest verdict (can say "challenging").
- [ ] Contact brief supports both the sectioned long-form and the targeted-question modes.
- [ ] Strategy names real contacts with why + next action, grounded only in the supplied book.

**Agent**
- [ ] All 11 tools are defined and route correctly per §4.2 (spot-check: "remind me to call X Friday" → `create_task`; "call X" → `start_call`; "who should I work" → `analyze_book`; "build my call list" → `build_call_list` with no confirmation).
- [ ] Clarify-then-act: a note with no body asks for the body, then saves on the next message.
- [ ] "yes/do it" after an offer carries out the action.
- [ ] Pronoun/partial-name resolution lands on the right record; unknown names prompt a question.
- [ ] add_note does not also create a duplicate task.
- [ ] Key-less fallback router handles the common intents (agent loop unavailable).

**Voice**
- [ ] Greeting speaks once per session with real task/signal numbers and ends in the offer; then listens hands-free.
- [ ] Hands-free loop: speak → answer aloud → re-arm; silence ends it; never re-arms during a live call.
- [ ] TTS uses the Al persona and falls back to browser speech with no key.
- [ ] Owner voices are gender-appropriate and stable per contact; owner lines speak during the live call.
- [ ] Entities are decoded before speaking; cancel/mute/pause work and Al never speaks after End-call.
- [ ] Al speaks only when engaged; nothing speaks when Al is fully closed.

**Signature flow**
- [ ] The hero arc runs end-to-end: greeting → "yes" starts the call → hang-up recap (opportunity + tasks + tour) → inbound email self-arrives and is filed → underwrite → BOV sent and logged.

---

## 8. Appendix — TanStack AI implementation sketch (illustrative)

> **Read this as orientation, not gospel.** TanStack AI is young and evolving; the exact names/signatures below are reconstructed from the docs and README and **must be checked against the version you install** (`@tanstack/ai`, `@tanstack/ai-react`, `@tanstack/ai-client`, `@tanstack/ai-anthropic`). The point is to show *how the §3–§4 contracts map onto TanStack AI primitives*, so you don't hand-roll the loop. Use Zod schemas for the I/O shapes this doc specifies.

### 8.1 Packages & adapter

```ts
// @tanstack/ai            — core: toolDefinition(), chat(), toServerSentEventsResponse()
// @tanstack/ai-anthropic  — createAnthropicChat() (Claude adapter; key server-side)
// @tanstack/ai-react      — useChat()
// @tanstack/ai-client     — clientTools(), createChatClientOptions()

// server-only module
import { createAnthropicChat } from '@tanstack/ai-anthropic'

// Key stays server-side. Use a current Claude model id (e.g. claude-sonnet-5
// for the fast agent loop; claude-opus-4-8 where you want more reasoning).
export const claude = createAnthropicChat('claude-sonnet-5', process.env.ANTHROPIC_API_KEY!)
```

### 8.2 A server tool — `analyze_book` (§3.9 / §4)

Needs the key → `.server()`. The Zod `outputSchema` is how you guarantee §3.9's shape.

```ts
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export const analyzeBook = toolDefinition({
  name: 'analyze_book',
  description:
    "Portfolio strategy across the WHOLE book — who to work, who can close in 90 days, " +
    "who's gone cold, how to drum up business. NOT for a single named contact.",
  inputSchema: z.object({ question: z.string() }),
  outputSchema: z.object({ answer: z.string() }), // light-HTML string per §6.3
}).server(async ({ question }, ctx) => {
  const book = composeBookSnapshot(ctx.session)      // §3.9 client/server-composed snapshot
  const { answer } = await chat({
    adapter: claude,
    outputSchema: z.object({ answer: z.string() }),
    messages: [
      { role: 'system', content: STRATEGY_SYSTEM_PROMPT }, // §3.9 behavioral rules
      { role: 'user', content: `QUESTION: ${question}\n\nBOOK:\n${book}` },
    ],
  })
  return { answer }
})
```

`contact_brief`, `draft_email`, `call_list`, `draft_doc`, `prospect_assessment`, `draft_reply`, `call_turn`, and the `filter` all follow this exact `.server()` + `outputSchema` pattern — one per §3.x contract.

### 8.3 A client tool — `navigate_to_contact` / `start_call` (§4.4)

Touches router/UI → `.client()`. Runs in the browser; no key.

```ts
export const startCall = toolDefinition({
  name: 'start_call',
  description: "Open the call brief and start a call NOW. A reminder to call LATER is create_task.",
  inputSchema: z.object({ contact_name: z.string() }),
  outputSchema: z.object({ started: z.boolean(), contactId: z.string().nullable() }),
}).client(async ({ contact_name }) => {
  const c = resolveContactByName(contact_name)        // §4.3 name/pronoun resolution
  if (!c) return { started: false, contactId: null }  // model then asks who they meant
  announceInChat(`On it — calling ${c.name} now.`)
  openCallFlow(c.id)                                  // §3.7 live-call UI
  return { started: true, contactId: c.id }
})
```

`add_note`, `create_task`, `find_contact`, `plan_my_day`, `build_call_list`, `navigate_to_contact` are the other `.client()` tools. `build_marketing_package` is mixed: a `.client()` tool whose handler awaits the server doc/email generations, then renders.

### 8.4 The agent turn (server route) — §4

`chat()` runs the **agent loop**: it decides when to call tools, dispatches server tools inline, and streams client-tool calls to the browser to execute. You do not reconstruct "return blocks → execute on client."

```ts
import { chat, toServerSentEventsResponse } from '@tanstack/ai'

export async function POST(request: Request) {
  const { messages, context } = await request.json()
  const stream = chat({
    adapter: claude,
    system: buildAgentSystemPrompt(context),          // §4.3 (identity, KNOWN CONTACTS, capped context)
    messages,                                          // already normalized per §4.1
    tools: [ addNote, createTask, researchContact, answerAboutContact,
             navigateToContact, startCall, findContact, planMyDay,
             analyzeBook, buildCallList, buildMarketingPackage ],
    // maxSteps/agentic-cycle options as the version exposes them
  })
  return toServerSentEventsResponse(stream)
}
```

### 8.5 The React surface — §3.8 chat + client tools

```tsx
import { useChat, fetchServerSentEvents } from '@tanstack/ai-react'
import { clientTools, createChatClientOptions } from '@tanstack/ai-client'

const tools = clientTools([ addNote, createTask, navigateToContact, startCall,
                            findContact, planMyDay, buildCallList, buildMarketingPackage ])

function AskAl() {
  const { messages, sendMessage, status } = useChat(
    createChatClientOptions({
      transport: fetchServerSentEvents('/api/ai/agent'),
      tools, // client tools execute in the browser; server tools run server-side
    }),
  )
  // Omnibox/rail bind to sendMessage(); voice STT (§5.3) calls the same sendMessage().
  // Speak assistant replies via _speakText (§5.5) when the turn came from voice.
}
```

### 8.6 One-shot structured generation — the listing filter (§3.1)

Not agentic — a plain server function returning a typed object:

```ts
export async function filterListings(query: string) {
  return chat({
    adapter: claude,
    outputSchema: FilterSpec,   // Zod for the §3.1 output contract
    messages: [
      { role: 'system', content: FILTER_SYSTEM_PROMPT },
      { role: 'user', content: query },
    ],
  })
}
```

### 8.7 What stays outside TanStack AI

- **TTS (§5.1)** — a plain server function calling the TTS provider, returning MP3 bytes. Not a `chat()`/adapter concern.
- **STT + hands-free loop (§5.3)** — pure browser Web Speech API on the client; feeds text into `sendMessage()`.
- **Graceful degradation (§1.1, §6.1)** — when `ANTHROPIC_API_KEY` is unset, don't call `chat()`; run the per-capability deterministic fallback and the §4.4 intent router instead. The adapter is the only thing that needs the key.
- **Approval Flow** — the live-call wrap-up "review/edit/drop tasks before saving" (§3.7 client behavior) maps naturally onto TanStack AI's approval/tool-state gating if you choose to model those task writes as gated tool calls; otherwise keep it as plain UI. Either is fine.
