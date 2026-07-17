import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faXmark, faStar } from "@fortawesome/pro-regular-svg-icons";
import { faStar as faStarSolid } from "@fortawesome/pro-solid-svg-icons";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import type { Contact, ContactSource } from "#/data/types";
import type { EditContactInput } from "#/data/actions";
import {
  CONTACT_SOURCES,
  contactFullName,
} from "#/components/contacts/contactDisplay";
import { notify } from "#/lib/notify";

const PHONE_TYPES = ["Mobile", "Office", "Home", "Direct", "Other"];
const EMAIL_TYPES = ["Work", "Personal", "Other"];

/**
 * Opt these fields out of password managers / autofill plugins. Their injected
 * overlay icons (e.g. LastPass) otherwise shift the field layout on focus. Each
 * data-attribute targets a specific manager; `autoComplete="off"` is the generic.
 */
const NO_AUTOFILL = {
  autoComplete: "off",
  "data-lpignore": "true", // LastPass
  "data-1p-ignore": "true", // 1Password
  "data-bwignore": "true", // Bitwarden
  "data-form-type": "other", // Dashlane / generic
} as const;

interface Row {
  type: string;
  value: string;
}

/** Split a full name into first + rest-as-last on the first space. */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  const firstName = parts.shift() ?? "";
  return { firstName, lastName: parts.join(" ") };
}

/** Seed one row per distinct value, or a single blank row when there are none. */
function toRows(values: string[], defaultType: string): Row[] {
  const distinct = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  const rows = distinct.map((value) => ({ type: defaultType, value }));
  return rows.length ? rows : [{ type: defaultType, value: "" }];
}

/**
 * The Edit Contact form — the same field set as the New Contact modal, pre-filled
 * from an existing contact. Phones and emails are repeatable typed rows, so a
 * contact can carry several of each; the first non-empty value of each becomes the
 * primary and the rest are stored as extras.
 */
