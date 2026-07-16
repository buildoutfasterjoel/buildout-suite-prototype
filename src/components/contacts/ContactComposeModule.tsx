import { useState, type ReactNode } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Calendar } from "@buildoutinc/blueprint-react/ui/Calendar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faNoteSticky,
  faPhone,
  faEnvelope,
  faCalendar,
  faBinoculars,
  faHashtag,
  faCaretDown,
  faHandshake,
  faCheck,
  faPaperclip,
  faPaperPlane,
  faBold,
  faItalic,
  faUnderline,
  faListUl,
  faListOl,
  faAlignLeft,
  faSparkle,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, DealSummary } from "#/data/types";
import type { ComposeKind, ComposedActivity } from "#/components/contacts/contactDisplay";
import {
  contactFullName,
  contactInitials,
} from "#/components/contacts/contactDisplay";

/** The payload emitted on submit — the panel stamps `id`/`seq`. */
export type ComposedDraft = Omit<ComposedActivity, "id" | "seq">;

const TABS: { key: ComposeKind; label: string; icon: typeof faPhone }[] = [
  { key: "note", label: "Note", icon: faNoteSticky },
  { key: "call", label: "Call", icon: faPhone },
  { key: "email", label: "Email", icon: faEnvelope },
  { key: "meeting", label: "Meeting", icon: faCalendar },
  { key: "tour", label: "Tour", icon: faBinoculars },
];

const CTA_LABEL: Record<ComposeKind, string> = {
  note: "Log Note",
  call: "Log Call",
  email: "Send Email",
  meeting: "Log Meeting Note",
  tour: "Log Tour Notes",
};

const PLACEHOLDER: Record<ComposeKind, (name: string) => string> = {
  note: (n) => `Log a note about ${n}...`,
  call: (n) => `What did you and ${n} discuss?`,
  email: () => "Write your email message here...",
  meeting: (n) => `Describe how your meeting with ${n} went...`,
  tour: (n) => `Describe how your tour with ${n} went...`,
};

// Kinds that reveal a date button next to the primary CTA (email is "now").
const DATED: ComposeKind[] = ["note", "call", "meeting", "tour"];
// Kinds that offer a "related deal" select in the footer.
const WITH_DEAL: ComposeKind[] = ["call", "meeting", "tour"];

const CALL_OUTCOMES = ["Connected", "No Answer", "Left Voicemail", "Bad Number"];

const EMPTY: Record<ComposeKind, string> = {
  note: "",
  call: "",
  email: "",
  meeting: "",
  tour: "",
};

/** Local `yyyy-mm-dd` for today. */
function todayISO(): string {
  return toISODate(new Date());
}

/** Serialize a Date to local `yyyy-mm-dd` (no timezone drift). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse `yyyy-mm-dd` as local midnight so the picker shows the right day. */
function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

/** An AI ghost button (sparkle) pinned to the top-right of a textarea. */
function SparkleButton() {
  return (
    <button
      type="button"
      className="compose-sparkle"
      aria-label="Draft with AI"
      onClick={(e) => e.preventDefault()}
    >
      <FontAwesomeIcon icon={faSparkle} />
    </button>
  );
}

/**
 * The editable activity date shown once a draft has content. Reads as clickable
 * and opens a single-date Calendar popover.
 */
function DateButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseLocalDate(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <Button variant="ghost" size="sm" className="compose-date-btn">
            <FontAwesomeIcon icon={faCalendar} className="compose-date-btn__icon" />
            {selected.toLocaleDateString("en-US")}
          </Button>
        }
      />
      <Popover.Content className="p-0" align="end">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) onChange(toISODate(d));
            setOpen(false);
          }}
        />
      </Popover.Content>
    </Popover>
  );
}

