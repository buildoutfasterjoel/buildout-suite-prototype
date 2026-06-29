import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faPaperPlane,
  faPaperclip,
  faPenToSquare,
  faXmark,
  faSearch,
  faLocationDot,
  faCheck,
  faSign,
  faUser,
} from "@fortawesome/pro-regular-svg-icons";
import {
  PROPERTY_TYPES,
  TYPE_LABELS,
  TYPE_COLORS,
} from "#/components/properties/propertyDisplay";
import {
  createProposalListing,
  emptyDraft,
  type NewListingDraft,
} from "#/data/createListing";
import {
  extractListingDraft,
  refineListingDraft,
} from "#/data/listingExtraction";
import {
  getProperty,
  getPropertyOptions,
  getOwnersForProperty,
  getSellerOptions,
  getContact,
  contactLabel,
} from "#/data/store";

type PropertyOption = { value: string; label: string };
type ContactOption = { value: string; label: string };
type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  /** Inline choices the broker can tap — used to pick the seller among owners. */
  sellerChips?: ContactOption[];
};

const GREETING =
  "Tell me about the sale — talk or type. Describe the building and I’ll pull the matching property from your CRM. Just tell me your asking price and commission.";

// What the simulated microphone "hears" — locate the property, set the broker's terms.
const VOICE_TRANSCRIPT =
  "I’m putting my office tower in Charlotte’s Ballantyne submarket up for sale — asking $120M at a 3% commission. Pull it up from my CRM and start the deal.";

