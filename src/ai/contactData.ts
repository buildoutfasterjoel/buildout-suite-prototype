import { getContactDetailClient } from "#/data/selectors";

/**
 * Plain-text data dump for ONE contact, fed to `generateContactBrief` (§3.10).
 * One field per line, no markdown — this is the SAME dump shared by the
 * `research_contact`/`answer_about_contact` agent tools (`src/ai/tools.ts`)
 * and the in-context "Brief me" affordance on the contact detail page
 * (`src/routes/_shell/backoffice/contacts/$contactId.tsx`), so both stay in
 * lockstep on what the model sees.
 */
export function composeContactData(contactId: string): string {
  const detail = getContactDetailClient(contactId);
  if (!detail) return "";
  const { contact, deals } = detail;

  const lines: string[] = [
    `NAME: ${`${contact.firstName} ${contact.lastName}`.trim()}`,
    `ROLE: ${contact.role}`,
    `TITLE: ${contact.title || "—"}`,
    `COMPANY: ${contact.company || "—"}`,
    `RELATIONSHIP: ${contact.relationship}`,
    `NOTES: ${contact.notes?.trim() || "—"}`,
    `LAST TOUCH: ${contact.lastTouch || "—"}`,
  ];

  if (deals.length === 0) {
    lines.push("DEALS: none on record");
  } else {
    lines.push("DEALS:");
    for (const d of deals) {
      lines.push(`- ${d.name} | status: ${d.status} | type: ${d.dealType}`);
    }
  }

  return lines.join("\n");
}
