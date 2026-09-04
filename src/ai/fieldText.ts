import type { ComposeKind } from "#/components/contacts/contactDisplay";

/**
 * Inline AI writing for the Log Activity fields — "ask at the field, review at
 * the field".
 *
 * The sparkle on a field no longer hands it to the rail. It reveals an
 * instruction bar directly under the field; what the broker types there is
 * sent once, and the answer streams into the field above it. The rail's
 * conversation never learns about it, so a note and a chat about a deal don't
 * end up interleaved in one transcript.
 *
 * This module is the pure half: the prompt, the placeholders, the quick edits
 * and the no-key fallback. It deliberately imports nothing from the server or
 * the store so it can be unit-tested and shared by the relay.
 */

export type FieldTextPhase = "idle" | "generating";

interface FieldSpec {
  /** The noun the sparkle names — "Note", "Call Summary". */
  noun: string;
  /** Hover label on the sparkle when the field is empty. */
  emptyLabel: string;
  /** How the field is described to the model. */
  describe: (fullName: string) => string;
  /** The register the field wants. */
  guidance: string;
}

/**
 * Note, call, meeting and tour are the same kind of writing — the broker's own
 * record of something that happened — so they share one set of style rules.
 */
const RECAP_GUIDANCE =
  "Write it as the broker's own record of something that happened: first person, past tense, plain prose, no greeting and no sign-off. Two to five sentences unless the instruction asks for more.";

/**
 * An email is the one field addressed TO the contact rather than about them.
 */
const EMAIL_GUIDANCE =
  "Write the message body only — never a subject line. Open with the contact's first name, keep it to one clear point or ask, and end with a short sign-off line. No signature block.";

const FIELDS: Record<ComposeKind, FieldSpec> = {
  note: {
    noun: "Note",
    emptyLabel: "Generate Note",
    describe: (n) =>
      `The Note field of the Log Activity composer on ${n}'s contact page — an activity note the broker is writing but has NOT logged yet.`,
    guidance: RECAP_GUIDANCE,
  },
  call: {
    noun: "Call Summary",
    emptyLabel: "Generate Call Summary",
    describe: (n) =>
      `The call-summary field of the Log Activity composer on ${n}'s contact page — the broker's record of a call that already happened, NOT yet logged.`,
    guidance: RECAP_GUIDANCE,
  },
  email: {
    noun: "Email",
    emptyLabel: "Draft Email",
    describe: (n) =>
      `The message body of an email to ${n}, open in the composer on their contact page — a draft the broker has NOT sent.`,
    guidance: EMAIL_GUIDANCE,
  },
  meeting: {
    noun: "Meeting Note",
    emptyLabel: "Generate Meeting Note",
    describe: (n) =>
      `The meeting-note field of the Log Activity composer on ${n}'s contact page — the broker's record of a meeting that already happened, NOT yet logged.`,
    guidance: RECAP_GUIDANCE,
  },
  tour: {
    noun: "Tour Note",
    emptyLabel: "Generate Tour Note",
    describe: (n) =>
      `The tour-note field of the Log Activity composer on ${n}'s contact page — the broker's record of a tour that already happened, NOT yet logged.`,
    guidance: RECAP_GUIDANCE,
  },
};

/** The sparkle's hover label: what the click reveals, given the field's state. */
export function fieldSparkleLabel(activity: ComposeKind, hasValue: boolean): string {
  return hasValue ? "Revise with AI" : FIELDS[activity].emptyLabel;
}

/**
 * The instruction bar's placeholder is the whole status line: it says what the
 * bar will do with the next thing typed into it, and while a run is in flight
 * it says that instead.
 */
export function instructionPlaceholder(phase: FieldTextPhase, hasValue: boolean): string {
  if (phase === "generating") return "Generating...";
  return hasValue ? "Describe your change" : "What should be written?";
}

