import { useEffect, useMemo, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faXmark,
  faTrash,
  faBuilding,
  faMagnifyingGlass,
} from "@fortawesome/pro-regular-svg-icons";
import type { ContactSource } from "#/data/types";
import type { NewContactInput } from "#/data/actions";
import { getStore } from "#/data/store";
import { CONTACT_SOURCES } from "#/components/contacts/contactDisplay";
import { US_STATES, stateLabel } from "#/components/contacts/usStates";
import { notify } from "#/lib/notify";

const PHONE_TYPES = ["Mobile", "Office", "Home", "Direct", "Other"];
const EMAIL_TYPES = ["Work", "Personal", "Other"];
const DEFAULT_SOURCE: ContactSource = "Manual entry";

/**
 * Opt these fields out of password managers / autofill plugins (LastPass,
 * Dashlane, 1Password, Bitwarden). Their injected overlay icons otherwise shift
 * the field layout on focus. Spread onto every free-text input in the form.
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

interface AddressRow {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

const blankAddress = (): AddressRow => ({
  name: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip: "",
});

/** Split a full name into first + rest-as-last on the first space. */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  const firstName = parts.shift() ?? "";
  return { firstName, lastName: parts.join(" ") };
}

/**
 * A field label that does NOT associate (htmlFor) with its control, so clicking
 * it can't open an adjacent dropdown (Select/Combobox). `nativeLabel={false}`
 * keeps the styled label element but drops the native for-association.
 */
function PlainLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Field.Label nativeLabel={false} render={<span />} className={className}>
      {children}
    </Field.Label>
  );
}