/** Animated listening bars shown while the (simulated) mic is capturing. */
function Waveform() {
  return (
    <span
      className="d-inline-flex align-items-end gap-1 text-primary"
      style={{ height: 22 }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="nl-wave-bar"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </span>
  );
}

function fmtPrice(n: number): string {
  return n > 0 ? `$${n.toLocaleString()}` : "";
}

function summarize(draft: NewListingDraft): string {
  // Deal terms the broker sets — these aren't on the property record.
  const terms: string[] = [];
  if (draft.listingPrice > 0) terms.push(`asking ${fmtPrice(draft.listingPrice)}`);
  if (draft.commissionPct > 0) terms.push(`a ${draft.commissionPct}% commission`);
  const termsText = terms.length
    ? ` I’ve set it up as a sale at ${terms.join(" with ")}.`
    : " I’ve set it up as a sale — just tell me your asking price and commission.";

  // Matched to a CRM property — tell the broker we located it and pulled its facts.
  const property = draft.propertyId ? getProperty(draft.propertyId) : undefined;
  if (property) {
    const cls = property.buildingClass ? `Class ${property.buildingClass} ` : "";
    const size =
      draft.availableSqFt > 0 ? `, ${draft.availableSqFt.toLocaleString()} SF` : "";
    return `Found ${property.name} at ${draft.address} in your CRM — a ${cls}${TYPE_LABELS[draft.propertyType]} property${size}.${termsText}`;
  }

  const where = draft.address ? ` at ${draft.address}` : "";
  return `Got it — a ${TYPE_LABELS[draft.propertyType]} sale${where}.${termsText}`;
}

export function NewListingModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: "greeting", role: "ai", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [listening, setListening] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<NewListingDraft>(emptyDraft);

  function reset() {
    setMessages([{ id: "greeting", role: "ai", text: GREETING }]);
    setInput("");
    setFileName(null);
    setAnalyzing(false);
    setListening(false);
    setHasDraft(false);
    setEditing(false);
    setDraft(emptyDraft());
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, analyzing]);

  function pushMessage(msg: Omit<ChatMessage, "id">) {
    setMessages((m) => [...m, { ...msg, id: crypto.randomUUID() }]);
  }

  function updateDraft<K extends keyof NewListingDraft>(
    key: K,
    value: NewListingDraft[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSend(raw?: string) {
    const text = (raw ?? input).trim();
    if (analyzing || (text === "" && !fileName)) return;

    pushMessage({
      role: "user",
      text: text || `📎 ${fileName}`,
    });
    setInput("");
    setAnalyzing(true);

    const wasFirst = !hasDraft;
    let next: NewListingDraft;
    if (wasFirst) {
      const extracted = await extractListingDraft({
        prompt: text,
        fileName: fileName ?? undefined,
      });
      next = { ...emptyDraft(), ...extracted };
    } else {
      const refined = await refineListingDraft(text);
      next = { ...draft, ...refined };
    }

    setDraft(next);
    setHasDraft(true);
    setFileName(null);
    setAnalyzing(false);
    pushMessage({ role: "ai", text: summarize(next) });

    // After the first match, settle the seller — auto-set when there's one owner,
    // ask when there are several, note it when the property has none on file.
    if (wasFirst && next.propertyId) {
      announceSeller(next);
    }
  }

  /** Follow-up message resolving who the seller is, based on the property's owners. */
  function announceSeller(d: NewListingDraft) {
    const owners = getOwnersForProperty(d.propertyId);
    if (owners.length === 1) {
      pushMessage({
        role: "ai",
        text: `${contactLabel(owners[0])} is the owner on file — I’ve set them as the seller.`,
      });
    } else if (owners.length > 1) {
      pushMessage({
        role: "ai",
        text: `This property has ${owners.length} owners on file. Which one is the seller?`,
        sellerChips: owners.map((o) => ({ value: o.id, label: contactLabel(o) })),
      });
    } else {
      pushMessage({
        role: "ai",
        text: "I couldn’t find an owner on file for this property — pick the seller in the details below.",
      });
    }
  }

  function chooseSeller(option: ContactOption) {
    updateDraft("sellerContactId", option.value);
    pushMessage({ role: "user", text: option.label });
    pushMessage({ role: "ai", text: `Got it — ${option.label} is the seller.` });
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setFileName(file.name);
  }

  function startMic() {
    if (analyzing || listening) return;
    setListening(true);
    window.setTimeout(() => {
      setListening(false);
      void handleSend(VOICE_TRANSCRIPT);
    }, 1900);
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

  const canSend = !analyzing && (input.trim() !== "" || fileName !== null);
  const canCreate = draft.name.trim() !== "" || draft.address.trim() !== "";

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <Modal.Content size="lg" scrollable centered>
        <style>{WAVE_CSS}</style>
        <Modal.Header>
          <Modal.Title>New Deal</Modal.Title>
          <Modal.Description>
            Tell us about your deal to get started.
          </Modal.Description>
        </Modal.Header>

        <Modal.Body>
          {/* Conversation */}
          <div
            className="d-flex flex-column gap-3 border rounded p-3"
            style={{ maxHeight: 280, overflowY: "auto" }}
          >
            {messages.map((m) => (
              <ChatBubble
                key={m.id}
                message={m}
                sellerChosen={draft.sellerContactId !== ""}
                onSeller={chooseSeller}
              />
            ))}
            {analyzing && <TypingBubble />}
            <div ref={threadEndRef} />
          </div>

          {/* Live "Deal so far" card */}
          {hasDraft && (
            <DealSoFarCard
              draft={draft}
              editing={editing}
              onToggleEdit={() => setEditing((e) => !e)}
              onChange={updateDraft}
            />
          )}

          {/* Composer */}
          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              className="d-none"
              onChange={handleFilePicked}
            />
            {fileName && (
              <div className="d-flex align-items-center gap-2 border rounded px-3 py-2 mb-2">
                <FontAwesomeIcon icon={faPaperclip} className="text-muted" />
                <span className="flex-grow-1 text-truncate fs-small">
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
            )}
            <InputGroup>
              <InputGroup.Addon>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Attach a document"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={analyzing || listening}
                >
                  <FontAwesomeIcon icon={faPaperclip} />
                </Button>
              </InputGroup.Addon>
              {listening ? (
                <div className="form-control d-flex align-items-center gap-2 text-muted">
                  <Waveform />
                  <span className="fs-small">Listening…</span>
                </div>
              ) : (
                <Input
                  placeholder={
                    hasDraft
                      ? "Refine it — e.g. “asking $2.6M” or “10,000 SF”"
                      : "Describe the building, or tap the mic to talk…"
                  }
                  value={input}
                  onValueChange={(v: string) => setInput(v)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  disabled={analyzing}
                />
              )}
              <InputGroup.Addon>
                <Button
                  variant={listening ? "destructive" : "ghost"}
                  size="icon-sm"
                  aria-label="Use microphone"
                  onClick={startMic}
                  disabled={analyzing}
                >
                  <FontAwesomeIcon icon={faMicrophone} />
                </Button>
                <Button
                  variant="primary"
                  size="icon-sm"
                  aria-label="Send"
                  onClick={() => void handleSend()}
                  disabled={!canSend}
                >
                  <FontAwesomeIcon icon={faPaperPlane} />
                </Button>
              </InputGroup.Addon>
            </InputGroup>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canCreate}
            onClick={handleCreate}
          >
            <FontAwesomeIcon icon={faCheck} />
            Create deal
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}

const WAVE_CSS = `
.nl-wave-bar { width: 3px; height: 6px; border-radius: 2px; background: currentColor; animation: nl-wave 0.9s ease-in-out infinite; }
@keyframes nl-wave { 0%, 100% { height: 6px; } 50% { height: 20px; } }
`;

/** A single conversation bubble — AI on the left, broker on the right. */
function ChatBubble({
  message,
  sellerChosen,
  onSeller,
}: {
  message: ChatMessage;
  sellerChosen: boolean;
  onSeller: (option: ContactOption) => void;
}) {
  const isAi = message.role === "ai";
  return (
    <div className={`d-flex ${isAi ? "" : "justify-content-end"}`}>
      <div style={{ maxWidth: "85%" }}>
        <div className={isAi ? "" : "rounded px-3 py-2 text-bg-secondary"}>
          {message.text}
        </div>
        {message.sellerChips && (
          <div className="d-flex flex-wrap gap-2 mt-2">
            {message.sellerChips.map((c) => (
              <Button
                key={c.value}
                variant="outline"
                size="sm"
                disabled={sellerChosen}
                onClick={() => onSeller(c)}
              >
                {c.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The "AI is thinking" indicator shown while extraction runs. */
function TypingBubble() {
  return (
    <div className="d-flex">
      <div className="rounded px-3 py-2 bg-body-secondary d-flex align-items-center gap-1 text-muted">
        <Waveform />
      </div>
    </div>
  );
}

/** Live summary of the deal being built, with an inline edit toggle. */
function DealSoFarCard({
  draft,
  editing,
  onToggleEdit,
  onChange,
}: {
  draft: NewListingDraft;
  editing: boolean;
  onToggleEdit: () => void;
  onChange: <K extends keyof NewListingDraft>(
    key: K,
    value: NewListingDraft[K],
  ) => void;
}) {
  const property = draft.propertyId ? getProperty(draft.propertyId) : undefined;
  const facts = [
    TYPE_LABELS[draft.propertyType],
    "For sale",
    fmtPrice(draft.listingPrice),
    draft.availableSqFt > 0 ? `${draft.availableSqFt.toLocaleString()} SF` : "",
  ].filter(Boolean);

  const connection = property
    ? property.name
    : draft.address || "New property";

  const seller = draft.sellerContactId
    ? getContact(draft.sellerContactId)
    : undefined;

  return (
    <div className="border rounded p-3 mt-3">
      <div className="d-flex align-items-start gap-3">
        <span
          className="d-inline-flex align-items-center justify-content-center rounded"
          style={{
            width: 40,
            height: 40,
            flex: "0 0 auto",
            backgroundColor: `${TYPE_COLORS[draft.propertyType]}1a`,
            color: TYPE_COLORS[draft.propertyType],
          }}
        >
          <FontAwesomeIcon icon={faSign} />
        </span>
        <div className="flex-grow-1">
          <div className="text-muted fs-small mb-1">Deal so far</div>
          <div className="fw-semibold fs-large">
            {draft.name || draft.address || "Untitled deal"}
          </div>
          <div className="text-muted">{facts.join(" · ")}</div>
          <div className="d-flex align-items-center gap-1 mt-1 fs-small">
            <FontAwesomeIcon icon={faLocationDot} className="text-muted" />
            {connection}
          </div>
          <div className="d-flex align-items-center gap-1 mt-1 fs-small">
            <FontAwesomeIcon icon={faUser} className="text-muted" />
            {seller ? (
              <span>
                <span className="text-muted">Seller:</span>{" "}
                {contactLabel(seller)}
              </span>
            ) : (
              <span className="text-muted">
                No seller yet — add one in the details below
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onToggleEdit}>
          <FontAwesomeIcon icon={faPenToSquare} />
          {editing ? "Done" : "Edit"}
        </Button>
      </div>

      {editing && (
        <div className="mt-3 pt-3 border-top">
          <DealEditFields draft={draft} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

/** Full editable field set — property connection plus listing-level details. */
function DealEditFields({
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
  const selectedOption =
    propertyOptions.find((o) => o.value === draft.propertyId) ?? null;

  const sellerOptions = useMemo<ContactOption[]>(
    () => getSellerOptions(draft.propertyId),
    [draft.propertyId],
  );
  const selectedSeller =
    sellerOptions.find((o) => o.value === draft.sellerContactId) ?? null;

  function selectProperty(option: PropertyOption | null) {
    onChange("propertyId", option?.value ?? "");
    onChange("address", option?.label ?? "");
    if (option) {
      const p = getProperty(option.value);
      if (p) onChange("propertyType", p.propertyType);
      // Re-resolve the seller for the new property: auto-pick a lone owner, else clear.
      const owners = getOwnersForProperty(option.value);
      onChange("sellerContactId", owners.length === 1 ? owners[0].id : "");
    } else {
      onChange("sellerContactId", "");
    }
  }

  function selectSeller(option: ContactOption | null) {
    onChange("sellerContactId", option?.value ?? "");
  }

  return (
    <div className="row g-3">
      <div className="col-12">
        <label className="form-label">Property</label>
        <Combobox
          items={propertyOptions}
          value={selectedOption}
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
        <label className="form-label">Seller</label>
        <Combobox
          items={sellerOptions}
          value={selectedSeller}
          onValueChange={(v) => selectSeller(v as ContactOption | null)}
        >
          <Combobox.InputGroup>
            <InputGroup.Addon>
              <FontAwesomeIcon icon={faUser} />
            </InputGroup.Addon>
            <Combobox.Input placeholder="Search contacts…" showClear />
          </Combobox.InputGroup>
          <Combobox.Content>
            <Combobox.Empty className="p-3 text-muted">
              No matching contacts
            </Combobox.Empty>
            <Combobox.List>
              {(item: ContactOption) => (
                <Combobox.Item key={item.value} value={item}>
                  {item.label}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Content>
        </Combobox>
      </div>

      <div className="col-12">
        <label className="form-label">Deal name</label>
        <Input
          placeholder={draft.address || "Defaults to the address"}
          value={draft.name}
          onValueChange={(v: string) => onChange("name", v)}
        />
      </div>

      <div className="col-4">
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
      <div className="col-4">
        <label className="form-label">Asking price</label>
        <Input
          inputMode="numeric"
          placeholder="$"
          value={draft.listingPrice ? String(draft.listingPrice) : ""}
          onValueChange={(v: string) => onChange("listingPrice", num(v))}
        />
      </div>
      <div className="col-4">
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
        <label className="form-label">Description</label>
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
