import { getContactDetailClient } from "#/data/selectors";
import { contactActivity, hasInbound, ownedPropertiesFor } from "#/ai/recordQueries";

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

  // The brief prompt asks for a PROPERTY OWNERSHIP section; without this it had
  // nothing to write one from.
  const owned = ownedPropertiesFor(contact);
  lines.push(
    owned.length
      ? `PROPERTIES OWNED:\n${owned
          .map(
            (p) =>
              `- ${p.name || [p.street, p.city].filter(Boolean).join(", ")} | ${p.propertyType}${
                p.buildingSqFt ? ` | ${p.buildingSqFt.toLocaleString()} SF` : ""
              } | id: ${p.id}`,
          )
          .join("\n")}`
      : "PROPERTIES OWNED: none on record",
  );

  if (deals.length === 0) {
    lines.push("DEALS: none on record");
  } else {
    lines.push("DEALS:");
    for (const d of deals) {
      lines.push(`- ${d.name} | status: ${d.status} | type: ${d.dealType}`);
    }
  }

  // The brief prompt asks for a RECENT ACTIVITY section and this dump used to
  // supply nothing to fill it — so every brief was written blind to the
  // timeline the broker is looking at while they read it.
  //
  // Replies are spelled out on their own line rather than folded into the sent
  // message, because on this timeline the contact's answer is stored INSIDE the
  // email it answers. Summarized as one line each, a brief would otherwise read
  // as though she never wrote back.
  const activity = contactActivity(contactId).slice(0, 15);
  if (activity.length === 0) {
    lines.push("RECENT ACTIVITY: none logged");
  } else {
    lines.push("RECENT ACTIVITY (newest first):");
    for (const a of activity) {
      const day = a.timestamp.slice(0, 10);
      const way = a.direction === "in" ? "inbound" : a.direction === "out" ? "outbound" : "logged";
      lines.push(`- ${day} | ${a.type} (${way}) | ${a.title}${a.body ? ` — ${a.body}` : ""}`);
      if (a.reply) {
        lines.push(
          `  ↳ REPLY FROM ${a.reply.from}${a.reply.delay ? ` (${a.reply.delay})` : ""}: ${a.reply.body}`,
        );
      }
      for (const m of a.thread ?? []) {
        lines.push(`  ↳ ${m.direction === "in" ? "FROM" : "TO"} ${m.sender}: ${m.body}`);
      }
      if (a.attachments?.length) lines.push(`  ↳ ATTACHED: ${a.attachments.join(", ")}`);
    }
    const lastFromThem = activity.find(hasInbound);
    lines.push(
      lastFromThem
        ? `LAST WORD FROM THEM: ${lastFromThem.timestamp.slice(0, 10)} (${lastFromThem.type})`
        : "LAST WORD FROM THEM: nothing inbound on record",
    );
  }

  return lines.join("\n");
}
