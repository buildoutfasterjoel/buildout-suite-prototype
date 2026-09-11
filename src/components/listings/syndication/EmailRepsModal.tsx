import { useEffect, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/pro-regular-svg-icons";
import { notify } from "#/lib/notify";

export type EmailRepsTemplate = "new" | "update" | "offline";

/**
 * The three emails Buildout sends on a broker's behalf. One template goes to
 * every email channel at once — the channels differ in what they do with it,
 * not in what they're told.
 */
const TEMPLATES: {
  id: EmailRepsTemplate;
  title: string;
  description: string;
}[] = [
  {
    id: "new",
    title: "New Listing",
    description:
      "Announces the listing for the first time, with the address, price, and specs as they stand today.",
  },
  {
    id: "update",
    title: "Update Listing",
    description:
      "Tells the reps what changed — a price move, new photos, or revised availability — on a listing they already carry.",
  },
  {
    id: "offline",
    title: "Close/Offline Listing",
    description:
      "Asks the reps to take the listing down because it has closed, leased, or come off the market.",
  },
];

/** A joined list that reads like a sentence: "CoStar, LoopNet, and Crexi". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * Composes the one email that goes to every email-delivery rep at once. The
 * template is the whole message; the custom note rides along on top of it.
 */
export function EmailRepsModal({
  open,
  onOpenChange,
  channelNames,
  defaultTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Email channels this send reaches, in the order the modal lists them. */
  channelNames: string[];
  /** What the listing's own state suggests the broker is here to send. */
  defaultTemplate: EmailRepsTemplate;
}) {
  const [template, setTemplate] = useState<EmailRepsTemplate>(defaultTemplate);
  const [note, setNote] = useState("");

  // Every open is a fresh send: the note from last time is not a draft, and the
  // listing may have moved on since (published, closed) and suggest a different
  // template.
  useEffect(() => {
    if (open) {
      setTemplate(defaultTemplate);
      setNote("");
    }
  }, [open, defaultTemplate]);

  const send = () => {
    const chosen = TEMPLATES.find((t) => t.id === template);
    onOpenChange(false);
    notify({
      title: `"${chosen?.title}" email queued`,
      description: `${joinNames(channelNames)} will receive it shortly.`,
    });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content scrollable centered>
        <Modal.Header>
          <Modal.Title>Email Reps</Modal.Title>
          <Modal.Description>
            One email goes to {joinNames(channelNames)}. Pick what it should
            say.
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          <RadioGroup
            value={template}
            onValueChange={(v) => setTemplate(v as EmailRepsTemplate)}
            className="d-flex flex-column gap-2"
          >
            {TEMPLATES.map((t) => (
              <label
                key={t.id}
                className="email-reps__choice d-flex align-items-start gap-2 mb-0 p-3 border rounded"
              >
                <RadioGroup.Item value={t.id} />
                <span className="d-flex flex-column">
                  <span className="fw-semibold">{t.title}</span>
                  <span className="fs-small text-muted">{t.description}</span>
                </span>
              </label>
            ))}
          </RadioGroup>

          <Field>
            <Field.Label>Custom message (optional)</Field.Label>
            <Textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the reps should know beyond the template — a tour date, a deadline, who to call."
            />
          </Field>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={send}>
            <FontAwesomeIcon icon={faPaperPlane} />
            Send Email
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
