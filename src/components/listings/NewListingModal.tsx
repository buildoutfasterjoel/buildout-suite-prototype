import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWandMagicSparkles,
  faCloudArrowUp,
  faSpinner,
  faSparkles,
  faSign,
  faPaperclip,
  faXmark,
  faSearch,
} from "@fortawesome/pro-regular-svg-icons";
import {
  PROPERTY_TYPES,
  TYPE_LABELS,
} from "#/components/properties/propertyDisplay";
import type { DealType } from "#/data/types";
import {
  createProposalListing,
  emptyDraft,
  type NewListingDraft,
} from "#/data/createListing";
import { extractListingDraft } from "#/data/listingExtraction";
import { getProperty, getPropertyOptions } from "#/data/store";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";

type TabValue = "ai" | "details";
type PropertyOption = { value: string; label: string };

const DEAL_TYPES: DealType[] = ["Sale", "Lease", "Sale / Lease"];

export function NewListingModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<TabValue>("ai");
  const [prompt, setPrompt] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState<NewListingDraft>(emptyDraft);

  function reset() {
    setTab("ai");
    setPrompt("");
    setFileName(null);
    setAnalyzing(false);
    setDraft(emptyDraft());
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function generate() {
    setAnalyzing(true);
    const extracted = await extractListingDraft({
      prompt,
      fileName: fileName ?? undefined,
    });
    setDraft({ ...emptyDraft(), ...extracted });
    setAnalyzing(false);
    setTab("details");
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setFileName(file.name);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) setFileName(file.name);
  }

  function updateDraft<K extends keyof NewListingDraft>(
    key: K,
    value: NewListingDraft[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleCreate() {
    const listing = createProposalListing(draft);
    reset();
    onOpenChange(false);
    void navigate({
      to: "/listings/$listingId/overview",
      params: { listingId: listing.id },
    });
  }

  const canGenerate = !analyzing && (prompt.trim() !== "" || fileName !== null);
  const canCreate = draft.name.trim() !== "" || draft.address.trim() !== "";

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <Modal.Content size="lg" scrollable>
        <Modal.Header>
          <Modal.Title>New Listing</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p className="text-muted mb-3">
            Start a listing in proposal mode. Describe it or attach a document
            and let AI fill in the details — or enter them yourself.
          </p>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab((v ?? "ai") as TabValue)}
          >
            <Tabs.List variant="pills" className="mb-3">
              <Tabs.Tab value="ai" icon={<FontAwesomeIcon icon={faSparkles} />}>
                Use AI
              </Tabs.Tab>
              <Tabs.Tab
                value="details"
                icon={<FontAwesomeIcon icon={faSign} />}
              >
                Listing details
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="ai">
              {analyzing ? (
                <div className="d-flex flex-column align-items-center justify-content-center text-center gap-3 py-5">
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    style={{ fontSize: 32 }}
                    className="text-primary"
                  />
                  <div>
                    <div className="fw-semibold">
                      Analyzing your {fileName ? "document" : "description"}…
                    </div>
                    <div className="text-muted" style={{ fontSize: 13 }}>
                      Extracting address, property type, and pricing.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {/* Attach a document (optional) */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="d-none"
                    onChange={handleFilePicked}
                  />
                  {fileName ? (
                    <div className="d-flex align-items-center gap-2 border rounded px-3 py-2">
                      <FontAwesomeIcon
                        icon={faPaperclip}
                        className="text-muted"
                      />
                      <span className="flex-grow-1 text-truncate">
                        {fileName}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove document"
                        onClick={() => setFileName(null)}
                      >
                        <FontAwesomeIcon icon={faXmark} />
                      </Button>
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      className="border border-dashed rounded"
                      style={{ cursor: "pointer" }}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          fileInputRef.current?.click();
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                    >
                      <Empty className="py-4">
                        <Empty.Media>
                          <FontAwesomeIcon icon={faCloudArrowUp} aria-hidden />
                        </Empty.Media>
                        <Empty.Content>
                          <Empty.Title>
                            Drop a document here or click to upload
                          </Empty.Title>
                          AI will read the offering memo or flyer to build the
                          listing.
                        </Empty.Content>
                      </Empty>
                    </div>
                  )}

                  {/* Describe / add details */}
                  <div>
                    <label
                      className="form-label"
                      htmlFor="new-listing-describe"
                    >
                      Describe the listing
                    </label>
                    <Textarea
                      id="new-listing-describe"
                      rows={4}
                      placeholder="Add details, or just describe the listing — e.g. 2.4M office sale, 12,000 SF at 123 Main St, Chicago IL"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                    <div className="d-flex justify-content-end mt-2">
                      <Button
                        variant="primary"
                        disabled={!canGenerate}
                        onClick={generate}
                      >
                        <FontAwesomeIcon icon={faWandMagicSparkles} />
                        Generate listing
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="details">
              <ListingDetailsForm draft={draft} onChange={updateDraft} />
            </Tabs.Panel>
          </Tabs>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canCreate}
            onClick={handleCreate}
          >
            Create proposal
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}

function ListingDetailsForm({
  draft,
  onChange,
}: {
  draft: NewListingDraft;
  onChange: <K extends keyof NewListingDraft>(
    key: K,
    value: NewListingDraft[K],
  ) => void;
}) {
  const num = (v: string) => {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return Number.isNaN(n) ? 0 : n;
  };

  const propertyOptions = useMemo<PropertyOption[]>(getPropertyOptions, []);
  const selectedProperty =
    propertyOptions.find((o) => o.value === draft.propertyId) ?? null;

  function selectProperty(option: PropertyOption | null) {
    onChange("propertyId", option?.value ?? "");
    onChange("address", option?.label ?? "");
    if (option) {
      const p = getProperty(option.value);
      if (p) onChange("propertyType", p.propertyType);
    }
  }

  return (
    <div className="row g-3">
      <div className="col-12">
        <label className="form-label">Property</label>
        <Combobox
          items={propertyOptions}
          value={selectedProperty}
          onValueChange={(v) => selectProperty(v as PropertyOption | null)}
        >
          <Combobox.InputGroup>
            <InputGroup.Addon>
              <FontAwesomeIcon icon={faSearch} />
            </InputGroup.Addon>
            <Combobox.Input
              placeholder="Search properties by address…"
              showClear
            />
          </Combobox.InputGroup>
          <Combobox.Content>
            <Combobox.Empty className="p-3 text-muted">
              No matching properties
            </Combobox.Empty>
            <Combobox.List>
              {(item: PropertyOption) => (
                <Combobox.Item key={item.value} value={item}>
                  {item.label}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Content>
        </Combobox>
      </div>

      <div className="col-12">
        <label className="form-label">Listing name</label>
        <Input
          placeholder={draft.address || "Defaults to the address"}
          value={draft.name}
          onValueChange={(v: string) => onChange("name", v)}
        />
      </div>

      <div className="col-6">
        <label className="form-label">Property type</label>
        <Select
          value={draft.propertyType}
          onValueChange={(v) => v && onChange("propertyType", v as never)}
        >
          <Select.Trigger>
            <Select.Value>
              {(v) => TYPE_LABELS[v as keyof typeof TYPE_LABELS]}
            </Select.Value>
          </Select.Trigger>
          <Select.Content>
            {PROPERTY_TYPES.map((t) => (
              <Select.Item key={t} value={t}>
                {TYPE_LABELS[t]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
      <div className="col-6">
        <label className="form-label">Deal type</label>
        <Select
          value={draft.dealType}
          onValueChange={(v) => v && onChange("dealType", v as DealType)}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {DEAL_TYPES.map((t) => (
              <Select.Item key={t} value={t}>
                {t}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>

      <div className="col-6">
        <label className="form-label">
          {draft.dealType === "Lease"
            ? "Listing price (optional)"
            : "Listing price"}
        </label>
        <Input
          inputMode="numeric"
          placeholder="$"
          value={draft.listingPrice ? String(draft.listingPrice) : ""}
          onValueChange={(v: string) => onChange("listingPrice", num(v))}
        />
      </div>
      <div className="col-6">
        <label className="form-label">Commission (%)</label>
        <Input
          inputMode="numeric"
          placeholder="e.g. 3"
          value={draft.commissionPct ? String(draft.commissionPct) : ""}
          onValueChange={(v: string) => onChange("commissionPct", num(v))}
        />
      </div>

      <div className="col-12">
        <label className="form-label">Available SF</label>
        <Input
          inputMode="numeric"
          value={draft.availableSqFt ? String(draft.availableSqFt) : ""}
          onValueChange={(v: string) => onChange("availableSqFt", num(v))}
        />
      </div>

      <div className="col-12">
        <label className="form-label">Listing description</label>
        <Textarea
          rows={3}
          placeholder="What makes this offering compelling?"
          value={draft.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>

      <div className="col-12">
        <label className="form-label">Location description</label>
        <Textarea
          rows={3}
          placeholder="Neighborhood, access, nearby anchors…"
          value={draft.locationDescription}
          onChange={(e) => onChange("locationDescription", e.target.value)}
        />
      </div>
    </div>
  );
}
