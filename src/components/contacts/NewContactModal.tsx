import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faXmark } from "@fortawesome/pro-regular-svg-icons";
import type { ContactSource } from "#/data/types";
import type { NewContactInput } from "#/data/actions";
import { CONTACT_SOURCES } from "#/components/contacts/contactDisplay";
import { notify } from "#/lib/notify";

const PHONE_TYPES = ["Mobile", "Office", "Home", "Direct", "Other"];
const EMAIL_TYPES = ["Work", "Personal", "Other"];
const DEFAULT_SOURCE: ContactSource = "Manual entry";

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

/**
 * The New Contact form — a Blueprint recreation of the reference CRM's
 * "New Contact" modal. Name plus at least one phone or email is required;
 * everything else is optional. Phones and emails are repeatable typed rows.
 */
export function NewContactModal({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewContactInput) => void;
}) {
  const [name, setName] = useState("");
  const [entity, setEntity] = useState("");
  const [role, setRole] = useState("");
  const [phones, setPhones] = useState<Row[]>([{ type: "Mobile", value: "" }]);
  const [emails, setEmails] = useState<Row[]>([{ type: "Work", value: "" }]);
  const [source, setSource] = useState<ContactSource>(DEFAULT_SOURCE);
  const [doNotCall, setDoNotCall] = useState(false);
  const [notes, setNotes] = useState("");

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (open) {
      setName("");
      setEntity("");
      setRole("");
      setPhones([{ type: "Mobile", value: "" }]);
      setEmails([{ type: "Work", value: "" }]);
      setSource(DEFAULT_SOURCE);
      setDoNotCall(false);
      setNotes("");
    }
  }, [open]);

  const updateRow = (
    rows: Row[],
    setRows: (r: Row[]) => void,
    i: number,
    patch: Partial<Row>,
  ) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      notify({ title: "Name is required" });
      return;
    }
    const firstPhone = phones.map((p) => p.value.trim()).find(Boolean);
    const firstEmail = emails.map((e) => e.value.trim()).find(Boolean);
    if (!firstPhone && !firstEmail) {
      notify({ title: "Phone or email is required" });
      return;
    }
    const { firstName, lastName } = splitName(trimmed);
    onCreate({
      firstName,
      lastName,
      company: entity.trim() || undefined,
      title: role.trim() || undefined,
      phone: firstPhone,
      email: firstEmail,
      source,
      doNotCall,
      notes: notes.trim() || undefined,
    });
    notify({ title: `${trimmed} added to CRM` });
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
          <Modal.Title>New Contact</Modal.Title>
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
            <Field.Label>Phone Numbers</Field.Label>
            <div className="d-flex flex-column gap-2">
              {phones.map((row, i) => (
                <div key={i} className="d-flex align-items-center gap-2">
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
                      onClick={() =>
                        setPhones(phones.filter((_, idx) => idx !== i))
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
              onValueChange={(v) => setSource((v as ContactSource) ?? DEFAULT_SOURCE)}
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
            Close
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
