import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
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
import type {
  Contact,
  DealSide,
  DealDocument,
  Property,
  PropertyStatus,
} from "#/data/types";
import {
  emptyDraft,
  SUGGESTED_DOCUMENTS,
  type NewListingDraft,
} from "#/data/createListing";
import { createDeal } from "#/data/actions";
import {
  getPropertyOptions,
  getContactOptions,
  getOwnersForProperty,
  getProperty,
  type PropertyOption,
  type ContactOption,
} from "#/data/store";
import { STAGE_LABEL } from "#/data/stageGates";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  PROPERTY_STATUSES,
} from "#/components/properties/propertyDisplay";
import { RelationshipPill } from "#/components/contacts/pills";
import {
  UnderwritingDepth,
  underwritingFromSelection,
  DEFAULT_UNDERWRITING_SELECTION,
} from "./UnderwritingDepth";

/**
 * The two sides a broker can start a deal on, in display order. The `seller`/
 * `buyer` values are the data model; the label + descriptor shown adapt to the
 * deal type — Seller/Buyer for a Sale, Landlord/Tenant for a Lease.
 */
const SIDE_ORDER: DealSide[] = ["seller", "buyer"];

const SIDE_DISPLAY: Record<
  DealSide,
  {
    icon: IconDefinition;
    color: string;
    Sale: { title: string; blurb: string };
    Lease: { title: string; blurb: string };
  }
> = {
  seller: {
    icon: faSignHanging,
    color: "var(--side-seller)",
    Sale: { title: "Seller", blurb: "Sell-side · take their property to market" },
    Lease: {
      title: "Landlord",
      blurb: "Landlord rep · lease their space to tenants",
    },
  },
  buyer: {
    icon: faMagnifyingGlassDollar,
    color: "var(--side-buyer)",
    Sale: {
      title: "Buyer",
      blurb: "Buy-side · find them a property to buy",
    },
    Lease: { title: "Tenant", blurb: "Tenant rep · find space for them to lease" },
  },
};

const MAX_FILES = 5;
const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

function contactName(c: Contact): string {
  return `${c.firstName} ${c.lastName}`.trim();
}

/**
 * Which suggested documents to pre-check for a given underwriting depth: the
 * always-on catalog entries plus any that the chosen depth has unlocked.
 */
function suggestedKeysForDepth(count: number): Set<string> {
  return new Set(
    SUGGESTED_DOCUMENTS.filter(
      (d) => d.defaultOn || (d.minChecks != null && count >= d.minChecks),
    ).map((d) => d.key),
  );
}

