import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
  faFile,
  faPaperPlane,
  faPencil,
  faPenToSquare,
  faSparkle,
  faXmark,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, Property, UnderwritingResult } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import {
  addDealActivity,
  generateUnderwritingResult,
  getProperty,
  updateListingUnderwriting,
} from "#/data/store";
import { notify } from "#/lib/notify";
import { UnderwritingProgress } from "#/components/deals/underwriting/UnderwritingProgress";
import { UnderwritingPlacementModal } from "#/components/deals/underwriting/UnderwritingPlacementModal";
import {
  bovPricingFor,
  bovRangeText,
  type BovPricing,
} from "#/components/deals/underwriting/bovPricing";
import { rosaClosing } from "#/components/call/rosaClosing";
import { CURRENT_USER, CURRENT_USER_FIRST_NAME } from "#/data/teammates";
import { UnderwritingSetupModal } from "#/components/deals/underwriting/UnderwritingSetupModal";
import { underwritingFromSelection } from "#/components/deals/underwriting/strategies";
import { useContactSession } from "#/components/contacts/useContactSession";
import { contactFullName, todayISO } from "#/components/contacts/contactDisplay";
import type { ComposedDraft } from "#/components/contacts/ContactComposeModule";
import { useBovFlow } from "#/components/contacts/useBovFlow";
import { BovPreviewPages } from "#/components/contacts/BovPreviewPages";

/** The BOV wizard's three visible stages (generation runs before them). */
const FLOW_STEPS = ["Assemble", "Preview", "Email"] as const;

/** File name the "sent" BOV pdf carries, e.g. `The_Delgado_Building_BOV.pdf`. */
function bovFileName(property: Property): string {
  return `${property.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "")}_BOV.pdf`;
}

/**
 * The shareable link to the deal's BOV document. The owner reads it in place —
 * always the current version — rather than a pdf snapshot going stale in their
 * inbox. Built off the property slug so it's stable per building.
 */
function bovDocUrl(property: Property): string {
  return `https://app.buildout.com/documents/${property.slug}-bov`;
}

/**
 * The AI-drafted cover email for the BOV. Rosa gets her story-specific draft;
 * other contacts get a plausible one built from the deal's numbers. The BOV
 * link sits in the body, where a link in an email actually belongs.
 *
 * The headline range comes from `bovPricingFor` — the underwriting run the
 * broker just approved, occupancy-adjusted. It used to be `askingPrice * 0.97`
 * to `* 1.05`, which meant running the underwrite changed nothing about the
 * email quoting it, under a banner claiming the opposite. And when the T-12
 * contradicts the marketing occupancy the note says so rather than quietly
 * pricing around it — the owner finds out eventually, better from us.
 */
function draftBovEmail(
  contact: Contact,
  property: Property,
  pricing: BovPricing | null,
): string {
  const link = bovDocUrl(property);
  // A range only when there is a run to quote. Nothing reaches this step
  // without one — but a missing number must cost the sentence, never the whole
  // draft. An empty compose box is the worst thing this modal can show.
  const headline = pricing ? `Headline: ${bovRangeText(pricing)}, anchored` : "It's anchored";
  const occupancy = pricing?.occupancyNote
    ? `\n\nOne thing worth flagging: ${pricing.occupancyNote}`
    : "";
  if (contact.heroKey === "rosa") {
    return (
      "Rosa,\n\nThank you for trusting me with Miguel's files. I went through the T12 and " +
      `rent roll and put together the quiet first look we talked about. ${headline} ` +
      `on the in-place rent roll with conservative assumptions ` +
      `and no pressure behind it.${occupancy}\n\nHere's the full BOV:\n` +
      `${link}\n\nA few things I noticed:\n\n` +
      "1. In-place rents run below the corridor's going rate — upside a buyer pays for, not a problem.\n" +
      "2. The T12 carries a one-time roof repair; setting it aside lifts the valuation meaningfully.\n" +
      "3. The ground-floor tenants are steady — an operator buyer would see exactly what Miguel built.\n\n" +
      "No decisions needed. Read it when you're ready, and I'm happy to walk through " +
      `it whenever feels right.\n\n${CURRENT_USER_FIRST_NAME}`
    );
  }
  return (
    `${contact.firstName},\n\nThanks for sharing the financials. I ran a first-pass ` +
    `underwrite. ${headline} on the in-place numbers with ` +
    `conservative assumptions.${occupancy}\n\nHere's the full BOV:\n` +
    `${link}\n\nWorth a quick conversation before you read it — open this week for a ` +
    `30-minute walk-through? I'd rather get your read before we settle on a price.\n\n${CURRENT_USER_FIRST_NAME}`
  );
}

