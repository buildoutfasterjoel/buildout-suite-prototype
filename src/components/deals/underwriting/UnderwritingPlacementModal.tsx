import { useEffect, useMemo, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileChartColumn, faFilePlus } from "@fortawesome/pro-regular-svg-icons";
import type { DealDocument, DealUnderwriting, Listing } from "#/data/types";
import { addDealDocument, updateListingUnderwriting } from "#/data/store";
import { notify } from "#/lib/notify";

type Mode = "existing" | "new";

/**
 * The payoff modal after generation: file the finished underwriting into an
 * existing deal document or spin up a new one. Persists the placement + flips the
 * underwriting to 'ready', then hands the placement back so the planner row can
 * settle into its "Review" state.
 */
export function UnderwritingPlacementModal({
  open,
  onOpenChange,
  listing,
  onPlaced,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: Listing;
  onPlaced: (placement: NonNullable<DealUnderwriting["placement"]>) => void;
}) {
  const documents = useMemo(() => listing.documents ?? [], [listing.documents]);
  const hasDocs = documents.length > 0;
  const defaultName = `Underwriting — ${listing.name}`;

  const [mode, setMode] = useState<Mode>(hasDocs ? "existing" : "new");
  const [docId, setDocId] = useState<string>(documents[0]?.id ?? "");
  const [newName, setNewName] = useState<string>(defaultName);

  // Re-seed the form each time the modal opens (the run's outcome is one-shot).
  useEffect(() => {
    if (!open) return;
    setMode(hasDocs ? "existing" : "new");
    setDocId(documents[0]?.id ?? "");
    setNewName(defaultName);
  }, [open, hasDocs, documents, defaultName]);

  const trimmedName = newName.trim();
  const canFile =
    mode === "existing" ? Boolean(docId) : trimmedName.length > 0;

  function handleFile() {
    if (!canFile) return;
    let placement: NonNullable<DealUnderwriting["placement"]>;

    if (mode === "existing") {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) return;
      placement = { documentId: doc.id, documentName: doc.name };
    } else {
      const doc: DealDocument = {
        id: crypto.randomUUID(),
        name: trimmedName,
        uploadedAt: new Date().toISOString(),
        aiGenerated: true,
      };
      addDealDocument(listing.id, doc);
      placement = { documentId: doc.id, documentName: doc.name };
    }

    updateListingUnderwriting(listing.id, { status: "ready", placement });
    notify({
      title: "Underwriting filed",
      description: `Added to ${placement.documentName}.`,
    });
    onPlaced(placement);
    onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content centered>
        <Modal.Header>
          <Modal.Title>Underwriting ready</Modal.Title>
          <Modal.Description>
            The AI underwriting is ready. Choose where this page should live.
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <div className="d-flex flex-column gap-2">
              <label
                className={`d-flex align-items-start gap-2 mb-0 border rounded p-3 ${
                  mode === "existing" ? "border-primary" : ""
                }`}
                style={{ cursor: hasDocs ? "pointer" : "not-allowed", opacity: hasDocs ? 1 : 0.6 }}
              >
                <RadioGroup.Item value="existing" className="mt-1" disabled={!hasDocs} />
                <span className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
                  <span className="fw-semibold d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon={faFileChartColumn} className="text-muted" />
                    Add to an existing document
                  </span>
                  <span className="text-muted fs-small">
                    Drop the underwriting page into a document already on this deal.
                  </span>
                  {mode === "existing" && hasDocs && (
                    <div className="mt-2" onClick={(e) => e.preventDefault()}>
                      <Select value={docId} onValueChange={(v) => v && setDocId(v)}>
                        <Select.Trigger>
                          <Select.Value>
                            {(v) => documents.find((d) => d.id === v)?.name ?? "Select a document"}
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Content>
                          {documents.map((d) => (
                            <Select.Item key={d.id} value={d.id}>
                              {d.name}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </div>
                  )}
                </span>
              </label>

              <label
                className={`d-flex align-items-start gap-2 mb-0 border rounded p-3 ${
                  mode === "new" ? "border-primary" : ""
                }`}
                style={{ cursor: "pointer" }}
              >
                <RadioGroup.Item value="new" className="mt-1" />
                <span className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
                  <span className="fw-semibold d-flex align-items-center gap-2">
                    <FontAwesomeIcon icon={faFilePlus} className="text-muted" />
                    Create a new document
                  </span>
                  <span className="text-muted fs-small">
                    Start a fresh document on the deal for the underwriting.
                  </span>
                  {mode === "new" && (
                    <div className="mt-2" onClick={(e) => e.preventDefault()}>
                      <Field>
                        <Field.Label>Document name</Field.Label>
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Underwriting"
                        />
                      </Field>
                    </div>
                  )}
                </span>
              </label>
            </div>
          </RadioGroup>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canFile} onClick={handleFile}>
            File underwriting
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
