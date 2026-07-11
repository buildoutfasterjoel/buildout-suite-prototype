import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faMagnifyingGlass,
  faSignHanging,
  faMagnifyingGlassDollar,
  faCloudArrowUp,
  faFileLines,
  faXmark,
  faUser,
  faCheck,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, DealSide, DealDocument } from "#/data/types";
import { emptyDraft, type NewListingDraft } from "#/data/createListing";
import { createDeal } from "#/data/actions";
import {
  getPropertyOptions,
  getContactOptions,
  type PropertyOption,
  type ContactOption,
} from "#/data/store";
import {
  TYPE_ICONS,
  TYPE_LABELS,
} from "#/components/properties/propertyDisplay";
import { RelationshipPill } from "#/components/contacts/pills";

/** The two sides a broker can start a deal on, in display order. */
const SIDES: {
  side: DealSide;
  title: string;
  blurb: string;
  icon: IconDefinition;
  color: string;
}[] = [
  {
    side: "seller",
    title: "Listing",
    blurb: "Sell-side · take their property to market",
    icon: faSignHanging,
    color: "var(--side-seller)",
  },
  {
    side: "buyer",
    title: "Buyer",
    blurb: "Buy-side · they want a property you represent",
    icon: faMagnifyingGlassDollar,
    color: "var(--side-buyer)",
  },
];

const MAX_FILES = 5;
const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

function contactName(c: Contact): string {
  return `${c.firstName} ${c.lastName}`.trim();
}

