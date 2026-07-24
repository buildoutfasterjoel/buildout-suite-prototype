# Buildout Prototype — AI & Voice PRD

**Status:** Reference spec for rebuild
**Source:** Vanilla HTML/JS/Python prototype (`app.js`, `server.py`)
**Target:** New prototype on TanStack Start + React
**Scope:** The AI-assistant ("Al") and voice experiences only. UI chrome, data model, and non-AI screens are out of scope except where they carry an AI flow.

---

## 1. Vision

> **The broker stops operating the software. The software operates the broker's day.**

Buildout's prototype demonstrates a commercial-real-estate (CRE) platform where an embedded AI assistant named **Al** is the *front door* to the product. Instead of the broker opening a dashboard and deciding what to do, Al watches the book overnight, greets the broker, names the single most important next move, and — on one word — *acts*: it dials the call, logs it, opens the deal, files the inbound email, drafts the valuation, and reports back in plain language.

The north-star test for every feature: **does it move work off the broker and onto the shared record?**

Two guiding truths the experience must preserve:
1. **Al acts, it doesn't just chat.** When the broker asks for something actionable, Al performs the action for real (writes the note, creates the task, starts the call) rather than describing what it would do.
2. **Everything degrades gracefully.** Every AI and voice feature has a non-AI fallback. With no API keys the product still runs end-to-end; only the *quality* of language and voice degrades.

---

## 2. Personas & context

- **The broker (primary user)** — e.g. "John Whitfield," a principal broker at a Charleston, SC CRE firm. Works a book of contacts (owners, buyers, tenants), a pipeline of deals, and reacts to market signals. Time-poor; wants the next right action, not a blank dashboard.
- **The property owner (simulated counterparty)** — appears only inside the live-call and email-reply simulations, role-played by the AI.
- **Al (the assistant)** — one persona across every surface: the proactive greeting, the "Al · Right now" prescription cards, the strategic brief, the copilot chat, and the voice. Al is "a sharp, warm CRE colleague." Al is consistent — the same Al everywhere, grounded in the broker's real book.

---

## 3. The AI experience, by surface

### 3.1 Al, the copilot (omnibox + rail)

- A persistent **"Search or ask Al"** omnibox appears in the top bar and in a right-side rail composer. They act as one control — typing or speaking in either drives the same conversation.
- **Proactive spoken greeting.** The first time Al opens in a session (e.g. entering "AI Mode"), Al greets the broker out loud, personalized by time of day and grounded in real numbers: today's task count and whether an overnight signal jumped the queue. It ends with an offer: *"Want me to call your most important move first?"*
- **Hands-free conversation.** Because the greeting ends in a question, Al drops into a hands-free loop: it opens the mic, listens, answers out loud, then re-opens the mic. Silence ends the loop; there is never a perpetually-hot mic.
- **"AI Mode" launcher.** Surfaces four things Al can run at any time: *recommend my day, build my call list, today's market news, insights on areas I've searched.* Always available as a way back to the work.
- **Loop-closing reminder.** When the broker clears the last task due today, Al doesn't go quiet — it says "that's your list cleared" and re-offers the four agent skills.

### 3.2 The Agent brain (how Al *acts*)

Al's primary intelligence is a tool-calling agent. The broker's natural-language message + recent conversation go to the agent; it decides which single action fits and performs it. It can:

- Record a note on a contact; create a task/reminder with a natural-language due date.
- Research a contact (full brief) or answer a specific question about one.
- Navigate to a record; start a call; find/search a contact.
- Plan the day (name the next move); analyze the whole book for strategy.
- Build a ranked call list; build a full marketing package from an address.

Behavioral hallmarks that make it feel like an assistant, not a form:
- **Clarify, then act.** If a request is missing a required piece (which contact? the note body? the task?), Al asks *one* short question and holds the action. The next message completes it.
- **Act on confirmation.** If Al offered something and the broker says "yes / go ahead / do it," Al carries it out immediately rather than re-asking.
- **Resolve people naturally.** Pronouns ("him/her/them") and partial names resolve against the conversation and the known-contacts list to the correct CRM record.
- **Stay on subject** across turns until the broker clearly changes it.
- **Never refuse for lack of a tool.** Strategy/portfolio questions route to book analysis rather than "I can only do one contact at a time."

### 3.3 In-context AI actions

Beyond the copilot, AI is embedded in specific screens:

- **Natural-language listing filter** — the broker types a plain-English query ("stale Chicago office for sale") and the listings grid filters accordingly, with a one-sentence explanation of what was applied.
- **Draft outreach email** — from a property (and optional named recipients), Al drafts a concise, professional broker email with subject, recipients, body, and sign-off.
- **Ranked call list** — from the broker's own book (or a listing's engaged buyers), Al returns the 5–8 best people to call right now, each with a score and a one-line reason, and applies the ranking to the People grid to power-dial.
- **Marketing package** — from an address (plus owner/asset type), Al builds a complete package: offering memorandum, flyer, financial summary, and launch email. If details are missing, it asks first.
- **Cold-prospect callability assessment** — for an off-market building flagged by a public-records signal, Al returns a verdict (strong/moderate/challenging), a short headline, and 2–3 sentences of honest reasoning.
- **Contact intelligence brief** — a long-form, sectioned analyst rundown of one contact (ownership, deal history, occupied spaces, inquiries, market intel, activity, broker takeaways), or a targeted answer to a specific question about them.
- **Book strategy** — portfolio-level reasoning: "who should I work, who can close in 90 days, who's gone cold, how do I drum up business," naming actual contacts with the why and a next action.

