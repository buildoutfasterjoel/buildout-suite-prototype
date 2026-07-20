import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
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
  faArrowRight,
  faArrowLeft,
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
    Sale: {
      title: "Seller",
      blurb: "Sell-side · take their property to market",
    },
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
    Lease: {
      title: "Tenant",
      blurb: "Tenant rep · find space for them to lease",
    },
  },
};

const MAX_FILES = 5;
const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

function contactName(c: Contact): string {
  return `${c.firstName} ${c.lastName}`.trim();
}

/** Join a short list into prose: ["a","b","c"] → "a, b, and c". */
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** The wizard's steps, in order. */
const WIZARD_STEPS = [
  { n: 1 as const, label: "Deal" },
  { n: 2 as const, label: "Documents" },
];

/**
 * Two-step progress indicator for the create-deal wizard. Blueprint ships no
 * stepper, so this is hand-built — but strictly from design tokens: the
 * active/done accent uses the `text-bg-primary` utility (theme primary + its
 * contrast text) and `text-primary`; inactive steps use `border`/`text-muted`.
 */
function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div
      className="d-flex align-items-center gap-2"
      role="group"
      aria-label={`Step ${step} of ${WIZARD_STEPS.length}`}
    >
      {WIZARD_STEPS.map((s, i) => {
        const active = step === s.n;
        const done = step > s.n;
        const lit = active || done;
        return (
          <Fragment key={s.n}>
            <span className="d-inline-flex align-items-center gap-2">
              <span
                className={`d-inline-flex align-items-center justify-content-center rounded-circle fw-semibold fs-small ${
                  lit ? "text-bg-primary" : "border text-muted"
                }`}
                style={{ width: "1.5rem", height: "1.5rem" }}
                aria-hidden
              >
                {done ? <FontAwesomeIcon icon={faCheck} /> : s.n}
              </span>
              <span
                className={`fs-small fw-semibold ${
                  lit ? "text-primary" : "text-muted"
                }`}
              >
                {s.label}
              </span>
            </span>
            {i < WIZARD_STEPS.length - 1 && (
              <span
                className="flex-grow-1 border-top"
                style={{ minWidth: "1rem" }}
                aria-hidden
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** The documents pre-checked by default in the Suggested Documents list. */
function defaultDocKeys(): Set<string> {
  return new Set(
    SUGGESTED_DOCUMENTS.filter((d) => d.defaultOn).map((d) => d.key),
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
  // Which wizard step is showing: 1 = deal essentials, 2 = documents setup.
  const [step, setStep] = useState<1 | 2>(1);
  // Underwriting is optional at creation; when off, the depth control collapses
  // and the deal starts with no underwriting.
  const [underwritingOn, setUnderwritingOn] = useState(false);
  // The underwriting depth selection. The slider drives only the underwriting
  // checks — it no longer affects which documents are checked below.
  const [underwritingSel, setUnderwritingSel] = useState<Set<number>>(
    () => new Set(DEFAULT_UNDERWRITING_SELECTION),
  );
  // Which suggested documents are checked — independent of the underwriting
  // depth; starts at the default set and is toggled by hand.
  const [checkedDocKeys, setCheckedDocKeys] =
    useState<Set<string>>(defaultDocKeys);
  // Free-text filter over the (large) catalog — only narrows the Available list.
  const [docSearch, setDocSearch] = useState("");

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
    () =>
      property ??
      (propertyOption ? getProperty(propertyOption.value) : undefined),
    [property, propertyOption],
  );
  const units = selectedProperty?.units ?? [];
  const hasUnits = units.length > 0;

  // Reset the scope whenever the property or deal type changes. A Sale defaults
  // to representing the whole building (you're selling the asset); a Lease starts
  // unscoped so the broker picks the specific unit being leased.
  useEffect(() => {
    setWholeBuilding(dealType === "Sale");
    setSelectedUnitId(null);
  }, [selectedProperty?.id, dealType]);

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

    setStep(1);
    setDealType("Sale");
    setStage("proposal");
    setUnderwritingOn(false);
    setUnderwritingSel(new Set(DEFAULT_UNDERWRITING_SELECTION));
    // Documents start at the default suggested set, independent of underwriting.
    setCheckedDocKeys(defaultDocKeys());
    setDocSearch("");
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
  const hasContact = contactOption !== null;
  // A unit-scoped deal needs a unit picked; whole-building (or a property with no
  // units) is always fine.
  const unitOk = !hasUnits || wholeBuilding || selectedUnitId !== null;
  // A deal needs a side plus at least one of contact/property; a chosen property
  // with units also needs a unit (or whole-building).
  const canCreate = side !== null && (hasContact || hasProperty) && unitOk;

  // Spell out what's still required so the disabled buttons aren't a dead end.
  const missingBits: string[] = [];
  if (side === null) missingBits.push("a side");
  if (!hasContact && !hasProperty) missingBits.push("a contact or property");
  if (hasUnits && !unitOk) missingBits.push("a unit");
  const missingHint = missingBits.length
    ? `Add ${joinList(missingBits)} to continue.`
    : "";

  // Split the catalog into what's chosen vs. still available. Search only narrows
  // the available list, so a checked doc never disappears mid-search.
  const docQuery = docSearch.trim().toLowerCase();
  const selectedDocs = SUGGESTED_DOCUMENTS.filter((d) =>
    checkedDocKeys.has(d.key),
  );
  const availableDocs = SUGGESTED_DOCUMENTS.filter(
    (d) =>
      !checkedDocKeys.has(d.key) && d.name.toLowerCase().includes(docQuery),
  );
  const selectedCount = selectedDocs.length + (underwritingOn ? 1 : 0);

  // `withDocuments` is false for the step-1 skip ("Create deal") and true for the
  // step-2 finish. It gates the AI deliverables (suggested docs + underwriting)
  // only — the broker's own uploaded files are collected in step 1 and always
  // attach, whether they skip step 2 or finish it.
  function handleCreate(withDocuments: boolean) {
    if (!canCreate || !side) return;
    const contactId = contactOption?.value ?? "";
    const now = new Date().toISOString();
    const suggestedDocuments: DealDocument[] = withDocuments
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
        withDocuments && underwritingOn
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
      <Modal.Content scrollable centered>
        <Modal.Header>
          <Modal.Title>New deal</Modal.Title>
          <Modal.Description>
            {step === 2
              ? "Choose the documents and underwriting Buildout should draft."
              : contact
                ? `For ${contactName(contact)} · set the side and link a property.`
                : "Set the side, then add a contact or property."}
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          <StepIndicator step={step} />

          {step === 1 && (
            <>
              <Tabs
                value={dealType}
                onValueChange={(v) =>
                  setDealType(v as NewListingDraft["dealType"])
                }
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
                            boxShadow: active
                              ? `0 0 0 1px ${s.color}`
                              : undefined,
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
                  Most deals start in Pitching. Pick a later stage if this deal
                  is already in-flight.
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
                                      {item.sizeLabel
                                        ? ` · ${item.sizeLabel}`
                                        : ""}
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
                            setFiles((prev) =>
                              prev.filter((x) => x.id !== f.id),
                            )
                          }
                        >
                          <FontAwesomeIcon icon={faXmark} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Field>

              {missingHint && (
                <p className="text-muted fs-small mb-0">{missingHint}</p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              {/* Suggested documents — the firm's preset catalog. Defaults are
              pre-selected; search narrows the Available list. Underwriting lives
              here as a deliverable that reveals its depth control once chosen. */}
              <div>
                <div className="fw-semibold fs-large">Suggested documents</div>
                <div className="text-muted fs-small">
                  Buildout drafts these when the deal is created.
                </div>
                <div className="d-flex flex-column gap-3 border rounded p-2 mt-2">
                  {/* Available — search narrows this list. Underwriting is pinned
                      to the top here (until chosen) and ignores the filter. */}
                  <div className="d-flex flex-column gap-2">
                    <div className="fw-semibold fs-small text-muted">
                      Available
                    </div>
                    <InputGroup>
                      <InputGroup.Addon>
                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                      </InputGroup.Addon>
                      <Input
                        type="search"
                        placeholder="Search documents…"
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                      />
                    </InputGroup>
                    <div
                      className="d-flex flex-column gap-2 overflow-auto"
                      style={{ maxHeight: 208 }}
                    >
                      {!underwritingOn && (
                        <label
                          className="d-flex align-items-center gap-2 mb-0"
                          style={{ cursor: "pointer" }}
                        >
                          <Checkbox
                            checked={false}
                            onCheckedChange={() => setUnderwritingOn(true)}
                          />
                          <span className="flex-grow-1 text-truncate fs-small">
                            Underwriting
                          </span>
                        </label>
                      )}
                      {availableDocs.map((d) => (
                        <label
                          key={d.key}
                          className="d-flex align-items-center gap-2 mb-0"
                          style={{ cursor: "pointer" }}
                        >
                          <Checkbox
                            checked={false}
                            onCheckedChange={() => toggleDoc(d.key, true)}
                          />
                          <span className="flex-grow-1 text-truncate fs-small">
                            {d.name}
                          </span>
                          <span className="text-muted fs-small flex-shrink-0">
                            {d.category}
                          </span>
                        </label>
                      ))}
                      {availableDocs.length === 0 && (
                        <span className="text-muted fs-small">
                          {docQuery
                            ? `No documents match “${docSearch.trim()}”.`
                            : "All documents selected."}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Selected — what will be generated. Underwriting shows its
                      depth control inline once chosen. */}
                  {(underwritingOn || selectedDocs.length > 0) && (
                    <div className="d-flex flex-column gap-2">
                      <div className="fw-semibold fs-small text-muted">
                        Selected ({selectedCount})
                      </div>
                      {underwritingOn && (
                        <>
                          <label
                            className="d-flex align-items-center gap-2 mb-0"
                            style={{ cursor: "pointer" }}
                          >
                            <Checkbox
                              checked
                              onCheckedChange={() => setUnderwritingOn(false)}
                            />
                            <span className="flex-grow-1 text-truncate fs-small">
                              Underwriting
                            </span>
                          </label>
                          <UnderwritingDepth
                            value={underwritingSel}
                            onChange={setUnderwritingSel}
                          />
                        </>
                      )}
                      {selectedDocs.map((d) => (
                        <label
                          key={d.key}
                          className="d-flex align-items-center gap-2 mb-0"
                          style={{ cursor: "pointer" }}
                        >
                          <Checkbox
                            checked
                            onCheckedChange={() => toggleDoc(d.key, false)}
                          />
                          <span className="flex-grow-1 text-truncate fs-small">
                            {d.name}
                          </span>
                          <span className="text-muted fs-small flex-shrink-0">
                            {d.category}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          {step === 1 ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                disabled={!canCreate}
                onClick={() => handleCreate(false)}
              >
                Create deal
              </Button>
              <Button
                variant="primary"
                disabled={!canCreate}
                onClick={() => setStep(2)}
              >
                Next
                <FontAwesomeIcon icon={faArrowRight} />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep(1)}>
                <FontAwesomeIcon icon={faArrowLeft} />
                Back
              </Button>
              <Button variant="primary" onClick={() => handleCreate(true)}>
                <FontAwesomeIcon icon={faCheck} />
                Create deal
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
