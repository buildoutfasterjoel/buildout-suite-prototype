import { useMemo, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Calendar } from "@buildoutinc/blueprint-react/ui/Calendar";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { useToast } from "@buildoutinc/blueprint-react/ui/Toast";
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
  type GateFormState,
} from "#/data/stageGates";
import { commitStageTransition } from "#/data/actions";
import { STATUS_LABELS } from "#/components/properties/propertyDisplay";

const EMPTY_FORM: GateFormState = {
  buyerLinked: false,
  listedOnDate: null,
  listingExpirationDate: null,
  contractExecutedDate: null,
  closeDate: null,
  salePrice: null,
  commissionAmount: null,
  deadReason: null,
  aiDocsAllReviewed: true,
  websiteReviewed: false,
  unpublishOnExit: true,
  buyerContactId: null,
};

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
  const selected = parseDate(value);
  return (
    <InputGroup>
      <InputGroup.Addon>
        <Popover>
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
              onSelect={(d) => onChange(d ? toISODate(d) : null)}
            />
          </Popover.Content>
        </Popover>
      </InputGroup.Addon>
      <Input
        type="text"
        readOnly
        placeholder={placeholder}
        value={selected ? selected.toLocaleDateString(undefined, DATE_FORMAT) : ""}
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
}: {
  dealId: string;
  targetStage: PropertyStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommitted?: () => void;
}) {
  const { toast } = useToast();
  const deal = getListing(dealId);
  const config = useMemo(
    () => (deal ? resolveGate(deal.status, targetStage) : null),
    [deal, targetStage],
  );

  // Seed the working form from the deal each time the gate opens.
  const initialForm = useMemo<GateFormState>(() => {
    if (!deal) return EMPTY_FORM;
    return {
      ...EMPTY_FORM,
      buyerLinked: deal.buyerContactIds.length > 0,
      // Preselect a buyer already linked to the deal (Under Contract gate).
      buyerContactId: deal.buyerContactIds[0] ?? null,
      listedOnDate: deal.transaction.listedOnDate,
      listingExpirationDate: deal.transaction.listingExpirationDate,
      contractExecutedDate: deal.transaction.contractExecutedDate,
      closeDate: deal.transaction.closeDate,
      salePrice: deal.transaction.salePrice || null,
      commissionAmount: deal.transaction.commissionAmount || null,
      deadReason: deal.transaction.deadReason,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, open]);

  const [form, setForm] = useState<GateFormState>(initialForm);
  const [reviewedDocIds, setReviewedDocIds] = useState<Set<string>>(new Set());
  // Re-seed when the modal (re)opens for a different deal/target — the accepted
  // React "reset state during render when a key changes" pattern. All hooks are
  // declared above this point, so this stays before the early return.
  const [seededKey, setSeededKey] = useState("");
  const key = `${dealId}:${targetStage}:${open}`;
  if (open && key !== seededKey) {
    setForm(initialForm);
    setReviewedDocIds(new Set());
    setSeededKey(key);
  }

  if (!deal || !config) return null;

  const set = <K extends keyof GateFormState>(k: K, v: GateFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const req = (f: string) => config.required.includes(f as never);

  const aiDocs = (deal.documents ?? []).filter((d) => d.aiGenerated);
  const allDocsReviewed =
    aiDocs.length === 0 || aiDocs.every((d) => reviewedDocIds.has(d.id));

  // Derive the effective form (checklist state folded in) at check/commit time
  // instead of syncing state during render.
  const effectiveForm: GateFormState = { ...form, aiDocsAllReviewed: allDocsReviewed };

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

  const confirmable = canConfirm(config, effectiveForm);

  const commit = () => {
    const input = buildTransitionInput(
      config,
      effectiveForm,
      deal.id,
      deal.internalBrokers[0]?.name ?? "You",
    );
    commitStageTransition(input);
    if (config.publishes) {
      toast.success({
        title: "Listing published",
        description: `${deal.name} is now live in market.`,
      });
    }
    onOpenChange(false);
    onCommitted?.();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="lg" scrollable centered>
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
                  <dl className="row g-0 mb-0 fs-small">
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
                          Open <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
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
                    value={form.buyerContactId ?? ""}
                    onValueChange={(v) => {
                      set("buyerContactId", v || null);
                      set("buyerLinked", !!v || deal.buyerContactIds.length > 0);
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select a buyer…" />
                    </Select.Trigger>
                    <Select.Content>
                      {getSellerOptions(deal.propertyId).map((o) => (
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
                  <Input
                    type="number"
                    value={form.salePrice ?? ""}
                    onChange={(e) =>
                      set("salePrice", e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </Field>
              )}

              {req("commissionAmount") && (
                <Field>
                  <Field.Label>Gross Commission ($)</Field.Label>
                  <Input
                    type="number"
                    value={form.commissionAmount ?? ""}
                    onChange={(e) =>
                      set(
                        "commissionAmount",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
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
                  <Alert.Title>Economics carried from Under Contract</Alert.Title>
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
