import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import type { Contact, DealSummary } from "#/data/types";
import type { ComposedDraft } from "#/components/contacts/ContactComposeModule";
import { contactFullName, todayISO } from "#/components/contacts/contactDisplay";
import {
  OutcomeChips,
  RelatedDealSelect,
  SparkleButton,
} from "#/components/contacts/callLogFields";

/**
 * Fired automatically when a simulated call ends. Reuses the compose module's
 * "log a call" fields (notes, outcome chips, related-deal select, Log Call
 * button) inside a modal the user *cannot* dismiss — the only way out is to log
 * the call. There is deliberately no close button, and outside-click / Escape
 * are disabled.
 */
export function LogCallModal({
  open,
  contact,
  deals,
  onLog,
}: {
  open: boolean;
  contact: Contact;
  deals: DealSummary[];
  /** Commit the logged call; the caller closes the modal. */
  onLog: (draft: ComposedDraft) => void;
}) {
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("Connected");
  const [relatedDeal, setRelatedDeal] = useState("");

  // Start each forced log with a clean slate.
  useEffect(() => {
    if (open) {
      setNotes("");
      setOutcome("Connected");
      setRelatedDeal("");
    }
  }, [open]);

  const handleLog = () => {
    onLog({
      kind: "call",
      body: notes.trim(),
      date: todayISO(),
      outcome,
      relatedDeal: relatedDeal || undefined,
    });
  };

  return (
    // Controlled + no-op onOpenChange blocks Escape; disablePointerDismissal
    // blocks outside-click; the custom header omits the close button.
    <Modal open={open} onOpenChange={() => {}} disablePointerDismissal>
      <Modal.Content centered style={{ maxWidth: "34rem" }}>
        <div className="modal-header">
          <Modal.Title>Log Call with {contactFullName(contact)}</Modal.Title>
        </div>

        <Modal.Body className="d-flex flex-column gap-4">
          <div className="compose-textarea">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`What did you and ${contact.firstName} discuss?`}
              rows={5}
              autoFocus
            />
            <SparkleButton />
          </div>
          <OutcomeChips value={outcome} onChange={setOutcome} />
        </Modal.Body>

        <Modal.Footer className="justify-content-between">
          <RelatedDealSelect
            deals={deals}
            value={relatedDeal}
            onChange={setRelatedDeal}
          />
          <Button variant="primary" onClick={handleLog}>
            Log Call
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