export function CreateDealModal({
  open,
  onOpenChange,
  contact,
  property,
  initialAddress,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When present, the deal is initiated for this contact (contact field prefilled + hidden). */
  contact?: Contact;
  /** When present, the deal is initiated for this property (property field prefilled + locked). */
  property?: Property;
  /** Seed text for the property address field when starting from a raw query. */
  initialAddress?: string;
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dealType, setDealType] = useState<NewListingDraft["dealType"]>("Sale");
  const [side, setSide] = useState<DealSide | null>(null);
  const [stage, setStage] = useState<PropertyStatus>("proposal");
  const [contactOption, setContactOption] = useState<ContactOption | null>(
    null,
  );
  const [propertyOption, setPropertyOption] = useState<PropertyOption | null>(
    null,
  );
  const [propertyInput, setPropertyInput] = useState("");
  // When the chosen property already has units, the broker can scope the deal to
  // the whole building (default) or a single existing unit.
  const [wholeBuilding, setWholeBuilding] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [files, setFiles] = useState<DealDocument[]>([]);
  const [dragging, setDragging] = useState(false);
  // Document generation is opt-in — off by default so a deal starts lean unless
  // the broker explicitly wants Buildout to draft collateral.
  const [generateDocsOn, setGenerateDocsOn] = useState(false);
  // Underwriting is optional at creation; when off, the depth control collapses
  // and the deal starts with no underwriting.
  const [underwritingOn, setUnderwritingOn] = useState(false);
  // Underwriting depth + which suggested docs are checked. Sliding the depth
  // re-derives the recommended docs; individual docs can still be toggled after.
  const [underwritingSel, setUnderwritingSel] = useState<Set<number>>(
    () => new Set(DEFAULT_UNDERWRITING_SELECTION),
  );
  const [checkedDocKeys, setCheckedDocKeys] = useState<Set<string>>(() =>
    suggestedKeysForDepth(DEFAULT_UNDERWRITING_SELECTION.size),
  );

  function handleUnderwritingChange(next: Set<number>) {
    setUnderwritingSel(next);
    setCheckedDocKeys(suggestedKeysForDepth(next.size));
  }

  // Turning underwriting off drops the depth-driven doc suggestions back to the
  // always-on set; turning it on re-applies the current depth's suggestions.
  function toggleUnderwriting(on: boolean) {
    setUnderwritingOn(on);
    setCheckedDocKeys(suggestedKeysForDepth(on ? underwritingSel.size : 0));
  }

  function toggleDoc(key: string, on: boolean) {
    setCheckedDocKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  const propertyOptions = useMemo<PropertyOption[]>(() => {
    const all = getPropertyOptions();
    if (!contact || contact.propertyIds.length === 0) return all;
    const owned = new Set(contact.propertyIds);
    // Contact's own properties first (likely the deal's subject), then the rest.
    return [...all].sort((a, b) => {
      const ao = owned.has(a.value) ? 0 : 1;
      const bo = owned.has(b.value) ? 0 : 1;
      return ao - bo || a.label.localeCompare(b.label);
    });
  }, [contact]);
  const contactOptions = useMemo<ContactOption[]>(getContactOptions, []);

  // Resolve the full property record (for its units) from the locked prop or the
  // selected combobox option. Typed-but-unmatched addresses have no record/units.
  const selectedProperty = useMemo<Property | undefined>(
    () => property ?? (propertyOption ? getProperty(propertyOption.value) : undefined),
    [property, propertyOption],
  );
  const units = selectedProperty?.units ?? [];
  const hasUnits = units.length > 0;

  // Reset the scope whenever the property changes — a fresh property defaults to
  // a whole-building deal with no unit chosen.
  useEffect(() => {
    setWholeBuilding(false);
    setSelectedUnitId(null);
  }, [selectedProperty?.id]);

  // Seed from the initiating contact/property each time the modal opens.
  useEffect(() => {
    if (!open) return;

    // Contact context: prefill the contact and infer the side from their deal.
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

    // Property context: lock the property, default to sell-side, and suggest the
    // property's primary owner as the seller (editable).
    if (property) {
      const label = [property.street, property.city, property.state]
        .filter(Boolean)
        .join(", ");
      setPropertyOption({
        value: property.id,
        label,
        propertyType: property.propertyType,
        subtype: property.propertySubtype,
        sizeLabel:
          property.buildingSqFt > 0
            ? `${property.buildingSqFt.toLocaleString()} SF`
            : null,
      });
      setPropertyInput(label);
      if (!contact) {
        setSide("seller");
        const owner = getOwnersForProperty(property.id)[0];
        if (owner) {
          setContactOption({
            value: owner.id,
            label: contactName(owner),
            name: contactName(owner),
            company: owner.company,
            title: owner.title,
            relationship: owner.relationship,
          });
        }
      }
    } else {
      setPropertyOption(null);
      setPropertyInput(initialAddress ?? "");
    }

    setDealType("Sale");
    setStage("proposal");
    setGenerateDocsOn(false);
    setUnderwritingOn(false);
    setUnderwritingSel(new Set(DEFAULT_UNDERWRITING_SELECTION));
    // Underwriting starts off, so the doc suggestions start at the always-on
    // baseline; turning the switch on re-applies the depth-driven set.
    setCheckedDocKeys(suggestedKeysForDepth(0));
    setFiles([]);
    setDragging(false);
  }, [open, contact, property, initialAddress]);

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
  // A unit-scoped deal needs a unit picked; whole-building (or a property with no
  // units) is always fine.
  const unitOk = !hasUnits || wholeBuilding || selectedUnitId !== null;
  const canCreate =
    side !== null && contactOption !== null && hasProperty && unitOk;

  function handleCreate() {
    if (!canCreate || !side) return;
    const contactId = contactOption?.value ?? "";
    const now = new Date().toISOString();
    // Suggested docs + underwriting are pitching-phase setup — a deal started
    // already in-flight skips them (Buildout isn't generating fresh collateral).
    const isPitching = stage === "proposal";
    const suggestedDocuments: DealDocument[] =
      isPitching && generateDocsOn
      ? SUGGESTED_DOCUMENTS.filter((d) => checkedDocKeys.has(d.key)).map(
          (d) => ({
            id: crypto.randomUUID(),
            name: d.name,
            uploadedAt: now,
            aiGenerated: true,
          }),
        )
      : [];
    // Scope to a single unit when one is chosen; otherwise the deal is for the
    // whole building.
    const unit =
      hasUnits && !wholeBuilding && selectedUnitId
        ? units.find((u) => u.id === selectedUnitId)
        : undefined;
    const draft: NewListingDraft = {
      ...emptyDraft(),
      dealType,
      dealSide: side,
      initialStage: stage,
      propertyId: propertyOption?.value ?? "",
      address: propertyOption ? "" : propertyInput.trim(),
      attachAs: unit ? "space" : "building",
      spaceLabel: unit?.label ?? "",
      unitId: unit?.id ?? null,
      sellerContactId: side === "seller" ? contactId : "",
      buyerContactId: side === "buyer" ? contactId : "",
      documents: files,
      suggestedDocuments,
      underwriting:
        isPitching && underwritingOn
          ? underwritingFromSelection(underwritingSel)
          : undefined,
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
          <Tabs
            value={dealType}
            onValueChange={(v) => setDealType(v as NewListingDraft["dealType"])}
            className="mb-3"
          >
            <Tabs.List variant="pills">
              <Tabs.Tab
                value="Sale"
                className="flex-grow-1 justify-content-center"
              >
                Sale
              </Tabs.Tab>
              <Tabs.Tab
                value="Lease"
                className="flex-grow-1 justify-content-center"
              >
                Lease
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>

          {/* Side */}
          <Field>
            <Field.Label>Side</Field.Label>
            <div className="row g-3">
              {SIDE_ORDER.map((sideValue) => {
                const s = SIDE_DISPLAY[sideValue];
                const { title, blurb } = s[dealType];
                const active = side === sideValue;
                return (
                  <div key={sideValue} className="col-6">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSide(sideValue)}
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
                        {title}
                      </span>
                      <span className="text-muted fs-small">{blurb}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </Field>

          {/* Stage — most deals start in Pitching, but a broker can start one
              already in-flight in a later stage. */}
          <Field>
            <Field.Label>Stage</Field.Label>
            <Select
              value={stage}
              onValueChange={(v) => v && setStage(v as PropertyStatus)}
            >
              <Select.Trigger>
                <Select.Value>
                  {(v) => STAGE_LABEL[v as PropertyStatus]}
                </Select.Value>
              </Select.Trigger>
              <Select.Content>
                {PROPERTY_STATUSES.map((s) => (
                  <Select.Item key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Field.Description>
              Most deals start in Pitching. Pick a later stage if this deal is
              already in-flight.
            </Field.Description>
          </Field>

          {/* Contact + Property share one line. When the deal is initiated
              from a contact, Contact is hidden and Property takes full width. */}
          <div className="row g-3">
            {!contact && (
              <div className="col-12 col-md-6">
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
                      <Combobox.Input
                        placeholder="Search contacts…"
                        showClear
                      />
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
                                      <RelationshipPill
                                        value={item.relationship}
                                      />
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
              </div>
            )}

            {/* Property */}
            <div className={contact ? "col-12" : "col-12 col-md-6"}>
              {property ? (
                <Field>
                  <Field.Label>Property</Field.Label>
                  <div className="d-flex align-items-center gap-2 border rounded px-3 py-2">
                    <FontAwesomeIcon
                      icon={TYPE_ICONS[property.propertyType]}
                      className="text-muted"
                    />
                    <span className="flex-grow-1 text-truncate">
                      {[property.street, property.city, property.state]
                        .filter(Boolean)
                        .join(", ") || property.name}
                    </span>
                    <Badge
                      variant="secondary"
                      appearance="muted"
                      className="flex-shrink-0"
                    >
                      {TYPE_LABELS[property.propertyType]}
                    </Badge>
                  </div>
                </Field>
              ) : (
                <Field>
                  <Field.Label>Property</Field.Label>
                  <Combobox
                    items={propertyOptions}
                    value={propertyOption}
                    onValueChange={(v) =>
                      selectProperty(v as PropertyOption | null)
                    }
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
                        No match — we’ll create a new property from what you
                        typed.
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
                                  <span className="text-truncate">
                                    {item.label}
                                  </span>
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
              )}
            </div>
          </div>

          {/* Deal scope — only when the chosen property already has units on
              record. Whole-building by default; unchecking reveals a single-select
              list of the property's units. */}
          {hasUnits && (
            <Field>
              <Field.Label>Deal scope</Field.Label>
              <label
                className="d-flex align-items-center gap-2 mb-0"
                style={{ cursor: "pointer" }}
              >
                <Checkbox
                  checked={wholeBuilding}
                  onCheckedChange={(c) => {
                    const on = c === true;
                    setWholeBuilding(on);
                    if (on) setSelectedUnitId(null);
                  }}
                />
                <span>Represent the whole building</span>
              </label>

              {!wholeBuilding && (
                <>
                  <Field.Description className="mt-2 mb-1">
                    Select the unit this deal is for.
                  </Field.Description>
                  <RadioGroup
                    value={selectedUnitId ?? ""}
                    onValueChange={(v) => setSelectedUnitId(v as string)}
                  >
                    <div
                      className="d-flex flex-column border rounded p-1 overflow-auto"
                      style={{ maxHeight: 168 }}
                    >
                      {units.map((u) => (
                        <label
                          key={u.id}
                          className="d-flex align-items-center gap-2 mb-0 px-2 py-2 rounded"
                          style={{ cursor: "pointer" }}
                        >
                          <RadioGroup.Item value={u.id} />
                          <span
                            className="d-flex flex-column flex-grow-1"
                            style={{ minWidth: 0 }}
                          >
                            <span className="fw-semibold text-truncate">
                              {u.label}
                            </span>
                            <span className="text-muted fs-small text-truncate text-capitalize">
                              {u.unitType}
                              {u.sqft > 0
                                ? ` · ${u.sqft.toLocaleString()} SF`
                                : ""}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                </>
              )}
            </Field>
          )}

          {/* Add your own files */}
          <Field>
            <Field.Label className="d-flex align-items-center gap-2">
              Add your own files
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

          {/* Suggested for this deal — pitching-phase setup only. A deal started
              already in-flight skips the generated collateral + underwriting. */}
          {stage === "proposal" && (
            <div className="d-flex flex-column gap-3">
              <div>
                <div className="fw-semibold">Suggested for this deal</div>
                <div className="text-muted fs-small">
                  From your firm’s defaults · based on similar deals
                </div>
              </div>

              <Field orientation="horizontal">
                <Switch
                  checked={underwritingOn}
                  onCheckedChange={(c) => toggleUnderwriting(c === true)}
                />
                <Field.Label className="mb-0">
                  Start underwriting in Pitching
                </Field.Label>
              </Field>

              {underwritingOn && (
                <UnderwritingDepth
                  value={underwritingSel}
                  onChange={handleUnderwritingChange}
                />
              )}

              <Field>
                <div className="d-flex align-items-center gap-2">
                  <Switch
                    checked={generateDocsOn}
                    onCheckedChange={(c) => setGenerateDocsOn(c === true)}
                  />
                  <Field.Label className="mb-0">
                    Documents to generate
                  </Field.Label>
                </div>
                <Field.Description>
                  Turn on to have Buildout draft collateral when the deal is
                  created. Deeper underwriting suggests more.
                </Field.Description>
                {generateDocsOn && (
                  <div
                    className="d-flex flex-column gap-2 border rounded p-2 overflow-auto"
                    style={{ maxHeight: 168 }}
                  >
                    {SUGGESTED_DOCUMENTS.map((d) => (
                      <label
                        key={d.key}
                        className="d-flex align-items-center gap-2 mb-0"
                        style={{ cursor: "pointer" }}
                      >
                        <Checkbox
                          checked={checkedDocKeys.has(d.key)}
                          onCheckedChange={(c) => toggleDoc(d.key, c === true)}
                        />
                        <span className="flex-grow-1 text-truncate fs-small">
                          {d.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </Field>
            </div>
          )}
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