/** The `1 · Assemble › 2 · Preview › 3 · Email` header stepper. */
function FlowStepper({ active }: { active: number }) {
  return (
    <div className="bov-stepper">
      {FLOW_STEPS.map((label, i) => (
        <span key={label} className="d-inline-flex align-items-center gap-2">
          {i > 0 && <span className="bov-stepper__sep">›</span>}
          <span
            className={`bov-stepper__step ${
              i < active ? "is-done" : i === active ? "is-active" : ""
            }`}
          >
            {i + 1} · {label}
          </span>
        </span>
      ))}
    </div>
  );
}

/** Shared modal header: doc icon + title, the stepper, and a close X. */
function FlowHeader({
  title,
  active,
  onClose,
}: {
  title: string;
  active: number;
  onClose: () => void;
}) {
  return (
    <div className="modal-header d-flex align-items-center justify-content-between gap-3">
      <Modal.Title className="d-flex align-items-center gap-2 fs-large">
        <FontAwesomeIcon icon={faFile} className="text-primary" />
        {title}
      </Modal.Title>
      <div className="d-flex align-items-center gap-3">
        <FlowStepper active={active} />
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} />
        </Button>
      </div>
    </div>
  );
}

/**
 * Step 2 — the assembled BOV, previewed in place and scrollable end to end.
 * "Continue to email" advances the wizard and stays the primary path; "Edit
 * document" is the escape hatch into the doc editor. Editing ends the wizard
 * rather than suspending it — navigating away with the flow still open left the
 * modal stacked over the editor.
 *
 * The pages themselves live in `BovPreviewPages`, built off the same property
 * and approved run the cover email quotes.
 */
