import { Fragment, useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/pro-regular-svg-icons";
import { TemplatePicker } from "./TemplatePicker";
import { SourceFilePicker } from "./SourceFilePicker";
import { InstructionSuggestions } from "./InstructionSuggestions";
import {
  DOC_TYPES,
  suggestionsFor,
  type DocType,
  type SourceFileRef,
  type SuggestionCard,
} from "#/data/documentGeneration";
import { getDealFiles, addDealFile } from "#/data/dealFilesActions";
import { getListing } from "#/data/store";
import { useNavigate } from "@tanstack/react-router";

/** The generation wizard's screens. The template list sits outside the wizard. */
type Screen = "generate" | "template" | "progress" | "review";

/** The generation wizard's steps, in order. */
const WIZARD_STEPS = [
  { n: 1 as const, label: "Content" },
  { n: 2 as const, label: "Generate" },
  { n: 3 as const, label: "Review" },
];

/**
 * Three-step progress indicator. Blueprint ships no stepper, so this is
 * hand-built from design tokens: the active/done accent uses `text-bg-primary`
 * (theme primary plus its contrast text) and `text-primary`; inactive steps use
 * `border`/`text-muted`. Mirrors the two-step version in `CreateDealModal`.
 */
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
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
              <span className={`fs-small fw-semibold ${lit ? "text-primary" : "text-muted"}`}>
                {s.label}
              </span>
            </span>
            {i < WIZARD_STEPS.length - 1 && (
              <span className="flex-grow-1 border-top" style={{ minWidth: "1rem" }} aria-hidden />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** Which step number a screen sits on. The template path is outside the wizard. */
const STEP_FOR_SCREEN: Record<Screen, 1 | 2 | 3 | null> = {
  generate: 1,
  progress: 2,
  review: 3,
  template: null,
};

/** The deal's files, flattened with their folder name for the picker's subtitle. */
function flattenDealFiles(listingId: string) {
  const all = getDealFiles(listingId);
  const folderName = (parentId: string | null) =>
    parentId ? (all.find((i) => i.id === parentId)?.name ?? "—") : "Deal files";
  return all
    .filter((i) => i.kind === "file" && !i.deletedAt)
    .map((file) => ({ file, folderName: folderName(file.parentId) }));
}

export function NewDocumentModal({
  open,
  onOpenChange,
  listingId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
}) {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("generate");
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [docType, setDocType] = useState<DocType>("Offering Memorandum");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [instructions, setInstructions] = useState("");
  const [items, setItems] = useState<ReturnType<typeof flattenDealFiles>>([]);

  // Reset every input when the modal opens, so a second run does not inherit
  // the first one's selection.
  useEffect(() => {
    if (!open) return;
    setScreen("generate");
    setName("");
    setNameEdited(false);
    setDocType("Offering Memorandum");
    setSelectedIds(new Set());
    setInstructions("");
    setItems(flattenDealFiles(listingId));
  }, [open, listingId]);

  const dealName = getListing(listingId)?.name ?? "Untitled Deal";
  const effectiveName = nameEdited && name.trim() ? name : `${docType} — ${dealName}`;

  const selectedFiles: SourceFileRef[] = items
    .filter((i) => selectedIds.has(i.file.id))
    .map((i) => ({ id: i.file.id, name: i.file.name }));

  const outlineInput = { docType, files: selectedFiles, instructions };
  const cards = suggestionsFor(outlineInput);

  const step = STEP_FOR_SCREEN[screen];

  function toggleSuggestion(card: SuggestionCard, add: boolean) {
    setInstructions((prev) => {
      if (add) return prev.trim() ? `${prev.trim()} ${card.sentence}` : card.sentence;
      return prev.replace(card.sentence, "").replace(/\s{2,}/g, " ").trim();
    });
  }

  function handleUpload(files: File[]) {
    const added = files.map((file, i) => ({
      id: `${listingId}-upload-${Date.now()}-${i}`,
      name: file.name,
      kind: "file" as const,
      parentId: null,
      createdAt: new Date().toISOString(),
      sizeBytes: file.size,
      blob: file,
    }));
    for (const item of added) addDealFile(listingId, item);
    setItems(flattenDealFiles(listingId));
    setSelectedIds((prev) => new Set([...prev, ...added.map((a) => a.id)]));
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="lg" scrollable centered style={{ maxWidth: "38rem" }}>
        <Modal.Header>
          <Modal.Title>New Document</Modal.Title>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3">
          {step !== null && <StepIndicator step={step} />}

          {screen === "generate" && (
            <>
              <Field>
                <Field.Label>Name</Field.Label>
                <Input
                  value={effectiveName}
                  onChange={(e) => {
                    setNameEdited(true);
                    setName(e.target.value);
                  }}
                />
              </Field>

              <Field>
                <Field.Label>Document type</Field.Label>
                <Select
                  value={docType}
                  onValueChange={(v) => v && setDocType(v as DocType)}
                >
                  <Select.Trigger className="w-100">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {DOC_TYPES.map((t) => (
                      <Select.Item key={t} value={t}>
                        {t}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>

              <SourceFilePicker
                items={items}
                selectedIds={selectedIds}
                onToggle={(id, checked) =>
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    checked ? next.add(id) : next.delete(id);
                    return next;
                  })
                }
                onUpload={handleUpload}
              />

              <Field>
                <Field.Label>Instructions</Field.Label>
                <Textarea
                  rows={3}
                  placeholder="What should this document emphasize?"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </Field>

              <InstructionSuggestions
                cards={cards}
                instructions={instructions}
                onToggle={toggleSuggestion}
              />
            </>
          )}

          {screen === "template" && (
            <TemplatePicker
              onSelect={() => {
                onOpenChange(false);
                navigate({ to: "/editor/$listingId", params: { listingId } });
              }}
            />
          )}
        </Modal.Body>

        {screen === "generate" && (
          <Modal.Footer className="d-flex align-items-center justify-content-between">
            <Button variant="ghost" onClick={() => setScreen("template")}>
              Choose from a template instead
            </Button>
            <Button
              variant="primary"
              disabled={selectedIds.size === 0}
              onClick={() => setScreen("progress")}
            >
              Generate
            </Button>
          </Modal.Footer>
        )}

        {screen === "template" && (
          <Modal.Footer>
            <Button variant="ghost" onClick={() => setScreen("generate")}>
              Back
            </Button>
          </Modal.Footer>
        )}
      </Modal.Content>
    </Modal>
  );
}
