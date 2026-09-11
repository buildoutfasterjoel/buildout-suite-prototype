import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Contact } from "#/data/types";

function initials(c: Contact): string {
  return `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase();
}

/**
 * A contact as a compact identity — Figma "Contact Chip" (My Sandbox
 * 1567:50174): a 28px gradient avatar with 10px initials beside a two-line
 * block that fills the row. Line one is the name (14/19 semibold) with the
 * role floated to the far right (12/16 muted); line two is the company, with
 * an optional trailing slot (`secondaryEnd`) mirroring the role's position —
 * the space rail puts its "Property" / "Deal" source tag there.
 *
 * Used for the contact rows in the property and space rails. Styles in
 * `main.scss` under `.contact-identity-chip`. Links to the contact's record
 * unless `link` is false.
 */
export function ContactIdentityChip({
  contact,
  role,
  secondary,
  secondaryEnd,
  link = true,
}: {
  contact: Contact;
  /** The right-hand word on the name line, e.g. "Buyer". Falls back to the book role. */
  role?: string;
  /** The second line, e.g. the company. Falls back to the contact's company. */
  secondary?: string;
  /** Optional trailing content on the second line, aligned under the role. */
  secondaryEnd?: ReactNode;
  link?: boolean;
}) {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  const roleText = role ?? contact.role;
  const secondaryText = secondary ?? contact.company;
  const body = (
    <>
      <span className="contact-identity-chip__avatar" aria-hidden="true">
        {initials(contact)}
      </span>
      <span className="contact-identity-chip__text">
        <span className="contact-identity-chip__row">
          <span className="contact-identity-chip__name" title={name}>
            {name}
          </span>
          {roleText && (
            <span className="contact-identity-chip__role" title={roleText}>
              {roleText}
            </span>
          )}
        </span>
        {(secondaryText || secondaryEnd) && (
          <span className="contact-identity-chip__row">
            <span className="contact-identity-chip__detail" title={secondaryText}>
              {secondaryText}
            </span>
            {secondaryEnd}
          </span>
        )}
      </span>
    </>
  );
  if (!link) return <span className="contact-identity-chip">{body}</span>;
  return (
    <Link
      to="/backoffice/contacts/$contactId"
      params={{ contactId: contact.id }}
      className="contact-identity-chip text-decoration-none text-reset"
    >
      {body}
    </Link>
  );
}