function BovPreviewModal({
  open,
  property,
  contact,
  pricing,
  result,
  documentName,
  onEdit,
  onContinue,
  onClose,
}: {
  open: boolean;
  property: Property;
  contact: Contact;
  pricing: BovPricing | null;
  result: UnderwritingResult | undefined;
  documentName: string;
  onEdit: () => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Content size="lg" centered scrollable style={{ maxWidth: "56rem" }}>
        <FlowHeader title={documentName} active={1} onClose={onClose} />
        <Modal.Body style={{ maxHeight: 620 }} className="p-5 bov-doc-scroll">
          <BovPreviewPages
            property={property}
            contact={contact}
            pricing={pricing}
            result={result}
          />
        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          <Button variant="ghost" appearance="muted" onClick={onClose}>
            Cancel
          </Button>
          <div className="d-flex gap-2">
            <Button variant="outline" onClick={onEdit}>
              <FontAwesomeIcon icon={faPenToSquare} />
              Edit document
            </Button>
            <Button variant="primary" onClick={onContinue}>
              Continue to email
              <FontAwesomeIcon icon={faArrowRight} />
            </Button>
          </div>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}

/** Matches the URLs the draft embeds, for the read-only body preview. */
const URL_SPLIT = /(https?:\/\/[^\s]+)/g;
const IS_URL = /^https?:\/\//;

/**
 * The body text with its URLs rendered as styled links. Used by the read-only
 * preview only — a plain textarea can't style its contents, so the compose box
 * shows this until the broker clicks in to edit.
 */
function bodyWithLinks(text: string) {
  return text.split(URL_SPLIT).map((part, i) =>
    IS_URL.test(part) ? (
      <a
        key={i}
        href={part}
        // Inert on purpose: the shared-document route isn't wired up, and a
        // real navigation would abandon the wizard mid-send.
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

/**
 * Step 3 — the AI-drafted cover email, with the BOV shared as a link in the
 * body rather than a file attachment. The draft streams into a read-only
 * preview (so the link renders as a link); clicking it hands over to a
 * textarea for editing. Send is the user's final call.
 */
function BovEmailModal({
  open,
  contact,
  property,
  pricing,
  onBack,
  onSend,
  onClose,
}: {
  open: boolean;
  contact: Contact;
  property: Property;
  /** The approved run, priced. Null only if the deal somehow has no run. */
  pricing: BovPricing | null;
  onBack: () => void;
  onSend: (subject: string, body: string) => void;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [drafting, setDrafting] = useState(false);
  // The body shows as a styled read-only preview until the broker edits it.
  const [editing, setEditing] = useState(false);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopDrafting = () => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  };

  // Stream the draft in on open — fast enough to feel live, not slow.
  //
  // Depends on `open` alone. It briefly also waited on `pricing`, back when
  // pricing was async, and that is exactly how this modal came to open with an
  // empty subject and an empty body: the request it was waiting for got
  // cancelled by an unrelated store write and nothing ever set the state. The
  // price is computed synchronously now (see `bovPricingFor`), so there is
  // nothing to wait for — and even a null price still drafts a whole email.
  useEffect(() => {
    if (!open) {
      stopDrafting();
      return;
    }
    setSubject(`${property.name}, preliminary valuation`);
    setBody("");
    setEditing(false);
    setDrafting(true);
    const target = draftBovEmail(contact, property, pricing);
    let i = 0;
    tickerRef.current = setInterval(() => {
      i = Math.min(i + 6, target.length);
      setBody(target.slice(0, i));
      if (i >= target.length) {
        stopDrafting();
        setDrafting(false);
      }
    }, 16);
    return stopDrafting;
    // Redraft only when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleBodyChange = (value: string) => {
    if (drafting) {
      stopDrafting();
      setDrafting(false);
    }
    setBody(value.replace(/▍/g, ""));
  };

  /** Clicking the preview hands over to the textarea — and interrupts the
   * stream if it's still writing, the way typing used to. */
  const startEditing = () => {
    if (drafting) {
      stopDrafting();
      setDrafting(false);
    }
    setEditing(true);
  };

  const canSend = !drafting && subject.trim().length > 0 && body.trim().length > 0;

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Content size="lg" centered scrollable style={{ maxWidth: "50rem" }}>
        <FlowHeader title="Send BOV" active={2} onClose={onClose} />
        <Modal.Body className="p-5 d-flex flex-column gap-3">
          <div className="bov-ai-banner">
            <FontAwesomeIcon icon={faSparkle} />
            AI drafted this from your underwrite and the owner's goals. Edit
            before sending.
          </div>

          <div className="d-flex flex-column gap-1">
            <span className="bov-field-label">To</span>
            <span>
              <span className="bov-to-chip">
                {contactFullName(contact)} &lt;{contact.email}&gt;
              </span>
            </span>
          </div>

          <div className="d-flex flex-column gap-1">
            <span className="bov-field-label">Subject</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          {editing ? (
            <Textarea
              value={body}
              onChange={(e) => handleBodyChange(e.target.value)}
              onBlur={() => setEditing(false)}
              rows={12}
              autoFocus
            />
          ) : (
            <div className="position-relative">
              <div
                className="form-control bov-body-preview"
                role="textbox"
                tabIndex={0}
                aria-label="Email body — click to edit"
                onClick={startEditing}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    startEditing();
                  }
                }}
              >
                {bodyWithLinks(body)}
                {drafting && "▍"}
              </div>
              {!drafting && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="bov-body-preview__edit"
                  onClick={startEditing}
                >
                  <FontAwesomeIcon icon={faPencil} />
                  Edit
                </Button>
              )}
            </div>
          )}

        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          <Button variant="outline" onClick={onBack}>
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to preview
          </Button>
          <Button
            variant="primary"
            disabled={!canSend}
            onClick={() => onSend(subject.trim(), body.trim())}
          >
            <FontAwesomeIcon icon={faPaperPlane} />
            Send to {contact.firstName}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}

/**
 * Orchestrates the underwriting → BOV flow (see useBovFlow): the strategy and
 * depth dialog → the Cactus run → the save-to-document prompt → the assembled
 * BOV preview → the AI-drafted send email → a timeline event linking the sent
 * BOV. Renders nothing while the flow is closed.
 *
 * Hosted ONCE, in the app shell, and driven entirely off the store — so a deal
 * card, the deal planner, and the assistant rail all start the identical flow,
 * and no modal in it is a child of something clickable. See `useBovFlow`.
 */
export function BovFlow() {
  const flow = useBovFlow();
  const navigate = useNavigate();
  const listing = useDataStore((s) =>
    flow.listingId ? s.listings.get(flow.listingId) : undefined,
  );
  const contact = useDataStore((s) =>
    flow.contactId ? s.contacts.get(flow.contactId) : undefined,
  );

  if (!listing || !contact) return null;
  const property = getProperty(listing.propertyId);
  if (!property) return null;

  /**
   * What the run says the building is worth. Derived during render rather than
   * held in state behind an effect — `bovPricingFor` is pure, so there is
   * nothing to load, nothing to cancel, and no window where the email step has
   * a modal open and no numbers to draft from.
   */
  const runResult = listing.underwriting?.result;
  const pricing: BovPricing | null = runResult
    ? bovPricingFor(property, runResult)
    : null;

  /** The sent BOV email lands on the owner's timeline, wherever we are. */
  const onLog = (draft: ComposedDraft) =>
    useContactSession.getState().addLog(contact.id, draft);

  // Open the assembled BOV in the doc editor, scrolled to the underwriting the
  // placement step just inserted. Closes the wizard first so the modal isn't
  // left stacked over the editor.
  const handleEdit = () => {
    flow.close();
    navigate({
      to: "/editor/$listingId",
      params: { listingId: listing.id },
      search: { focus: "underwriting" },
    });
  };

  const handleSend = (subject: string, body: string) => {
    // On the deal as well as on the contact. The timeline row is the broker's
    // record of the conversation; this is the deal's record of the milestone,
    // and it carries the number that went out.
    addDealActivity(listing.id, {
      type: "bov",
      note: pricing
        ? `Sent BOV to ${contact.firstName} — ${bovRangeText(pricing)}`
        : `Sent BOV to ${contact.firstName}`,
      actor: CURRENT_USER.name,
    });
    onLog({
      kind: "email",
      body,
      subject,
      to: contact.email,
      date: todayISO(),
      relatedDeal: listing.name,
      attachments: [
        { name: bovFileName(property), meta: "PDF · 2.4 MB", dealId: listing.id },
      ],
    });
    notify({
      title: `BOV sent to ${contactFullName(contact)}`,
      description: bovFileName(property),
    });
    // The story continues: Rosa reads the BOV and returns the signed listing
    // agreement, which is what puts the deal in front of the market (see
    // rosaClosing → RosaLeadsWatcher → rosaLoi).
    //
    // Guarded on the persona rather than armed for every seller, because the
    // reply is hand-authored in Rosa's voice — Miguel, the BOV read twice. The
    // rail's old BOV card armed it unconditionally, which would have had every
    // owner in the book sending back Rosa's letter.
    if (contact.heroKey === "rosa") {
      rosaClosing.arm(listing.id, contact.id);
    }
    flow.close();
  };

  return (
    <>
      {/* Step -1 — strategy and depth. The entry point for a deal with no run
          yet; `openPlacement` skips straight past it for one that has. */}
      <UnderwritingSetupModal
        open={flow.step === "setup"}
        onOpenChange={(o) => {
          if (!o && useBovFlow.getState().step === "setup") flow.close();
        }}
        listing={listing}
        fallbackStrategy="value-add"
        onStart={(strategy, selection) => {
          updateListingUnderwriting(listing.id, {
            ...underwritingFromSelection(strategy, selection),
            status: "generating",
          });
          flow.start(listing.id, contact.id, strategy, [...selection]);
        }}
      />

      {/* Step 0 — the Cactus run, in place on the contact. Not dismissable;
          it hands off to the save prompt the moment it finishes. */}
      <Modal
        open={flow.step === "generating"}
        onOpenChange={() => {}}
        disablePointerDismissal
      >
        <Modal.Content centered style={{ maxWidth: "30rem" }}>
          <div className="modal-header">
            <Modal.Title className="d-flex align-items-center gap-2">
              <FontAwesomeIcon
                icon={faSparkle}
                className="ai-deal-progress__title-icon"
              />
              Generating underwriting
            </Modal.Title>
          </div>
          <Modal.Body className="pb-5">
            <UnderwritingProgress
              strategy={flow.strategy}
              selectedChecks={flow.selection}
              onComplete={() => {
                // Persist the structured result, then prompt the save
                // immediately — same write path as the deal-page planner row.
                generateUnderwritingResult(listing.id);
                updateListingUnderwriting(listing.id, { status: "generated" });
                useBovFlow.setState({ step: "placement" });
              }}
            />
          </Modal.Body>
        </Modal.Content>
      </Modal>

      {/* Step 1 — save the run to a document (defaults to the BOV). The
          placement modal fires onPlaced and THEN onOpenChange(false) on save,
          so only treat the close as "cancel the flow" when the wizard hasn't
          already advanced past this step. */}
      <UnderwritingPlacementModal
        open={flow.step === "placement"}
        onOpenChange={(o) => {
          if (!o && useBovFlow.getState().step === "placement") flow.close();
        }}
        listing={listing}
        onPlaced={(placement) => flow.toPreview(placement.documentName)}
      />

      {/* Step 2 — preview the assembled document. */}
      <BovPreviewModal
        open={flow.step === "preview"}
        property={property}
        contact={contact}
        pricing={pricing}
        result={runResult}
        documentName={flow.documentName ?? "Broker Opinion of Value"}
        onEdit={handleEdit}
        onContinue={flow.toEmail}
        onClose={flow.close}
      />

      {/* Step 3 — AI-drafted email carrying the BOV link in its body. */}
      <BovEmailModal
        open={flow.step === "email"}
        contact={contact}
        property={property}
        pricing={pricing}
        onBack={flow.backToPreview}
        onSend={handleSend}
        onClose={flow.close}
      />
    </>
  );
}