### 3.4 The live call

A signature moment. When Al (or the broker) starts a call:
- The UI shows **dialing → ringing → connected**, counting down from 5, then a live transcript view.
- The **call brief** is on the record: opener, the signal to lead with, the ask, and a voicemail script.
- The AI **role-plays the property owner** in character (shaped by the owner's profile and broker notes), replying one line at a time, and offers the broker **2–3 suggested next lines** each turn (varied: accept, redirect, close).
- The owner's lines are **spoken aloud** in a natural, gender-appropriate voice, stable per owner.
- On hang-up, Al generates a **call summary** (sentiment + key points) and **drafts follow-up tasks** from the next steps for the broker to review/edit/drop before saving. In the hero flow it also opens a new opportunity, moves it into the pipeline, and schedules the tour — then narrates what it did.

### 3.5 Voice

- **One persona.** All spoken output uses the warm, composed "Al" delivery.
- **Text-to-speech (TTS)** for Al's replies, the greeting, and owner lines in the live call. Owner voices are chosen by heuristic gender from the name and are stable per contact so the same owner always sounds the same.
- **Speech-to-text (STT)** for voice input to Al, with a live transcript in the omnibox and a comfortable silence timer before submitting.
- **Controls.** Mute, pause/resume, and a hard cancel that stops in-flight speech cleanly (critical during a live call so Al never talks over the call audio).
- **Voice gating.** Al only speaks when the broker has Al open/engaged (rail open, sidebar open, or a hands-free session live). When Al is fully closed, nothing speaks unprompted.

---

## 4. Signature flows

### 4.1 The hero arc — cold signal to sent BOV (the main demo)

1. **Morning / greeting.** Broker enters AI Mode; Al greets out loud, flags the overnight signal on owner "Marcus Pinckney" (a maturing CMBS loan), offers to call the top move.
2. **One word acts.** Broker says "yes"; Al navigates to Marcus's record and starts the call — no separate "call him" step. (Saying "brief me first" briefs the signal and shows a Call button instead.)
3. **The call.** Live call bar counts down, connects; the brief is on the record. Broker talks (or uses suggested lines); hangs up.
4. **Al reports.** Right after hang-up, Al says out loud: new opportunity opened and moved into the pipeline, transcript read back, next steps turned into tasks, the Thursday tour on the calendar.
5. **Inbound self-arrives.** ~10s later the owner's email with rent roll + T-12 arrives on its own; Al files both attachments to the deal and offers to underwrite.
6. **Underwrite + BOV.** Al reads the rent roll and T-12, prices the deal, flags an occupancy mismatch, drafts the valuation (BOV), and audits the numbers.
7. **Send.** Broker sends the BOV; it lands on the record's activity timeline.

Two human moves (the call and the send); the platform did the rest and captured all of it on one record.

### 4.2 Turn Al loose on the book

- **Build my call list** — Al ranks the broker's assigned, dialable contacts (excludes Do-Not-Call and dead numbers) by who's most worth a call now, applies it to the People grid, and starts the dialer. A variant pulls a specific listing's engaged buyers, ranked by marketing engagement.
- **Power dial** — select the group and cycle through each record with a live call; hanging up on one auto-starts the next countdown.
- **Day planning** — "what should I do right now" / "plan my day" names the actual next move (specific headline + action) rather than a generic plan.

---

## 5. Principles (non-negotiable behaviors)

1. **Act, don't describe.** Prefer performing the action to narrating it. Never claim an action was done without doing it.
2. **Graceful degradation.** No API keys → deterministic fallbacks for language, browser speech for voice. Nothing breaks.
3. **Grounding.** Answer from the broker's real book. If a fact isn't in context, say so and offer the closest real fact. Never invent contacts, deals, or numbers.
4. **Consistency of voice.** The copilot, cards, brief, and spoken Al are the same Al, using the same priority logic — answers never contradict what the dashboard shows.
5. **Conversational, concise, CRE-native.** No "as an AI" preamble; light emphasis only; typically 2–4 sentences.
6. **Respect attention.** No perpetually-hot mic; Al speaks only when engaged; presenter kill-switch to silence Al instantly.

---

## 6. Non-goals

- Real telephony — calls are simulated (AI role-plays the counterparty).
- Real email send/receive — inbound replies are AI-simulated and self-arrive on a timer.
- Production auth, multi-tenant data, or persistence beyond the prototype's in-memory/seed state.
- Real public-records/market-data integrations — signals and market intel are seeded/sampled.
- Model training or fine-tuning — all AI is prompt-driven over a general LLM.
