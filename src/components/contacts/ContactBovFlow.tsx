import { useEffect, useRef, useState } from "react";
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
  faSparkle,
  faXmark,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, Property } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import {
  generateUnderwritingResult,
  getProperty,
  updateListingUnderwriting,
} from "#/data/store";
import { notify } from "#/lib/notify";
import { TYPE_LABELS } from "#/components/properties/propertyDisplay";
import { getPhotoUrl } from "#/components/properties/propertyDisplay";
import { UnderwritingProgress } from "#/components/deals/underwriting/UnderwritingProgress";
import { UnderwritingPlacementModal } from "#/components/deals/underwriting/UnderwritingPlacementModal";
import { contactFullName, todayISO } from "#/components/contacts/contactDisplay";
import type { ComposedDraft } from "#/components/contacts/ContactComposeModule";
import { useBovFlow } from "#/components/contacts/useBovFlow";

/** The BOV wizard's three visible stages (generation runs before them). */
const FLOW_STEPS = ["Assemble", "Preview", "Email"] as const;

/** File name the "sent" BOV pdf carries, e.g. `The_Delgado_Building_BOV.pdf`. */
function bovFileName(property: Property): string {
  return `${property.name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "")}_BOV.pdf`;
}

const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

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
 * link sits in the body, where a link in an email actually belongs. The real
 * product would draft from the underwrite output and the broker's notes.
 */
function draftBovEmail(contact: Contact, property: Property): string {
  const low = fmtM(property.askingPrice * 0.97);
  const high = fmtM(property.askingPrice * 1.05);
  const link = bovDocUrl(property);
  if (contact.heroKey === "rosa") {
    return (
      "Rosa,\n\nThank you for trusting me with Miguel's files. I went through the T12 and " +
      "rent roll and put together the quiet first look we talked about. Headline: " +
      `${low} – ${high}, anchored on the in-place rent roll with conservative assumptions ` +
      "and no pressure behind it.\n\nHere's the full BOV:\n" +
      `${link}\n\nA few things I noticed:\n\n` +
      "1. In-place rents run below the corridor's going rate — upside a buyer pays for, not a problem.\n" +
      "2. The T12 carries a one-time roof repair; setting it aside lifts the valuation meaningfully.\n" +
      "3. The ground-floor tenants are steady — an operator buyer would see exactly what Miguel built.\n\n" +
      "No decisions needed. Read it when you're ready, and I'm happy to walk through " +
      "it whenever feels right.\n\nJohn"
    );
  }
  return (
    `${contact.firstName},\n\nThanks for sharing the financials. I ran a first-pass ` +
    `underwrite — headline: ${low} – ${high}, anchored on the in-place numbers with ` +
    "conservative assumptions.\n\nHere's the full BOV:\n" +
    `${link}\n\nWorth a quick conversation before you read it — open this week for a ` +
    "30-minute walk-through? I'd rather get your read before we settle on a price.\n\nJohn"
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
 * Step 2 — the assembled BOV's cover page, previewed in place. "Continue to
 * email" advances the wizard; "Edit document" is a placeholder for the jump to
 * the doc editor, which stays unwired for now (navigating away mid-wizard broke
 * the flow). The sent email's timeline chip links to the document afterward.
 */
function BovPreviewModal({
  open,
  property,
  documentName,
  onContinue,
  onClose,
}: {
  open: boolean;
  property: Property;
  documentName: string;
  onContinue: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Content size="lg" centered scrollable style={{ maxWidth: "56rem" }}>
        <FlowHeader title={documentName} active={1} onClose={onClose} />
        <Modal.Body style={{ maxHeight: 620 }} className="p-5">
          <div className="bov-cover position-relative">
            <img
              src={getPhotoUrl(property.id, 1200, 640)}
              alt={property.name}
              className="bov-cover__photo"
            />
            <div className="bov-cover__band">
              <div className="bov-cover__kicker">Broker Opinion of Value</div>
              <div className="bov-cover__name">{property.name}</div>
              <div className="bov-cover__address">
                {[property.street, property.city, property.state]
                  .filter(Boolean)
                  .join(", ")}{" "}
                {property.zip}
              </div>
              <hr className="bov-cover__rule" />
              <div className="bov-cover__meta">
                {TYPE_LABELS[property.propertyType]} Property |{" "}
                {property.buildingSqFt.toLocaleString()} SF
              </div>
            </div>
            <span className="bov-cover__page">
              <strong>1</strong> of 12
            </span>
          </div>
        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          <Button variant="ghost" appearance="muted" onClick={onClose}>
            Cancel
          </Button>
          <div className="d-flex gap-2">
            {/* Intentionally inert for now: the jump to the document editor
                isn't wired up (navigating away mid-wizard broke the flow), so
                this stands in for that route until it is. */}
            <Button variant="outline">Edit document</Button>
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
  onBack,
  onSend,
  onClose,
}: {
  open: boolean;
  contact: Contact;
  property: Property;
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

  // Stream the AI draft in on open — fast enough to feel live, not slow.
  useEffect(() => {
    if (!open) {
      stopDrafting();
      return;
    }
    setSubject(`${property.name}, preliminary valuation`);
    setBody("");
    setEditing(false);
    setDrafting(true);
    const target = draftBovEmail(contact, property);
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
 * Orchestrates the contact-page BOV flow (see useBovFlow): the Cactus run in a
 * modal → the save-to-document prompt → the assembled BOV preview → the
 * AI-drafted send email → a timeline event linking the sent BOV. Hosted once
 * on the contact detail page; renders nothing while the flow is closed.
 */
export function ContactBovFlow({
  contact,
  onLog,
}: {
  contact: Contact;
  /** Log the sent email into the page's activity list (timeline). */
  onLog: (draft: ComposedDraft) => void;
}) {
  const flow = useBovFlow();
  const listing = useDataStore((s) =>
    flow.listingId ? s.listings.get(flow.listingId) : undefined,
  );
  if (!listing) return null;
  const property = getProperty(listing.propertyId);
  if (!property) return null;

  const handleSend = (subject: string, body: string) => {
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
    flow.close();
  };

  return (
    <>
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
        documentName={flow.documentName ?? "Broker Opinion of Value"}
        onContinue={flow.toEmail}
        onClose={flow.close}
      />

      {/* Step 3 — AI-drafted email carrying the BOV link in its body. */}
      <BovEmailModal
        open={flow.step === "email"}
        contact={contact}
        property={property}
        onBack={flow.backToPreview}
        onSend={handleSend}
        onClose={flow.close}
      />
    </>
  );
}