/** The "Select a related Deal" footer control. */
function RelatedDealSelect({
  deals,
  value,
  onChange,
}: {
  deals: DealSummary[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <Select.Trigger className="compose-deal-select" aria-label="Related deal">
        <FontAwesomeIcon icon={faHandshake} className="text-muted" />
        <Select.Value placeholder="Select a related Deal" />
      </Select.Trigger>
      <Select.Content>
        {deals.length === 0 ? (
          <Select.Item value="" disabled>
            No related deals
          </Select.Item>
        ) : (
          deals.map((d) => (
            <Select.Item key={d.id} value={d.name}>
              {d.name}
            </Select.Item>
          ))
        )}
      </Select.Content>
    </Select>
  );
}

export function ContactComposeModule({
  contact,
  deals,
  onSubmit,
  onStartCall,
}: {
  contact: Contact;
  deals: DealSummary[];
  onSubmit: (draft: ComposedDraft) => void;
  /** Kicks off the simulated live call (Call tab's "Call Now"). */
  onStartCall: () => void;
}) {
  const [tab, setTab] = useState<ComposeKind>("note");
  const [body, setBody] = useState<Record<ComposeKind, string>>({ ...EMPTY });
  const [dates, setDates] = useState<Record<ComposeKind, string>>(() => {
    const t = todayISO();
    return { note: t, call: t, email: t, meeting: t, tour: t };
  });
  const [relatedDeal, setRelatedDeal] = useState<Record<ComposeKind, string>>({
    ...EMPTY,
  });
  const [subject, setSubject] = useState("");
  const [outcome, setOutcome] = useState("Connected");
  // Reset the outcome only lazily; keep it simple with a stable default.
  const composeName = contact.firstName;

  // A draft "has value" (flip secondary → primary) when its body has content —
  // or, for email, when either the subject or the message body is filled.
  const hasValue =
    body[tab].trim() !== "" ||
    (tab === "email" && subject.trim() !== "");

  function setTabBody(kind: ComposeKind, v: string) {
    setBody((b) => ({ ...b, [kind]: v }));
  }

  function handleSubmit() {
    if (!hasValue) return;
    onSubmit({
      kind: tab,
      body: body[tab].trim(),
      date: tab === "email" ? todayISO() : dates[tab],
      outcome: tab === "call" ? outcome : undefined,
      subject: tab === "email" ? subject.trim() : undefined,
      to: tab === "email" ? contact.email : undefined,
      relatedDeal: WITH_DEAL.includes(tab)
        ? relatedDeal[tab] || undefined
        : undefined,
    });
    // Reset the just-submitted tab back to a clean slate.
    setTabBody(tab, "");
    if (tab === "email") setSubject("");
    if (tab === "call") setOutcome("Connected");
    setDates((d) => ({ ...d, [tab]: todayISO() }));
    setRelatedDeal((r) => ({ ...r, [tab]: "" }));
  }

  // The submit row shared by every tab except email (email supplies its own).
  // A plain function (reconciled by position) rather than an inline component,
  // so it never remounts the date-picker mid-interaction.
  function ctaRow(leading: ReactNode) {
    return (
      <div className="d-flex align-items-center justify-content-between gap-2 w-100">
        <div className="d-flex align-items-center gap-2 flex-grow-1 min-w-0">
          {leading}
        </div>
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          {hasValue && DATED.includes(tab) && (
            <DateButton
              value={dates[tab]}
              onChange={(v) => setDates((d) => ({ ...d, [tab]: v }))}
            />
          )}
          <Button
            variant={hasValue ? "primary" : "secondary"}
            onClick={handleSubmit}
          >
            {CTA_LABEL[tab]}
          </Button>
        </div>
      </div>
    );
  }

  function renderBody() {
    if (tab === "email") return renderEmail();

    const withDeal = WITH_DEAL.includes(tab);
    return (
      <div className="d-flex flex-column gap-4 p-4">
        <div className="compose-textarea">
          <Textarea
            value={body[tab]}
            onChange={(e) => setTabBody(tab, e.target.value)}
            placeholder={PLACEHOLDER[tab](composeName)}
            rows={tab === "call" ? 5 : 3}
          />
          <SparkleButton />
        </div>

        {tab === "call" && (
          <div className="d-flex flex-wrap gap-2">
            {CALL_OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                className={`compose-outcome-chip ${
                  outcome === o ? "is-active" : ""
                }`}
                onClick={() => setOutcome(o)}
              >
                {outcome === o && <FontAwesomeIcon icon={faCheck} />}
                {o}
              </button>
            ))}
          </div>
        )}

        {ctaRow(
          withDeal ? (
            <RelatedDealSelect
              deals={deals}
              value={relatedDeal[tab]}
              onChange={(v) => setRelatedDeal((r) => ({ ...r, [tab]: v }))}
            />
          ) : (
            <span className="text-muted fs-small">
              Private to you and anyone you're sharing with
            </span>
          ),
        )}
      </div>
    );
  }

  function renderCallHeader() {
    // "Calling" phone field + Call Now (primary until a log draft is started).
    return (
      <div className="compose-call-header">
        <div className="d-flex align-items-center gap-3">
          <div className="flex-grow-1">
            <InputGroup>
              <InputGroup.Addon>
                <FontAwesomeIcon icon={faHashtag} />
              </InputGroup.Addon>
              <Input readOnly value={contact.phone} aria-label="Phone number" />
              <InputGroup.Addon>
                <FontAwesomeIcon icon={faCaretDown} />
              </InputGroup.Addon>
            </InputGroup>
          </div>
          <Button
            variant={hasValue ? "secondary" : "primary"}
            onClick={onStartCall}
          >
            <FontAwesomeIcon icon={faPhone} />
            Call Now
          </Button>
        </div>
        <div className="compose-divider">
          <span className="compose-divider__line" />
          <span className="compose-divider__label">Already Called?</span>
          <span className="compose-divider__line" />
        </div>
      </div>
    );
  }

  function renderEmail() {
    return (
      <div className="d-flex flex-column">
        {/* To */}
        <div className="compose-email-row justify-content-between">
          <div className="d-flex align-items-center gap-3 min-w-0">
            <span className="text-muted flex-shrink-0">To:</span>
            <span className="compose-email-chip">
              <span className="compose-email-chip__avatar">
                {contactInitials(contact)}
              </span>
              <span className="fw-semibold">{contactFullName(contact)}</span>
              <span className="text-muted fs-small text-truncate">
                &lt;{contact.email}&gt;
              </span>
              <FontAwesomeIcon icon={faCaretDown} className="fs-small" />
            </span>
          </div>
          <div className="d-flex align-items-center gap-3 flex-shrink-0">
            <button type="button" className="compose-email-link">
              CC
            </button>
            <button type="button" className="compose-email-link">
              BCC
            </button>
          </div>
        </div>
        {/* From */}
        <div className="compose-email-row gap-3">
          <span className="text-muted">From:</span>
          <span className="fw-semibold">demo@buildout.com</span>
        </div>
        {/* Subject */}
        <div className="compose-email-row gap-3">
          <span className="text-muted flex-shrink-0">Subject:</span>
          <input
            className="compose-subject-input"
            placeholder="Enter subject here..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="d-flex flex-column gap-4 p-4">
          <div>
            <div className="compose-toolbar">
              {[faBold, faItalic, faUnderline, faListUl, faListOl, faAlignLeft].map(
                (icon, i) => (
                  <button
                    key={i}
                    type="button"
                    className="compose-toolbar__btn"
                    onClick={(e) => e.preventDefault()}
                  >
                    <FontAwesomeIcon icon={icon} />
                  </button>
                ),
              )}
            </div>
            <div className="compose-textarea">
              <Textarea
                value={body.email}
                onChange={(e) => setTabBody("email", e.target.value)}
                placeholder={PLACEHOLDER.email(composeName)}
                rows={5}
              />
              <SparkleButton />
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-between gap-2">
            <button type="button" className="compose-attach-btn">
              <FontAwesomeIcon icon={faPaperclip} />
              Attachments
            </button>
            <Button
              variant={hasValue ? "primary" : "secondary"}
              onClick={handleSubmit}
            >
              {CTA_LABEL.email}
              <FontAwesomeIcon icon={faPaperPlane} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="shadow-sm overflow-hidden compose-module">
      <div className="compose-tabs">
        <Tabs value={tab} onValueChange={(v) => v && setTab(v as ComposeKind)}>
          <Tabs.List>
            {TABS.map((t) => (
              <Tabs.Tab
                key={t.key}
                value={t.key}
                icon={<FontAwesomeIcon icon={t.icon} />}
              >
                {t.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      </div>

      {tab === "call" && renderCallHeader()}
      {renderBody()}
    </Card>
  );
}