export function CreateDealModal({
  open,
  onOpenChange,
  contact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When present, the deal is initiated for this contact (contact field prefilled). */
  contact?: Contact;
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [side, setSide] = useState<DealSide | null>(null);
  const [contactOption, setContactOption] = useState<ContactOption | null>(
    null,
  );
  const [propertyOption, setPropertyOption] = useState<PropertyOption | null>(
    null,
  );
  const [propertyInput, setPropertyInput] = useState("");
  const [files, setFiles] = useState<DealDocument[]>([]);
  const [dragging, setDragging] = useState(false);

  const propertyOptions = useMemo<PropertyOption[]>(getPropertyOptions, []);
  const contactOptions = useMemo<ContactOption[]>(getContactOptions, []);

  // Seed from the initiating contact each time the modal opens: prefill the
  // contact and pre-select the side from how they sit on their current deal.
  useEffect(() => {
    if (!open) return;
    if (contact) {
      setContactOption({
        value: contact.id,
        label: contactName(contact),
        name: contactName(contact),
        company: contact.company,
        title: contact.title,
        relationship: contact.relationship,
      });
      setSide(contact.side);
    } else {
      setContactOption(null);
      setSide(null);
    }
    setPropertyOption(null);
    setPropertyInput("");
    setFiles([]);
    setDragging(false);
  }, [open, contact]);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setFiles((prev) => {
      const next = [...prev];
      for (const file of Array.from(list)) {
        if (next.length >= MAX_FILES) break;
        if (next.some((f) => f.name === file.name)) continue;
        next.push({
          id: crypto.randomUUID(),
          name: file.name,
          uploadedAt: new Date().toISOString(),
        });
      }
      return next;
    });
  }

  function selectProperty(option: PropertyOption | null) {
    setPropertyOption(option);
    setPropertyInput(option?.label ?? "");
  }

  function typeProperty(text: string) {
    setPropertyInput(text);
    // Editing the text past a prior selection turns it into a free-typed address.
    setPropertyOption((prev) => (prev && text !== prev.label ? null : prev));
  }

  const hasProperty = propertyOption !== null || propertyInput.trim() !== "";
  const canCreate = side !== null && contactOption !== null && hasProperty;

  function handleCreate() {
    if (!canCreate || !side) return;
    const contactId = contactOption?.value ?? "";
    const draft: NewListingDraft = {
      ...emptyDraft(),
      dealSide: side,
      propertyId: propertyOption?.value ?? "",
      address: propertyOption ? "" : propertyInput.trim(),
      sellerContactId: side === "seller" ? contactId : "",
      buyerContactId: side === "buyer" ? contactId : "",
      documents: files,
    };
    const { deal: listing } = createDeal(draft);
    onOpenChange(false);
    void navigate({
      to: "/listings/$listingId/overview",
      params: { listingId: listing.id },
    });
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content
        size="lg"
        scrollable
        centered
        style={{ maxWidth: "34.375rem" }}
      >
        <Modal.Header>
          <Modal.Title>New deal</Modal.Title>
          <Modal.Description>
            {contact
              ? `For ${contactName(contact)} · set the property and link the listing.`
              : "Set the side, contact, and property to start a deal."}
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          {/* Side */}
          <Field>
            <Field.Label>Side</Field.Label>
            <div className="row g-3">
              {SIDES.map((s) => {
                const active = side === s.side;
                return (
                  <div key={s.side} className="col-6">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSide(s.side)}
                      className="w-100 h-100 text-start border rounded p-3 d-flex flex-column gap-1 bg-transparent"
                      style={{
                        borderColor: active ? s.color : undefined,
                        boxShadow: active ? `0 0 0 1px ${s.color}` : undefined,
                        cursor: "pointer",
                      }}
                    >
                      <span
                        className="d-inline-flex align-items-center gap-2 fw-semibold"
                        style={{ color: active ? s.color : undefined }}
                      >
                        <FontAwesomeIcon icon={s.icon} />
                        {s.title}
                      </span>
                      <span className="text-muted fs-small">{s.blurb}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </Field>

          {/* Contact — only when not initiated from a contact */}
          {!contact && (
            <Field>
              <Field.Label>Contact</Field.Label>
              <Combobox
                items={contactOptions}
                value={contactOption}
                onValueChange={(v) =>
                  setContactOption(v as ContactOption | null)
                }
              >
                <Combobox.InputGroup>
                  <InputGroup.Addon>
                    <FontAwesomeIcon icon={faUser} />
                  </InputGroup.Addon>
                  <Combobox.Input placeholder="Search contacts…" showClear />
                </Combobox.InputGroup>
                <Combobox.Content>
                  <Combobox.Empty className="text-muted">
                    No matching contacts
                  </Combobox.Empty>
                  <Combobox.List>
                    {(item: ContactOption) => {
                      const meta = [item.title, item.company]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <Combobox.Item key={item.value} value={item}>
                          <span
                            className="d-flex gap-2 user-select-none"
                            style={{ minWidth: 0 }}
                          >
                            <FontAwesomeIcon
                              icon={faUser}
                              className="text-muted flex-shrink-0 d-inline-block mt-1"
                            />
                            <span
                              className="d-flex flex-column"
                              style={{ minWidth: 0 }}
                            >
                              <span className="d-flex align-items-center gap-2">
                                <span className="text-truncate">
                                  {item.name}
                                </span>
                                <span className="flex-shrink-0">
                                  <RelationshipPill value={item.relationship} />
                                </span>
                              </span>
                              {meta && (
                                <span className="text-muted fs-small text-truncate">
                                  {meta}
                                </span>
                              )}
                            </span>
                          </span>
                        </Combobox.Item>
                      );
                    }}
                  </Combobox.List>
                </Combobox.Content>
              </Combobox>
            </Field>
          )}

          {/* Property */}
          <Field>
            <Field.Label>Property</Field.Label>
            <Combobox
              items={propertyOptions}
              value={propertyOption}
              onValueChange={(v) => selectProperty(v as PropertyOption | null)}
              inputValue={propertyInput}
              onInputValueChange={(v: string) => typeProperty(v)}
            >
              <Combobox.InputGroup>
                <InputGroup.Addon>
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </InputGroup.Addon>
                <Combobox.Input
                  placeholder="Search a listing or type an address…"
                  showClear
                />
              </Combobox.InputGroup>
              <Combobox.Content>
                <Combobox.Empty className="text-muted">
                  No match — we’ll create a new property from what you typed.
                </Combobox.Empty>
                <Combobox.List>
                  {(item: PropertyOption) => (
                    <Combobox.Item key={item.value} value={item}>
                      <span
                        className="d-flex gap-2 user-select-none"
                        style={{ minWidth: 0 }}
                      >
                        <FontAwesomeIcon
                          icon={TYPE_ICONS[item.propertyType]}
                          className="text-muted flex-shrink-0 d-inline-block mt-1"
                        />
                        <span
                          className="d-flex flex-column"
                          style={{ minWidth: 0 }}
                        >
                          <span className="d-flex align-items-center gap-2">
                            <span className="text-truncate">{item.label}</span>
                            <Badge
                              variant="secondary"
                              appearance="muted"
                              className="flex-shrink-0"
                            >
                              {TYPE_LABELS[item.propertyType]}
                            </Badge>
                          </span>
                          <span className="text-muted fs-small text-truncate">
                            {item.subtype}
                            {item.sizeLabel ? ` · ${item.sizeLabel}` : ""}
                          </span>
                        </span>
                      </span>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Content>
            </Combobox>
          </Field>

          {/* Context files */}
          <Field>
            <Field.Label className="d-flex align-items-center gap-2">
              Context files
              <span className="text-primary fw-normal">Optional</span>
            </Field.Label>
            <Field.Description>
              Add OMs, financials, or notes to help inform this deal.
            </Field.Description>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED}
              className="d-none"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className="border border-2 border-dashed rounded d-flex flex-column align-items-center justify-content-center text-center gap-1 p-4"
              style={{
                borderColor: dragging ? "var(--bs-primary)" : undefined,
                cursor: "pointer",
              }}
            >
              <FontAwesomeIcon
                icon={faCloudArrowUp}
                className="text-muted fs-4"
                aria-hidden
              />
              <span>
                Drop files here or{" "}
                <span className="text-primary">click to upload</span>
              </span>
              <span className="text-muted fs-small">
                PDF, Word, Excel, or PowerPoint · up to {MAX_FILES} files
              </span>
            </div>

            {files.length > 0 && (
              <div className="d-flex flex-column gap-2 mt-2">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="d-flex align-items-center gap-2 border rounded px-3 py-2"
                  >
                    <FontAwesomeIcon
                      icon={faFileLines}
                      className="text-muted"
                    />
                    <span className="flex-grow-1 text-truncate fs-small">
                      {f.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${f.name}`}
                      onClick={() =>
                        setFiles((prev) => prev.filter((x) => x.id !== f.id))
                      }
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Field>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canCreate}
            onClick={handleCreate}
          >
            <FontAwesomeIcon icon={faCheck} />
            Create deal
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
