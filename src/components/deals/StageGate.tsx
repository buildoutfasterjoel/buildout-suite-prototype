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
} from "@fortawesome/pro-regular-svg-icons";
import type { PropertyStatus } from "#/data/types";
import {
  getListing,
  getSellerOptions,
  getContact,
  getProperty,
  contactLabel,
} from "#/data/store";
import {
  resolveGate,
  canConfirm,
  buildTransitionInput,
  seedGateForm,
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
    if (completeSetup) {
      // Reuse the publish gate's fields, but keep the current stage — this only
      // captures the required info and sets publishedAt.
      const publishGate = resolveGate("proposal", "active", deal.dealType);
      return {
        ...publishGate,
        fromStage: deal.status,
        targetStage: deal.status,
        leavesActive: false,
      };
    }
    return resolveGate(deal.status, targetStage, deal.dealType);
  }, [deal, targetStage, completeSetup]);

  // Seed the working form from the deal each time the gate opens.
  const initialForm = useMemo<GateFormState>(
    () => (deal ? seedGateForm(deal) : EMPTY_GATE_FORM),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dealId, open, completeSetup],
  );

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

  const req = (f: string) => config.required.includes(f as never);

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

  // Buyer options for the Under Contract gate. Also passed to the Select via
  // `items` so the trigger renders the contact's name (label) rather than the
  // raw id (value).
  const buyerOptions = getSellerOptions(deal.propertyId);

  const confirmable = canConfirm(config, effectiveForm);

  const commit = () => {
    const input = buildTransitionInput(
      config,
      effectiveForm,
      deal.id,
      deal.internalBrokers[0]?.name ?? "You",
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
                  <Field>
                    <Field.Label>Listing title</Field.Label>
                    <Input
                      value={form.saleTitle}
                      onChange={(e) => set("saleTitle", e.target.value)}
                      placeholder="e.g. Prime Retail Pad — Downtown"
                    />
                  </Field>

                  <Field>
                    <Field.Label>Listing description</Field.Label>
                    <Textarea
                      rows={3}
                      value={form.saleDescription}
                      onChange={(e) => set("saleDescription", e.target.value)}
                      placeholder="Describe the offering for the public listing…"
                    />
                  </Field>

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
                </>
              )}

              {config.publishes && aiDocs.length > 0 && (
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

              {config.publishes && (
                <Field>
                  <div className="d-flex align-items-center justify-content-between gap-2">
                    <label className="d-flex align-items-center gap-2 mb-0">
                      <Checkbox
                        checked={form.websiteReviewed}
                        onCheckedChange={(c) =>
                          set("websiteReviewed", c === true)
                        }
                      />
                      Listing website reviewed
                    </label>
                    <a
                      href={`/listings/${deal.id}/website`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-nowrap"
                    >
                      Open website{" "}
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                    </a>
                  </div>
                </Field>
              )}

              {req("buyerLinked") && (
                <Field>
                  <Field.Label>Buyer</Field.Label>
                  <Select
                    items={buyerOptions}
                    value={form.buyerContactId ?? ""}
                    onValueChange={(v) => {
                      set("buyerContactId", v || null);
                      set(
                        "buyerLinked",
                        !!v || deal.buyerContactIds.length > 0,
                      );
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select a buyer…" />
                    </Select.Trigger>
                    <Select.Content>
                      {buyerOptions.map((o) => (
                        <Select.Item key={o.value} value={o.value}>
                          {o.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </Field>
              )}

              {req("listedOnDate") && (
                <Field>
                  <Field.Label>Listing Executed</Field.Label>
                  <GateDatePicker
                    value={form.listedOnDate}
                    onChange={(v) => set("listedOnDate", v)}
                    placeholder="Pick a date"
                  />
                </Field>
              )}

              {req("listingExpirationDate") && (
                <Field>
                  <Field.Label>Listing Expires</Field.Label>
                  <GateDatePicker
                    value={form.listingExpirationDate}
                    onChange={(v) => set("listingExpirationDate", v)}
                    placeholder="Pick a date"
                  />
                </Field>
              )}

              {req("salePrice") && (
                <Field>
                  <Field.Label>Sale Price</Field.Label>
                  <CurrencyInput value={form.salePrice} onChange={setSalePrice} />
                </Field>
              )}

              {req("commissionAmount") && (
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

              {req("commissionAmount") && (
                <Field>
                  <Field.Label>Gross Commission ($)</Field.Label>
                  <CurrencyInput
                    value={form.commissionAmount}
                    onChange={setCommissionAmount}
                  />
                </Field>
              )}

              {req("closeDate") && (
                <Field>
                  <Field.Label>Close Date</Field.Label>
                  <GateDatePicker
                    value={form.closeDate}
                    onChange={(v) => set("closeDate", v)}
                    placeholder="Pick a date"
                  />
                </Field>
              )}

              {req("deadReason") && (
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
