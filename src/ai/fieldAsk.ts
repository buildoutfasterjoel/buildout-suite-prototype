import type { FieldAsk, FieldAskAction } from "#/ai/useAssistant";

/**
 * Per-field-type presets for the "ask at the rail, review at the field"
 * grammar. One builder per field: it owns the chip label, the description the
 * model is given, Otto's opener, and the quick actions — so the surface that
 * renders the sparkle only has to hand over the record and the current value.
 *
 * Note that no preset carries the field's text. The value travels in the
 * assistant's CURRENT CONTEXT block (see `src/ai/context.ts`), which is both
 * live — it follows the broker's edits after the chip was pinned — and legible:
 * the prompt a chip sends is also the user bubble the broker reads back, and
 * "Shorten this note, keeping every fact." looks like something a person typed.
 * Inlining the note made every chip click render a wall of quoted machinery.
 */

/** The three revisions a jotted activity note actually wants. */
const NOTE_REVISIONS: FieldAskAction[] = [
  {
    label: "Shorten",
    prompt: "Shorten this note, keeping every fact in it.",
  },
  {
    label: "More formal",
    prompt: "Rewrite this note in a more formal register, without adding anything it doesn't say.",
  },
  {
    label: "Clean up the wording",
    prompt:
      "Fix the grammar and shorthand in this note, leaving its meaning and level of detail exactly as they are.",
  },
];

/**
 * The Note field on a contact's activity composer.
 *
 * The empty case asks rather than generating. A blank note has nothing to
 * revise and nothing to derive from — the broker has just come off a call the
 * record knows nothing about, which is the whole reason they're logging it — so
 * a generated first draft would be invention. Asking is the honest move, and it
 * is also the fastest: the answer to "what should this cover?" is the prompt.
 */
export function noteFieldAsk({
  contactId,
  fullName,
  firstName,
  value,
}: {
  contactId: string;
  fullName: string;
  firstName: string;
  /** The note as it currently stands; empty or whitespace means "generate". */
  value: string;
}): FieldAsk {
  const note = value.trim();
  const base = {
    label: `${fullName}: Note`,
    target: { kind: "contact-note" as const, contactId },
    description: `The Note field of the Log Activity composer on ${fullName}'s contact page — an activity note the broker is writing but has NOT logged yet.`,
    value: note,
  };

  if (!note) {
    return {
      ...base,
      opener: `What should this note about ${firstName} cover? Give me the gist — who you spoke to, what was said, what got decided — and I'll write it up.`,
      actions: [],
    };
  }

  return {
    ...base,
    opener: `I've got your note for ${fullName}. Tell me how you'd like it changed — or take one of these:`,
    actions: NOTE_REVISIONS,
  };
}