/**
 * The New Contact form — a Blueprint recreation of the reference CRM's
 * "New Contact" modal. Name plus at least one phone or email is required;
 * everything else is optional. Phones, emails, and addresses are repeatable
 * rows. The company/entity is a lookup that also supports creating a new
 * company; when present it captures a job title in place of the free-text Role.
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
  const [role, setRole] = useState("");
  const [phones, setPhones] = useState<Row[]>([{ type: "Mobile", value: "" }]);
  const [emails, setEmails] = useState<Row[]>([{ type: "Work", value: "" }]);
  const [source, setSource] = useState<ContactSource>(DEFAULT_SOURCE);
  const [doNotCall, setDoNotCall] = useState(false);
  const [notes, setNotes] = useState("");

  // Company/entity lookup (hidden until the user adds one).
  const [showCompany, setShowCompany] = useState(false);
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);
  const [createdCompanies, setCreatedCompanies] = useState<string[]>([]);

  // Addresses (hidden until the user adds one).
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [primaryAddress, setPrimaryAddress] = useState(0);

  // Reset the form each time the modal opens.
  useEffect(() => {
    if (open) {
      setName("");
      setRole("");
      setPhones([{ type: "Mobile", value: "" }]);
      setEmails([{ type: "Work", value: "" }]);
      setSource(DEFAULT_SOURCE);
      setDoNotCall(false);
      setNotes("");
      setShowCompany(false);
      setCompany("");
      setJobTitle("");
      setCompanyQuery("");
      setCompanyOpen(false);
      setCreatedCompanies([]);
      setAddresses([]);
      setPrimaryAddress(0);
    }
  }, [open]);

  // The "companies database" for the lookup: distinct company names already in
  // the book of business, plus any created here this session.
  const companyItems = useMemo(() => {
    const set = new Set<string>(createdCompanies);
    for (const c of getStore().contacts.values()) {
      const co = c.company?.trim();
      if (co) set.add(co);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [open, createdCompanies]);

  const trimmedCompanyQuery = companyQuery.trim();
  const canCreateCompany =
    trimmedCompanyQuery.length > 0 &&
    !companyItems.some(
      (c) => c.toLowerCase() === trimmedCompanyQuery.toLowerCase(),
    );

  const handleCreateCompany = () => {
    const next = trimmedCompanyQuery;
    if (!next) return;
    setCreatedCompanies((prev) =>
      prev.includes(next) ? prev : [...prev, next],
    );
    setCompany(next);
    setCompanyOpen(false);
  };

  const updateRow = (
    rows: Row[],
    setRows: (r: Row[]) => void,
    i: number,
    patch: Partial<Row>,
  ) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const updateAddress = (i: number, patch: Partial<AddressRow>) =>
    setAddresses((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    );

  const addAddress = () => setAddresses((prev) => [...prev, blankAddress()]);
  const removeAddress = (i: number) =>
    setAddresses((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      // Keep the primary pointer valid as rows shift.
      setPrimaryAddress((p) => (p >= next.length ? Math.max(0, next.length - 1) : p > i ? p - 1 : p));
      return next;
    });

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
    const primary = addresses[primaryAddress];
    onCreate({
      firstName,
      lastName,
      company: showCompany ? company.trim() || undefined : undefined,
      // Job title (tied to a company) replaces the free-text Role when present.
      title: showCompany
        ? jobTitle.trim() || undefined
        : role.trim() || undefined,
      phone: firstPhone,
      email: firstEmail,
      source,
      doNotCall,
      notes: notes.trim() || undefined,
      street: primary?.line1.trim() || undefined,
      city: primary?.city.trim() || undefined,
      state: primary?.state || undefined,
      zip: primary?.zip.trim() || undefined,
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

          {/* Company / entity — hidden until added. When present it also
              captures a job title, replacing the free-text Role field. */}
          {showCompany ? (
            <Field>
              <Field.Label>Company</Field.Label>
              <div className="d-flex align-items-start gap-2">
                <div className="flex-grow-1" style={{ minWidth: 0 }}>
                  <Combobox
                    items={companyItems}
                    value={company || null}
                    onValueChange={(v) => setCompany((v as string | null) ?? "")}
                    onInputValueChange={(v) => setCompanyQuery(v ?? "")}
                    open={companyOpen}
                    onOpenChange={setCompanyOpen}
                  >
                    <Combobox.InputGroup>
                      <InputGroup.Addon>
                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                      </InputGroup.Addon>
                      <Combobox.Input
                        placeholder="Enter company name or email"
                        showTrigger
                        showClear
                        {...NO_AUTOFILL}
                      />
                    </Combobox.InputGroup>
                    <Combobox.Content>
                      <Combobox.Empty className="text-muted p-2">
                        No matching companies
                      </Combobox.Empty>
                      <Combobox.List>
                        {(item: string) => (
                          <Combobox.Item key={item} value={item}>
                            <FontAwesomeIcon
                              icon={faBuilding}
                              className="text-muted me-2"
                            />
                            {item}
                          </Combobox.Item>
                        )}
                      </Combobox.List>
                      {canCreateCompany && (
                        <button
                          type="button"
                          className="btn btn-link text-decoration-none w-100 text-start px-3 py-2 border-top fw-semibold"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={handleCreateCompany}
                        >
                          <FontAwesomeIcon icon={faPlus} className="me-2" />
                          Create new company
                        </button>
                      )}
                    </Combobox.Content>
                  </Combobox>
                </div>
                <div style={{ width: 150 }} className="flex-shrink-0">
                  <Input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Job Title"
                    aria-label="Job Title"
                    {...NO_AUTOFILL}
                  />
                </div>
              </div>
            </Field>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="align-self-start"
                onClick={() => setShowCompany(true)}
              >
                <FontAwesomeIcon icon={faPlus} />
                Add company/entity
              </Button>

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
            </>
          )}

          {/* Phone numbers */}
          <Field>
            <PlainLabel>Phone Numbers</PlainLabel>
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
              className="align-self-start mt-1"
              onClick={() => setPhones([...phones, { type: "Mobile", value: "" }])}
            >
              <FontAwesomeIcon icon={faPlus} />
              Add phone
            </Button>
          </Field>

          {/* Emails */}
          <Field>
            <PlainLabel className="d-flex align-items-center gap-2">
              Emails
              <span className="text-muted fw-normal fs-small">
                at least one phone or email
              </span>
            </PlainLabel>
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
              className="align-self-start mt-1"
              onClick={() => setEmails([...emails, { type: "Work", value: "" }])}
            >
              <FontAwesomeIcon icon={faPlus} />
              Add email
            </Button>
          </Field>

          {/* Addresses — hidden until added; each is repeatable + deletable,
              with one marked primary. */}
          {addresses.length === 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="align-self-start"
              onClick={addAddress}
            >
              <FontAwesomeIcon icon={faPlus} />
              Add address
            </Button>
          ) : (
            <RadioGroup
              value={String(primaryAddress)}
              onValueChange={(v) => setPrimaryAddress(Number(v))}
              className="d-flex flex-column gap-4"
            >
              {addresses.map((addr, i) => (
                <div key={i} className="d-flex flex-column gap-3">
                  <div className="d-flex align-items-center gap-3">
                    <h3 className="fs-5 fw-semibold mb-0 flex-grow-1">
                      Address
                    </h3>
                    <label className="d-flex align-items-center gap-2 mb-0">
                      <RadioGroup.Item value={String(i)} />
                      <span>Primary</span>
                    </label>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete address"
                      onClick={() => removeAddress(i)}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </Button>
                  </div>

                  <Field>
                    <Field.Label>Address name</Field.Label>
                    <Input
                      value={addr.name}
                      onChange={(e) => updateAddress(i, { name: e.target.value })}
                      placeholder="Ex. Buildout, Inc."
                      {...NO_AUTOFILL}
                    />
                  </Field>

                  <Field>
                    <Field.Label>Address line 1</Field.Label>
                    <Input
                      value={addr.line1}
                      onChange={(e) =>
                        updateAddress(i, { line1: e.target.value })
                      }
                      placeholder="Ex. 10 N Street"
                      {...NO_AUTOFILL}
                    />
                  </Field>

                  <Field>
                    <Field.Label>Address line 2</Field.Label>
                    <Input
                      value={addr.line2}
                      onChange={(e) =>
                        updateAddress(i, { line2: e.target.value })
                      }
                      placeholder="Ex. Unit 8"
                      {...NO_AUTOFILL}
                    />
                  </Field>

                  <Field>
                    <Field.Label>City</Field.Label>
                    <Input
                      value={addr.city}
                      onChange={(e) => updateAddress(i, { city: e.target.value })}
                      placeholder="Ex. Chicago"
                      {...NO_AUTOFILL}
                    />
                  </Field>

                  <div className="d-flex gap-3">
                    <div className="flex-grow-1">
                      <Field>
                        <PlainLabel>State</PlainLabel>
                        <Select
                          value={addr.state}
                          onValueChange={(v) =>
                            updateAddress(i, { state: v ?? "" })
                          }
                        >
                          <Select.Trigger>
                            <Select.Value placeholder="Ex. IL - Illinois">
                              {(v: string) =>
                                v ? (
                                  stateLabel(v)
                                ) : (
                                  <span className="text-muted">
                                    Ex. IL - Illinois
                                  </span>
                                )
                              }
                            </Select.Value>
                          </Select.Trigger>
                          <Select.Content>
                            {US_STATES.map((s) => (
                              <Select.Item key={s.code} value={s.code}>
                                {s.code} - {s.name}
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select>
                      </Field>
                    </div>
                    <div style={{ width: 150 }} className="flex-shrink-0">
                      <Field>
                        <Field.Label>Zip</Field.Label>
                        <Input
                          value={addr.zip}
                          onChange={(e) =>
                            updateAddress(i, { zip: e.target.value })
                          }
                          placeholder="Ex. 60610"
                          {...NO_AUTOFILL}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                variant="ghost"
                size="sm"
                className="align-self-start"
                onClick={addAddress}
              >
                <FontAwesomeIcon icon={faPlus} />
                Add another address
              </Button>
            </RadioGroup>
          )}

          {/* Lead source */}
          <Field>
            <PlainLabel>Lead Source</PlainLabel>
            <Select
              value={source}
              onValueChange={(v) =>
                setSource((v as ContactSource) ?? DEFAULT_SOURCE)
              }
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