export function EditContactModal({
  open,
  onOpenChange,
  contact,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
  onSave: (id: string, input: EditContactInput) => void;
}) {
  const [name, setName] = useState("");
  const [entity, setEntity] = useState("");
  const [role, setRole] = useState("");
  const [phones, setPhones] = useState<Row[]>([{ type: "Mobile", value: "" }]);
  // Index of the phone row marked primary — the number the call module dials by
  // default. The contact loads with its primary first, so this starts at 0.
  const [primaryPhone, setPrimaryPhone] = useState(0);
  const [emails, setEmails] = useState<Row[]>([{ type: "Work", value: "" }]);
  const [source, setSource] = useState<ContactSource>(contact.source);
  const [doNotCall, setDoNotCall] = useState(false);
  const [notes, setNotes] = useState("");

  // Re-seed the form from the contact each time the modal opens, so re-opening
  // after a cancelled edit discards the abandoned changes.
  useEffect(() => {
    if (!open) return;
    setName(contactFullName(contact));
    setEntity(contact.company);
    setRole(contact.title);
    setPhones(toRows([contact.phone, ...(contact.phones ?? [])], "Mobile"));
    setPrimaryPhone(0);
    setEmails(toRows([contact.email, ...(contact.emails ?? [])], "Work"));
    setSource(contact.source);
    setDoNotCall(contact.doNotCall);
    setNotes(contact.notes ?? "");
  }, [open, contact]);

  const updateRow = (
    rows: Row[],
    setRows: (r: Row[]) => void,
    i: number,
    patch: Partial<Row>,
  ) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  // Removing a phone row shifts the primary marker: drop the removed row and keep
  // the same phone primary (or fall back to the first if the primary was removed).
  const removePhone = (i: number) => {
    setPhones(phones.filter((_, idx) => idx !== i));
    setPrimaryPhone((prev) => {
      if (i === prev) return 0;
      return i < prev ? prev - 1 : prev;
    });
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      notify({ title: "Name is required" });
      return;
    }
    // Lead with the row marked primary so it lands as `contact.phone`.
    const orderedPhones = [
      phones[primaryPhone],
      ...phones.filter((_, idx) => idx !== primaryPhone),
    ];
    const phoneValues = orderedPhones.map((p) => p.value.trim()).filter(Boolean);
    const emailValues = emails.map((e) => e.value.trim()).filter(Boolean);
    if (phoneValues.length === 0 && emailValues.length === 0) {
      notify({ title: "Phone or email is required" });
      return;
    }
    const { firstName, lastName } = splitName(trimmed);
    onSave(contact.id, {
      firstName,
      lastName,
      company: entity.trim() || undefined,
      title: role.trim() || undefined,
      phone: phoneValues[0] ?? "",
      phones: phoneValues.slice(1),
      email: emailValues[0] ?? "",
      emails: emailValues.slice(1),
      source,
      doNotCall,
      notes: notes.trim() || undefined,
    });
    notify({ title: `${trimmed} updated` });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content
        size="lg"
        scrollable
        centered
        style={{ maxWidth: "34.375rem" }}
      >
        <Modal.Header>
          <Modal.Title>Edit Contact</Modal.Title>
          <Modal.Description>
            Name + at least one of phone or email. Everything else is optional.
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          <Field>
            <Field.Label>Name</Field.Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
              {...NO_AUTOFILL}
            />
          </Field>

          <Field>
            <Field.Label className="d-flex align-items-center gap-2">
              Entity
              <span className="text-muted fw-normal fs-small">
                company / trust / LLC
              </span>
            </Field.Label>
            <Input
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              placeholder="e.g. Pinckney Holdings LLC"
              {...NO_AUTOFILL}
            />
          </Field>

          <Field>
            <Field.Label className="d-flex align-items-center gap-2">
              Role
              <span className="text-muted fw-normal fs-small">Optional</span>
            </Field.Label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Managing Partner"
              {...NO_AUTOFILL}
            />
          </Field>

          {/* Phone numbers */}
          <Field>
            <Field.Label className="d-flex align-items-center gap-2">
              Phone Numbers
              {phones.length > 1 && (
                <span className="text-muted fw-normal fs-small">
                  star the primary — it's dialed by default
                </span>
              )}
            </Field.Label>
            <div className="d-flex flex-column gap-2">
              {phones.map((row, i) => (
                <div key={i} className="d-flex align-items-center gap-2">
                  {phones.length > 1 && (
                    <Tooltip>
                      <Tooltip.Trigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={
                              i === primaryPhone
                                ? "Primary phone"
                                : "Set as primary phone"
                            }
                            aria-pressed={i === primaryPhone}
                            className="flex-shrink-0"
                            onClick={() => setPrimaryPhone(i)}
                          >
                            <FontAwesomeIcon
                              icon={i === primaryPhone ? faStarSolid : faStar}
                              className={
                                i === primaryPhone ? "text-warning" : "text-muted"
                              }
                            />
                          </Button>
                        }
                      />
                      <Tooltip.Content>
                        {i === primaryPhone
                          ? "Primary number"
                          : "Set as primary number"}
                      </Tooltip.Content>
                    </Tooltip>
                  )}
                  <div style={{ width: 120 }} className="flex-shrink-0">
                    <Select
                      value={row.type}
                      onValueChange={(v) =>
                        updateRow(phones, setPhones, i, { type: v ?? "Mobile" })
                      }
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {PHONE_TYPES.map((t) => (
                          <Select.Item key={t} value={t}>
                            {t}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                  <Input
                    type="tel"
                    className="flex-grow-1"
                    value={row.value}
                    onChange={(e) =>
                      updateRow(phones, setPhones, i, { value: e.target.value })
                    }
                    placeholder="(555) 555-1234"
                    {...NO_AUTOFILL}
                  />
                  {phones.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove phone"
                      onClick={() => removePhone(i)}
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="align-self-center mt-1"
              onClick={() => setPhones([...phones, { type: "Mobile", value: "" }])}
            >
              <FontAwesomeIcon icon={faPlus} />
              Add phone
            </Button>
          </Field>

          {/* Emails */}
          <Field>
            <Field.Label className="d-flex align-items-center gap-2">
              Emails
              <span className="text-muted fw-normal fs-small">
                at least one phone or email
              </span>
            </Field.Label>
            <div className="d-flex flex-column gap-2">
              {emails.map((row, i) => (
                <div key={i} className="d-flex align-items-center gap-2">
                  <div style={{ width: 120 }} className="flex-shrink-0">
                    <Select
                      value={row.type}
                      onValueChange={(v) =>
                        updateRow(emails, setEmails, i, { type: v ?? "Work" })
                      }
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        {EMAIL_TYPES.map((t) => (
                          <Select.Item key={t} value={t}>
                            {t}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                  <Input
                    type="email"
                    className="flex-grow-1"
                    value={row.value}
                    onChange={(e) =>
                      updateRow(emails, setEmails, i, { value: e.target.value })
                    }
                    placeholder="name@example.com"
                    {...NO_AUTOFILL}
                  />
                  {emails.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove email"
                      onClick={() =>
                        setEmails(emails.filter((_, idx) => idx !== i))
                      }
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="align-self-center mt-1"
              onClick={() => setEmails([...emails, { type: "Work", value: "" }])}
            >
              <FontAwesomeIcon icon={faPlus} />
              Add email
            </Button>
          </Field>

          {/* Lead source */}
          <Field>
            <Field.Label>Lead Source</Field.Label>
            <Select
              value={source}
              onValueChange={(v) => setSource((v as ContactSource) ?? contact.source)}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {CONTACT_SOURCES.map((s) => (
                  <Select.Item key={s} value={s}>
                    {s}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>

          {/* Do not call */}
          <label className="d-flex align-items-center gap-2" role="presentation">
            <Checkbox
              checked={doNotCall}
              onCheckedChange={(c) => setDoNotCall(c === true)}
              aria-label="Do Not Call"
            />
            <span>
              Do Not Call{" "}
              <span className="text-muted fs-small">
                (respects DNC list, AI prompts skip this contact)
              </span>
            </span>
          </label>

          {/* Notes */}
          <Field>
            <Field.Label className="d-flex align-items-center gap-2">
              Notes
              <span className="text-muted fw-normal fs-small">Optional</span>
            </Field.Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering"
              {...NO_AUTOFILL}
            />
          </Field>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
