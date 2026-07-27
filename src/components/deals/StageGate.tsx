import { useMemo, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Calendar } from "@buildoutinc/blueprint-react/ui/Calendar";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRightFromSquare,
  faRobot,
  faCalendar,
  faSparkle,
  faUser,
} from "@fortawesome/pro-regular-svg-icons";
import { faNote } from "@fortawesome/pro-duotone-svg-icons";
import type { PropertyStatus } from "#/data/types";
import {
  getListing,
  getSellerOptionGroups,
  getContact,
  getProperty,
  contactLabel,
  type ContactOption,
  type ContactOptionGroup,
} from "#/data/store";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { RelationshipPill } from "#/components/contacts/pills";
import {
  resolveGate,
  canConfirm,
  buildTransitionInput,
  seedGateForm,
  signedListingAgreementDoc,
  unsatisfiedRequired,
  completeSetupGate,
  EMPTY_GATE_FORM,
  type GateFormState,
} from "#/data/stageGates";
import { commitStageTransition } from "#/data/actions";
import { STATUS_LABELS } from "#/components/properties/propertyDisplay";
import { CurrencyInput } from "#/components/common/CurrencyInput";
import {
  commissionAmountFromPct,
  commissionPctFromAmount,
} from "#/data/commission";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const LEASE_RATE_UNIT_OPTIONS = [
  { value: "SF/Yr", label: "SF/Yr" },
  { value: "SF/Mo", label: "SF/Mo" },
  { value: "Monthly", label: "Monthly" },
] as const;

/** Format a stored date value (ISO string or `yyyy-mm-dd`) as a local Date. */
function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  // Plain `yyyy-mm-dd` parses as UTC midnight; pin to local to avoid an
  // off-by-one day. Full ISO strings already carry a time/zone.
  return new Date(value.length <= 10 ? `${value}T00:00:00` : value);
}

/** Serialize a picked Date to a local `yyyy-mm-dd` (no timezone drift). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Blueprint date input: a read-only field with a calendar-icon addon that opens
 * a single-date Calendar popover. Wired to a stored ISO-string value.
 * (Documented InputGroup + Popover + Calendar pattern.)
 */
function GateDatePicker({
  value,
  onChange,
  placeholder,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);
  return (
    <InputGroup>
      <InputGroup.Addon>
        <Popover open={open} onOpenChange={setOpen}>
          <Popover.Trigger
            nativeButton={false}
            aria-label="Open date picker"
            render={<FontAwesomeIcon icon={faCalendar} />}
          />
          <Popover.Content className="p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              onSelect={(d) => {
                onChange(d ? toISODate(d) : null);
                setOpen(false);
              }}
            />
          </Popover.Content>
        </Popover>
      </InputGroup.Addon>
      <Input
        type="text"
        readOnly
        placeholder={placeholder}
        value={
          selected ? selected.toLocaleDateString(undefined, DATE_FORMAT) : ""
        }
      />
    </InputGroup>
  );
}

/**
 * Searchable buyer/tenant picker for the Under Contract gate. Sections the
 * options into "Leads on this deal" then "CRM contacts" (see
 * {@link getSellerOptionGroups}) so the broker can confirm the lead that came
 * in or search the whole book.
 */
function ContactGateCombobox({
  groups,
  value,
  onValueChange,
  placeholder,
}: {
  groups: ContactOptionGroup[];
  value: ContactOption | null;
  onValueChange: (option: ContactOption | null) => void;
  placeholder: string;
}) {
  return (
    <Combobox
      items={groups}
      value={value}
      onValueChange={(v) => onValueChange(v as ContactOption | null)}
    >
      <Combobox.InputGroup>
        <InputGroup.Addon>
          <FontAwesomeIcon icon={faUser} />
        </InputGroup.Addon>
        <Combobox.Input placeholder={placeholder} showClear />
      </Combobox.InputGroup>
      <Combobox.Content>
        <Combobox.Empty className="text-muted">
          No matching contacts
        </Combobox.Empty>
        <Combobox.List>
          {(group: ContactOptionGroup) => (
            <Combobox.Group key={group.value} items={group.items}>
              <Combobox.GroupLabel>{group.label}</Combobox.GroupLabel>
              <Combobox.Collection>
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
                            <span className="text-truncate">{item.name}</span>
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
              </Combobox.Collection>
            </Combobox.Group>
          )}
        </Combobox.List>
      </Combobox.Content>
    </Combobox>
  );
}

