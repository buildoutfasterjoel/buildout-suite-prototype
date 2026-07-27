import { useEffect, useRef, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSparkle } from "@fortawesome/pro-regular-svg-icons";
import type { Contact, DealSummary } from "#/data/types";
import type { ComposedDraft } from "#/components/contacts/ContactComposeModule";
import { contactFullName, todayISO } from "#/components/contacts/contactDisplay";
import {
  OutcomeChips,
  RelatedDealSelect,
  SparkleButton,
} from "#/components/contacts/callLogFields";

type DraftPhase = "thinking" | "writing" | "done";

/** Streaming cadence — a few characters per tick reads as live generation. */
const THINK_MS = 1100;
const TICK_MS = 24;
const CHARS_PER_TICK = 3;

/**
 * Fired when a simulated call ends. Reuses the compose module's "log a call"
 * fields (notes, outcome chips, related-deal select, Log Call button) inside a
 * modal the user *cannot* dismiss — the only way out is to log the call. There
 * is deliberately no close button, and outside-click / Escape are disabled.
 *
 * The AI assistant's summary of the call (`draft`) streams into the notes field
 * with a visible thinking → writing animation. It stays fully editable (any
 * keystroke mid-stream hands control over), and nothing is written to the CRM
 * until the user clicks Log Call themselves.
 */
export function LogCallModal({
  open,
  contact,
  deals,
  draft,
  initialOutcome = "Connected",
  onLog,
}: {
  open: boolean;
  contact: Contact;
  deals: DealSummary[];
  /** The AI-written call summary to stream in as the starting notes. */
  draft: string;
  /** Outcome chip to start on (e.g. "No Answer" for an unanswered call). */
  initialOutcome?: string;
  /** Commit the logged call; the caller closes the modal. */
  onLog: (draft: ComposedDraft) => void;
}) {
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState(initialOutcome);
  const [relatedDeal, setRelatedDeal] = useState("");
  const [phase, setPhase] = useState<DraftPhase>("done");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopDrafting = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  };

  // Start each log with a clean slate, then let the assistant write its summary
  // in: a short "thinking" beat, then the text streams.
  useEffect(() => {
    if (!open) {
      stopDrafting();
      return;
    }
    setNotes("");
    setOutcome(initialOutcome);
    setRelatedDeal("");

    const target = draft.trim();
    if (!target) {
      setPhase("done");
      return;
    }
    setPhase("thinking");
    timerRef.current = setTimeout(() => {
      setPhase("writing");
      let i = 0;
      tickerRef.current = setInterval(() => {
        i = Math.min(i + CHARS_PER_TICK, target.length);
        setNotes(target.slice(0, i));
        if (i >= target.length) {
          stopDrafting();
          setPhase("done");
        }
      }, TICK_MS);
    }, THINK_MS);

    return stopDrafting;
    // Re-run only when the modal opens (the draft is fixed per call).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Any user edit mid-generation interrupts the stream and hands over. */
  const handleNotesChange = (value: string) => {
    if (phase !== "done") {
      stopDrafting();
      setPhase("done");
    }
    setNotes(value.replace(/▍/g, ""));
  };

  const handleLog = () => {
    onLog({
      kind: "call",
      body: notes.trim(),
      date: todayISO(),
      outcome,
      relatedDeal: relatedDeal || undefined,
    });
  };

  const drafting = phase !== "done";

  return (
    // Controlled + no-op onOpenChange blocks Escape; disablePointerDismissal
    // blocks outside-click; the custom header omits the close button.
    <Modal open={open} onOpenChange={() => {}} disablePointerDismissal>
      <Modal.Content centered style={{ maxWidth: "34rem" }}>
        <div className="modal-header">
          <Modal.Title>Log Call with {contactFullName(contact)}</Modal.Title>
        </div>

        <Modal.Body className="d-flex flex-column gap-4">
          <div className="d-flex flex-column gap-2">
            <div className="compose-textarea">
              <Textarea
                value={phase === "writing" ? `${notes}▍` : notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder={`What did you and ${contact.firstName} discuss?`}
                rows={5}
                autoFocus
              />
              <SparkleButton />
            </div>
            <div className={`ai-draft ${drafting ? "is-drafting" : ""}`}>
              <FontAwesomeIcon icon={faSparkle} className="ai-draft__icon" />
              {phase === "thinking"
                ? "AI Assistant is drafting a summary of your call…"
                : phase === "writing"
                  ? "Drafting…"
                  : "Drafted by AI — review and edit before logging."}
            </div>
          </div>
          <OutcomeChips value={outcome} onChange={setOutcome} />
        </Modal.Body>

        <Modal.Footer className="justify-content-between">
          <RelatedDealSelect
            deals={deals}
            value={relatedDeal}
            onChange={setRelatedDeal}
          />
          {/* The user always makes the final call — Log Call never fires on its
              own, and stays disabled until the draft settles. */}
          <Button variant="primary" onClick={handleLog} disabled={drafting}>
            Log Call
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
