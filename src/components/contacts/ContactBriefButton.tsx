import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Dialog } from "@buildoutinc/blueprint-react/ui/Dialog";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSparkles } from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import { generateContactBrief } from "#/ai/generate";
import { composeContactData } from "#/ai/contactData";
import { contactFullName } from "#/components/contacts/contactDisplay";

/**
 * "Brief me" (§3.10) — the in-context counterpart to the `research_contact` /
 * `answer_about_contact` agent tools, sharing the same `composeContactData` +
 * `generateContactBrief` plumbing (`src/ai/tools.ts`). With no question typed,
 * generates the full long-form brief; with a question, routes to the direct-
 * answer mode instead.
 */
export function ContactBriefButton({ contact }: { contact: Contact }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);

  const reset = () => {
    setQuestion("");
    setBrief(null);
    setLoading(false);
  };

  const generate = async () => {
    setLoading(true);
    try {
      const q = question.trim();
      const result = await generateContactBrief({
        data: {
          data: composeContactData(contact.id),
          name: contactFullName(contact),
          ...(q ? { question: q } : {}),
        },
      });
      setBrief(result.brief);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Dialog.Trigger render={<Button variant="outline" size="sm" />}>
        <FontAwesomeIcon icon={faSparkles} />
        Brief me
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>
              {brief ? contactFullName(contact) : "Brief me on this contact"}
            </Dialog.Title>
          </Dialog.Header>
          <Dialog.Body className="d-flex flex-column gap-3">
            {!brief ? (
              <Field>
                <Field.Label>Ask a specific question (optional)</Field.Label>
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Are they still looking for industrial space?"
                  autoFocus
                />
                <div className="form-text">
                  Leave blank for a full brief — ownership, deals, activity, takeaways.
                </div>
              </Field>
            ) : (
              <div className="assistant-markdown" style={{ whiteSpace: "pre-wrap" }}>
                {brief}
              </div>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            {!brief ? (
              <>
                <Dialog.Cancel variant="outline">Cancel</Dialog.Cancel>
                <Button variant="primary" onClick={generate} disabled={loading}>
                  <FontAwesomeIcon icon={faSparkles} />
                  {loading ? "Briefing…" : "Generate"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={reset}>
                  Ask another
                </Button>
                <Dialog.Cancel variant="primary">Done</Dialog.Cancel>
              </>
            )}
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