export function StageGate({
  dealId,
  targetStage,
  open,
  onOpenChange,
  onCommitted,
  completeSetup = false,
}: {
  dealId: string;
  targetStage: PropertyStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommitted?: () => void;
  /**
   * "Complete setup" mode for a deal created directly in a live stage: show the
   * Approve & Publish gate and publish in place, without changing the stage.
   */
  completeSetup?: boolean;
}) {
  const deal = getListing(dealId);
  const config = useMemo(() => {
    if (!deal) return null;
    if (completeSetup) return completeSetupGate(deal);
    return resolveGate(deal.status, targetStage, deal.dealType);
  }, [deal, targetStage, completeSetup]);

  // Seed the working form from the deal each time the gate opens.
  const initialForm = useMemo<GateFormState>(
    () => (deal ? seedGateForm(deal) : EMPTY_GATE_FORM),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dealId, open, completeSetup],
  );

  // Surface only the required fields the deal hasn't already satisfied. Derived
  // from the initial seeded form so a field stays visible while the user fills it.
  //
  // Exception: the agreed price on the Under Contract gate. A deal is created
  // with `transaction.salePrice` seeded from the listing price, so it always
  // reads as satisfied and would never render — silently treating the asking
  // price as what the buyer agreed to. Force it visible so the broker confirms
  // or replaces it with the real number.
  const visibleFields = useMemo(() => {
    const fields = new Set(config ? unsatisfiedRequired(config, initialForm) : []);
    if (config?.targetStage === "under-contract" && config.required.includes("salePrice")) {
      fields.add("salePrice");
    }
    return fields;
  }, [config, initialForm]);

  const [form, setForm] = useState<GateFormState>(initialForm);
  const [reviewedDocIds, setReviewedDocIds] = useState<Set<string>>(new Set());
  // Re-seed when the modal (re)opens for a different deal/target — the accepted
  // React "reset state during render when a key changes" pattern. All hooks are
  // declared above this point, so this stays before the early return.
  const [seededKey, setSeededKey] = useState("");
  const key = `${dealId}:${targetStage}:${completeSetup}:${open}`;
  if (open && key !== seededKey) {
    setForm(initialForm);
    setReviewedDocIds(new Set());
    setSeededKey(key);
  }

  if (!deal || !config) return null;

  // When a signed listing agreement is on file and the deal had no stored
  // listing dates, the seeded Executed/Expires values were AI-extracted from
  // that document — label them so the broker knows to review, not re-enter.
  const agreementDoc = signedListingAgreementDoc(deal);
  const aiDatesFromAgreement =
    !!agreementDoc &&
    !deal.transaction.listedOnDate &&
    !deal.transaction.listingExpirationDate;

  const set = <K extends keyof GateFormState>(k: K, v: GateFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setSalePrice = (v: number | null) =>
    setForm((f) => ({
      ...f,
      salePrice: v,
      commissionAmount:
        v != null && f.commissionPct != null
          ? commissionAmountFromPct(v, f.commissionPct)
          : f.commissionAmount,
    }));
  const setCommissionPct = (v: number | null) =>
    setForm((f) => ({
      ...f,
      commissionPct: v,
      commissionAmount:
        v != null && f.salePrice != null
          ? commissionAmountFromPct(f.salePrice, v)
          : f.commissionAmount,
    }));
  const setCommissionAmount = (v: number | null) =>
    setForm((f) => ({
      ...f,
      commissionAmount: v,
      commissionPct:
        v != null && f.salePrice != null && f.salePrice > 0
          ? commissionPctFromAmount(f.salePrice, v)
          : f.commissionPct,
    }));

  const show = (f: string) => visibleFields.has(f as never);

  const aiDocs = (deal.documents ?? []).filter((d) => d.aiGenerated);
  const allDocsReviewed =
    aiDocs.length === 0 || aiDocs.every((d) => reviewedDocIds.has(d.id));

  // Derive the effective form (checklist state folded in) at check/commit time
  // instead of syncing state during render.
  const effectiveForm: GateFormState = {
    ...form,
    aiDocsAllReviewed: allDocsReviewed,
  };

  // Publish-gate read-only summary — Seller/Side/Property are already on the
  // deal from creation, so the gate shows them rather than re-collecting them.
  const seller = deal.sellerContactIds[0]
    ? getContact(deal.sellerContactIds[0])
    : undefined;
  const sellerName = seller ? contactLabel(seller) : null;
  const summaryProperty = getProperty(deal.propertyId);
  const propertyAddress = summaryProperty
    ? [summaryProperty.street, summaryProperty.city, summaryProperty.state]
        .filter(Boolean)
        .join(", ")
    : deal.name;

  // Buyer/tenant options for the Under Contract gate, grouped so the deal's own
  // leads come first, then the rest of the CRM. Rendered in a searchable
  // Combobox. `findOption` resolves the form's stored id back to its option
  // object (the value the Combobox tracks).
  const buyerGroups = getSellerOptionGroups(deal.propertyId);
  const findOption = (id: string | null | undefined): ContactOption | null =>
    id
      ? (buyerGroups.flatMap((g) => g.items).find((o) => o.value === id) ?? null)
      : null;

  const confirmable = canConfirm(config, effectiveForm);

  const commit = () => {
    const input = buildTransitionInput(
      config,
      effectiveForm,
      deal.id,
      deal.internalBrokers[0]?.name ?? "You",
      deal.dealType,
    );
    // commitStageTransition emits the move/publish toast centrally.
    commitStageTransition(input);
    onOpenChange(false);
    onCommitted?.();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content
        size={config.leavesActive ? undefined : "lg"}
        scrollable
        centered
      >
        <Modal.Header>
          <Modal.Title>{config.title}</Modal.Title>
          <Modal.Description>{deal.name}</Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3">
          {config.kind === "confirm" && (
            <>
              <p className="mb-0">
                Move this deal back to{" "}
                <strong>{STATUS_LABELS[config.targetStage]}</strong>?
              </p>
              {config.leavesActive && (
                <Field orientation="horizontal">
                  <Checkbox
                    checked={form.unpublishOnExit}
                    onCheckedChange={(c) => set("unpublishOnExit", c === true)}
                  />
                  <Field.Label>
                    Also unpublish this listing (pull it off-market)
                  </Field.Label>
                </Field>
              )}
            </>
          )}

          {(config.kind === "field" || config.kind === "dead") && (
            <>
              {config.publishes && (
                <div className="border rounded p-3 bg-body-tertiary">
                  <div className="fw-semibold mb-2">
                    You're publishing this listing
                  </div>
                  <dl className="row g-0 mb-0">
                    <dt className="col-4 fw-normal text-muted">Seller</dt>
                    <dd className="col-8 mb-1">{sellerName ?? "—"}</dd>
                    <dt className="col-4 fw-normal text-muted">Side</dt>
                    <dd className="col-8 mb-1">
                      {deal.dealSide === "seller" ? "Sell-side" : "Buy-side"}
                    </dd>
                    <dt className="col-4 fw-normal text-muted">Property</dt>
                    <dd className="col-8 mb-0">{propertyAddress}</dd>
                  </dl>
                </div>
              )}

              {config.publishes && (
                <>
                  {show("saleTitle") && (
                    <Field>
                      <Field.Label>Listing title</Field.Label>
                      <Input
                        value={form.saleTitle}
                        onChange={(e) => set("saleTitle", e.target.value)}
                        placeholder="e.g. Prime Retail Pad — Downtown"
                      />
                    </Field>
                  )}

                  {show("saleDescription") && (
                    <Field>
                      <Field.Label>Listing description</Field.Label>
                      <Textarea
                        rows={3}
                        value={form.saleDescription}
                        onChange={(e) =>
                          set("saleDescription", e.target.value)
                        }
                        placeholder="Describe the offering for the public listing…"
                      />
                    </Field>
                  )}

                  {show("askingPrice") && deal.dealType === "Sale" && (
                    <Field>
                      <Field.Label>Asking price</Field.Label>
                      <CurrencyInput
                        value={form.askingPrice}
                        onChange={(v) => set("askingPrice", v)}
                      />
                      <Field.Description>
                        Editing here updates the listing.{" "}
                        <a
                          href={`/listings/${deal.id}/edit`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open full marketing editor{" "}
                          <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                        </a>
                      </Field.Description>
                    </Field>
                  )}

                  {(show("leaseRate") || show("availableSqFt")) &&
                    deal.dealType !== "Sale" && (
                      <>
                        <div className="d-flex gap-2">
                          <Field className="flex-grow-1">
                            <Field.Label>Lease rate</Field.Label>
                            <CurrencyInput
                              value={form.leaseRate}
                              onChange={(v) => set("leaseRate", v)}
                            />
                          </Field>
                          <Field style={{ width: 140 }}>
                            <Field.Label>Units</Field.Label>
                            <Select
                              items={LEASE_RATE_UNIT_OPTIONS}
                              value={form.leaseRateUnits}
                              onValueChange={(v) =>
                                set(
                                  "leaseRateUnits",
                                  v as typeof form.leaseRateUnits,
                                )
                              }
                            >
                              <Select.Trigger>
                                <Select.Value />
                              </Select.Trigger>
                              <Select.Content>
                                {LEASE_RATE_UNIT_OPTIONS.map((o) => (
                                  <Select.Item key={o.value} value={o.value}>
                                    {o.label}
                                  </Select.Item>
                                ))}
                              </Select.Content>
                            </Select>
                          </Field>
                        </div>
                        <Field>
                          <Field.Label>Available SF</Field.Label>
                          <Input
                            type="number"
                            value={form.availableSqFt ?? ""}
                            onChange={(e) =>
                              set(
                                "availableSqFt",
                                e.target.value ? Number(e.target.value) : null,
                              )
                            }
                            placeholder="e.g. 2400"
                          />
                        </Field>
                      </>
                    )}
                </>
              )}

              {show("aiDocsReviewed") && aiDocs.length > 0 && (
                <Field>
                  <Field.Label>
                    <FontAwesomeIcon icon={faRobot} /> Review AI-generated
                    documents
                  </Field.Label>
                  <div className="d-flex flex-column gap-2 border rounded p-2">
                    {aiDocs.map((d) => (
                      <div
                        key={d.id}
                        className="d-flex align-items-center justify-content-between gap-2"
                      >
                        <label className="d-flex align-items-center gap-2 mb-0">
                          <Checkbox
                            checked={reviewedDocIds.has(d.id)}
                            onCheckedChange={(c) =>
                              setReviewedDocIds((prev) => {
                                const next = new Set(prev);
                                if (c === true) next.add(d.id);
                                else next.delete(d.id);
                                return next;
                              })
                            }
                          />
                          {d.name}
                        </label>
                        <a
                          href={`/listings/${deal.id}/documents`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-nowrap"
                        >
                          Open{" "}
                          <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                        </a>
                      </div>
                    ))}
                  </div>
                </Field>
              )}

              {show("buyerLinked") && (
                <Field>
                  <Field.Label>Buyer</Field.Label>
                  <ContactGateCombobox
                    groups={buyerGroups}
                    value={findOption(form.buyerContactId)}
                    placeholder="Search a buyer…"
                    onValueChange={(o) => {
                      set("buyerContactId", o?.value ?? null);
                      set(
                        "buyerLinked",
                        !!o || deal.buyerContactIds.length > 0,
                      );
                    }}
                  />
                </Field>
              )}

              {show("tenantLinked") && (
                <Field>
                  <Field.Label>Tenant</Field.Label>
                  <ContactGateCombobox
                    groups={buyerGroups}
                    value={findOption(form.tenantContactId)}
                    placeholder="Search a tenant…"
                    onValueChange={(o) => {
                      set("tenantContactId", o?.value ?? null);
                      set(
                        "tenantLinked",
                        !!o || deal.tenantContactIds.length > 0,
                      );
                    }}
                  />
                </Field>
              )}

              {show("listedOnDate") && (
                <Field>
                  <Field.Label>Listing Executed</Field.Label>
                  <GateDatePicker
                    value={form.listedOnDate}
                    onChange={(v) => set("listedOnDate", v)}
                    placeholder="Pick a date"
                  />
                </Field>
              )}

              {show("listingExpirationDate") && (
                <Field>
                  <Field.Label>Listing Expires</Field.Label>
                  <GateDatePicker
                    value={form.listingExpirationDate}
                    onChange={(v) => set("listingExpirationDate", v)}
                    placeholder="Pick a date"
                  />
                </Field>
              )}

              {aiDatesFromAgreement &&
                (show("listedOnDate") || show("listingExpirationDate")) && (
                  <div className="ai-draft">
                    <FontAwesomeIcon
                      icon={faSparkle}
                      className="ai-draft__icon"
                    />
                    AI pulled the executed and expiration dates from{" "}
                    {agreementDoc.name} — review before publishing.
                  </div>
                )}

              {show("salePrice") && (
                <Field>
                  <Field.Label>Agreed Price</Field.Label>
                  <CurrencyInput value={form.salePrice} onChange={setSalePrice} />
                  <div className="form-text">
                    Prefilled with the listing price — change it to the price the
                    buyer agreed to. Commission recalculates from this figure.
                  </div>
                </Field>
              )}

              {show("commissionAmount") && (
                <Field>
                  <Field.Label>Gross Commission %</Field.Label>
                  <Input
                    type="number"
                    value={form.commissionPct ?? ""}
                    onChange={(e) =>
                      setCommissionPct(
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  />
                </Field>
              )}

              {show("commissionAmount") && (
                <Field>
                  <Field.Label>Gross Commission ($)</Field.Label>
                  <CurrencyInput
                    value={form.commissionAmount}
                    onChange={setCommissionAmount}
                  />
                </Field>
              )}

              {show("leaseTermMonths") && (
                <Field>
                  <Field.Label>Lease term (months)</Field.Label>
                  <Input
                    type="number"
                    value={form.leaseTermMonths ?? ""}
                    onChange={(e) =>
                      set(
                        "leaseTermMonths",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    placeholder="e.g. 60"
                  />
                </Field>
              )}

              {show("leaseCommencementDate") && (
                <Field>
                  <Field.Label>Lease Commencement</Field.Label>
                  <GateDatePicker
                    value={form.leaseCommencementDate}
                    onChange={(v) => set("leaseCommencementDate", v)}
                    placeholder="Tenancy start date"
                  />
                </Field>
              )}

              {show("closeDate") && (
                <Field>
                  <Field.Label>Close Date</Field.Label>
                  <GateDatePicker
                    value={form.closeDate}
                    onChange={(v) => set("closeDate", v)}
                    placeholder="Pick a date"
                  />
                </Field>
              )}

              {show("deadReason") && (
                <Field>
                  <Field.Label>Lost Reason</Field.Label>
                  <Input
                    value={form.deadReason ?? ""}
                    onChange={(e) => set("deadReason", e.target.value || null)}
                    placeholder="Why is this deal lost?"
                  />
                </Field>
              )}

              {config.targetStage === "closed" && (
                <Alert severity="info" withIcon>
                  {/* `withIcon` only reserves the gutter (see the theme's
                      .alert-icon rule) — the icon has to be a direct child. */}
                  <FontAwesomeIcon icon={faNote} />
                  <Alert.Title>
                    Economics carried from Under Contract
                  </Alert.Title>
                  The voucher and receivables are created in Back Office after
                  close.
                </Alert>
              )}
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close render={<Button variant="ghost">Cancel</Button>} />
          <Button variant="primary" disabled={!confirmable} onClick={commit}>
            {config.publishes ? "Approve & Publish" : "Confirm"}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
