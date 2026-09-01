import type { ComposeKind } from "#/components/contacts/contactDisplay";
import type { FieldAsk, FieldAskAction } from "#/ai/useAssistant";

/**
 * Per-field presets for the "ask at the rail, review at the field" grammar.
 *
 * One table for the whole Log Activity block. The five tabs share a record, a
 * staging path and a review surface, so what actually differs between them is
 * wording: what the affordance is called, what Otto asks when the field is
 * blank, and which revisions are worth a chip. A builder per tab would have
 * been five copies of one function disagreeing about the last of those.
 *
 * Note that no preset carries the field's text. The value travels in the
 * assistant's CURRENT CONTEXT block (see `src/ai/context.ts`), which is both
 * live — it follows the broker's edits after the chip was pinned — and legible:
 * the prompt a chip sends is also the user bubble the broker reads back, and
 * "Shorten this, keeping every fact." looks like something a person typed.
 */

/**
 * The three revisions a jotted record of something that happened wants. Shared
 * by note, call, meeting and tour — they are the same kind of writing, and
 * inventing a different trio per tab would be variety for its own sake.
 */
const RECAP_REVISIONS: FieldAskAction[] = [
  { label: "Shorten", prompt: "Shorten this, keeping every fact in it." },
  {
    label: "More formal",
    prompt: "Rewrite this in a more formal register, without adding anything it doesn't say.",
  },
  {
    label: "Clean up the wording",
    prompt:
      "Fix the grammar and shorthand here, leaving the meaning and level of detail exactly as they are.",
  },
];

/**
 * An email is the one field on this block addressed TO someone rather than
 * about them, so its revisions are about how it will land rather than how it
 * reads back — the register the market has settled on (Gmail, HubSpot, Jasper
 * all ship a variant of these three).
 */
const EMAIL_REVISIONS: FieldAskAction[] = [
  { label: "Shorten", prompt: "Shorten this email — same asks, fewer words." },
  {
    label: "Warmer",
    prompt: "Make this email warmer and more personal, without getting familiar or padding it.",
  },
  {
    label: "More direct",
    prompt: "Make this email more direct: lead with the ask and cut the throat-clearing.",
  },
];

interface FieldSpec {
  /** Chip suffix and the noun Otto uses for it — "Note", "Call Summary". */
  noun: string;
  /** Hover label on the sparkle when the field is empty. */
  emptyLabel: string;
  /** What Otto asks when there is nothing to revise, `{name}` being the first name. */
  ask: (firstName: string) => string;
  /** How the field is described to the model in CURRENT CONTEXT. */
  describe: (fullName: string) => string;
  actions: FieldAskAction[];
}

const FIELDS: Record<ComposeKind, FieldSpec> = {
  note: {
    noun: "Note",
    emptyLabel: "Generate Note",
    ask: (n) =>
      `What should this note about ${n} cover? Give me the gist — who you spoke to, what was said, what got decided — and I'll write it up.`,
    describe: (n) =>
      `The Note field of the Log Activity composer on ${n}'s contact page — an activity note the broker is writing but has NOT logged yet.`,
    actions: RECAP_REVISIONS,
  },
  call: {
    noun: "Call Summary",
    emptyLabel: "Generate Call Summary",
    ask: (n) =>
      `What did you and ${n} talk about? Give me the gist — what was said, what got decided, what you owe them — and I'll write the summary.`,
    describe: (n) =>
      `The call-summary field of the Log Activity composer on ${n}'s contact page — the broker's record of a call that already happened, NOT yet logged.`,
    actions: RECAP_REVISIONS,
  },
  email: {
    noun: "Email",
    emptyLabel: "Draft Email",
    ask: (n) =>
      `What should this email to ${n} say? Tell me the point you want to land and I'll draft it.`,
    describe: (n) =>
      `The message body of an email to ${n}, open in the composer on their contact page — a draft the broker has NOT sent. You may also set its subject.`,
    actions: EMAIL_REVISIONS,
  },
  meeting: {
    noun: "Meeting Note",
    emptyLabel: "Generate Meeting Note",
    ask: (n) =>
      `How did the meeting with ${n} go? Who was there, what got covered, what happens next?`,
    describe: (n) =>
      `The meeting-note field of the Log Activity composer on ${n}'s contact page — the broker's record of a meeting that already happened, NOT yet logged.`,
    actions: RECAP_REVISIONS,
  },
  tour: {
    noun: "Tour Note",
    emptyLabel: "Generate Tour Note",
    ask: (n) =>
      `How did the tour with ${n} go? Which space, who came, and what did they make of it?`,
    describe: (n) =>
      `The tour-note field of the Log Activity composer on ${n}'s contact page — the broker's record of a tour that already happened, NOT yet logged.`,
    actions: RECAP_REVISIONS,
  },
};

/** The sparkle's hover label: what the click will do, given the field's state. */
export function fieldAskLabel(activity: ComposeKind, hasValue: boolean): string {
  return hasValue ? "Revise" : FIELDS[activity].emptyLabel;
}

/**
 * One field of a contact's Log Activity composer, handed to Otto.
 *
 * The empty case asks rather than generating. A blank field has nothing to
 * revise and, for four of the five, nothing to derive from — the broker has
 * just come off a call the record knows nothing about, which is the whole
 * reason they are logging it — so a generated first draft would be invention.
 * Asking is the honest move, and it is also the fastest: the answer to "what
 * should this cover?" is the prompt.
 */
export function activityFieldAsk({
  activity,
  contactId,
  fullName,
  firstName,
  value,
}: {
  activity: ComposeKind;
  contactId: string;
  fullName: string;
  firstName: string;
  /** The field as it currently stands; empty or whitespace means "generate". */
  value: string;
}): FieldAsk {
  const spec = FIELDS[activity];
  const text = value.trim();
  const base = {
    label: `${fullName}: ${spec.noun}`,
    target: { kind: "contact-activity" as const, contactId, activity },
    description: spec.describe(fullName),
    value: text,
  };

  if (!text) {
    return { ...base, opener: spec.ask(firstName), actions: [] };
  }

  return {
    ...base,
    opener: `I've got your ${spec.noun.toLowerCase()} for ${fullName}. Tell me how you'd like it changed — or take one of these:`,
    actions: spec.actions,
  };
}