/**
 * The three one-click revisions behind the bar's ellipsis. One tap is one whole
 * instruction, sent as-is — so each prompt is written the way the broker would
 * have typed it, and the label is a promise the prompt keeps.
 */
export interface QuickEdit {
  /** Menu label, and the key the bar uses to pick its icon. */
  label: "More Formal" | "Friendlier" | "Shorten";
  prompt: string;
}

export const QUICK_EDITS: QuickEdit[] = [
  {
    label: "More Formal",
    prompt: "Rewrite this in a more formal register, without adding anything it doesn't say.",
  },
  {
    label: "Friendlier",
    prompt: "Make this warmer and friendlier in tone, without padding it or changing what it says.",
  },
  { label: "Shorten", prompt: "Shorten this, keeping every fact in it." },
];

/** One instruction against one field, as sent to the relay. */
export interface FieldTextRequest {
  activity: ComposeKind;
  fullName: string;
  firstName: string;
  /** What the broker typed in the bar (or a quick edit's prompt). */
  instruction: string;
  /** The field as it stands; empty means "write it fresh". */
  current: string;
  /** The contact's plain-text record (`composeContactData`), for writing from history. */
  contactData: string;
}

/**
 * The prompt pair for one run. The system half carries everything that is true
 * of the field regardless of the instruction; the user half is the field's text
 * and the instruction, so a revision reads as "here is the text, here is the
 * change".
 */
export function fieldTextPrompt(req: FieldTextRequest): { system: string; user: string } {
  const spec = FIELDS[req.activity];
  const system = [
    "You write text directly into one field of a commercial real estate CRM, on behalf of the broker using it.",
    "Your entire reply is placed into that field verbatim. Reply with the field text only: no preamble, no explanation, no quotation marks around it, no markdown headings, no closing remarks.",
    "",
    `FIELD: ${spec.describe(req.fullName)}`,
    `STYLE: ${spec.guidance}`,
    "",
    "If the field already has text and the instruction is a revision, rewrite THAT text — keep every fact it carries unless the instruction drops one.",
    "If the field is empty, write it from the instruction and the contact record below. Never invent facts that neither the instruction nor the record gives you; if the instruction is a bare topic, write only what the record supports.",
    "",
    "CONTACT RECORD:",
    req.contactData.trim() || "(nothing on record)",
  ].join("\n");

  const user = [
    "CURRENT FIELD TEXT:",
    req.current.trim() || "(empty)",
    "",
    "INSTRUCTION:",
    req.instruction.trim(),
  ].join("\n");

  return { system, user };
}

/**
 * What the relay streams when the server has no Anthropic key — a deterministic
 * stand-in so the interaction can still be demonstrated end to end. It is
 * plainly a stand-in (it echoes the instruction rather than answering it), which
 * is the honest choice: a fallback that fabricated a plausible note would hide
 * the missing key behind text the broker might log.
 */
export function fieldTextFallback(req: FieldTextRequest): string {
  const current = req.current.trim();
  const instruction = req.instruction.trim();
  const noun = FIELDS[req.activity].noun.toLowerCase();

  if (current) {
    const sentences = current.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((s) => s.trim()) ?? [
      current,
    ];
    if (/shorten|shorter|brief|concise/i.test(instruction)) {
      return sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(" ");
    }
    if (/formal/i.test(instruction)) {
      return `Summary of discussion with ${req.fullName}: ${current}`;
    }
    if (/friendl|warm/i.test(instruction)) {
      return `Great catching up with ${req.firstName}. ${current}`;
    }
    return `${current} (${instruction})`;
  }

  const topic = instruction.replace(/[.!?]+$/, "");
  if (req.activity === "email") {
    return `Hi ${req.firstName},\n\n${topic.charAt(0).toUpperCase()}${topic.slice(1)}.\n\nLet me know what works on your end.\n\nBest,`;
  }
  return `Spoke with ${req.firstName}. ${topic.charAt(0).toUpperCase()}${topic.slice(1)}. Will follow up on this ${noun} next week.`;
}
