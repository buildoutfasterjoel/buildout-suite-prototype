import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
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
  faCaretDown,
  faPaperclip,
  faPaperPlane,
  faBold,
  faItalic,
  faUnderline,
  faListUl,
  faListOl,
  faAlignLeft,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, DealSummary } from "#/data/types";
import type { ComposeKind, ComposedActivity } from "#/components/contacts/contactDisplay";
import {
  contactFullName,
  contactInitials,
} from "#/components/contacts/contactDisplay";
import {
  OutcomeChips,
  RelatedDealSelect,
  SparkleButton,
} from "#/components/contacts/callLogFields";
import { useComposeFocus } from "#/components/contacts/useComposeFocus";
import { useAssistant } from "#/ai/useAssistant";
import { activityFieldAsk, fieldAskLabel } from "#/ai/fieldAsk";
import { registerComposerSend, setPendingEmail } from "#/components/contacts/composerSend";

/** The payload emitted on submit — the panel stamps `id`/`seq`. */
// `createdAt` is stamped centrally by the page's `addLog`, not by composers.
export type ComposedDraft = Omit<ComposedActivity, "id" | "seq" | "createdAt">;

const TABS: { key: ComposeKind; label: string; icon: typeof faPhone }[] = [
  { key: "note", label: "Note", icon: faNoteSticky },
  { key: "call", label: "Call", icon: faPhone },
  { key: "email", label: "Email", icon: faEnvelope },
  { key: "meeting", label: "Meeting", icon: faCalendar },
  { key: "tour", label: "Tour", icon: faBinoculars },
];

/** Hover tooltip per compose tab — the action each icon performs. */
const TAB_TOOLTIP: Record<ComposeKind, string> = {
  note: "Log Notes",
  call: "Log and Make Calls",
  email: "Send Emails",
  meeting: "Log Meetings",
  tour: "Log Tours",
};

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

const EMPTY: Record<ComposeKind, string> = {
  note: "",
  call: "",
  email: "",
  meeting: "",
  tour: "",
};

/**
 * Auto-grow ceiling, roughly 25 lines. Past that the field scrolls rather than
 * growing: a note long enough to need more has already pushed the timeline —
 * the thing the broker is writing *about* — off the bottom of the screen.
 */
const MAX_BODY_HEIGHT = 480;

/**
 * Grow the message field to fit its value, so a staged note can be read in one
 * pass instead of through a three-line window.
 *
 * Never shrinks below the tab's own `rows`, and an empty value drops the inline
 * height entirely so `rows` governs again — which is what returns the field to
 * its default size the moment the note is logged.
 */
function autosize(el: HTMLTextAreaElement | null, value: string) {
  if (!el) return;
  if (!value) {
    el.style.height = "";
    return;
  }
  // Measure the resting height first: it differs per tab (Call asks for 5 rows,
  // the rest for 3), and the same element is reused across all of them.
  el.style.height = "";
  const base = el.offsetHeight;
  el.style.height = "auto";
  // `scrollHeight` covers content + padding but not border, while `offsetHeight`
  // includes it — so a field sized to scrollHeight alone loses its border and
  // scrolls by 2px forever.
  const border = el.offsetHeight - el.clientHeight;
  const fit = el.scrollHeight + border;
  el.style.height = `${Math.min(Math.max(fit, base), MAX_BODY_HEIGHT)}px`;
}

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

export function ContactComposeModule({
  contact,
  deals,
  onSubmit,
  onStartCall,
  headerStart,
}: {
  contact: Contact;
  deals: DealSummary[];
  onSubmit: (draft: ComposedDraft) => void;
  /** Kicks off the simulated live call to the chosen number (Call tab's "Call Now"). */
  onStartCall: (phone: string) => void;
  /** Rendered at the start of the tab row — e.g. the "Activity" section title. */
  headerStart?: ReactNode;
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

  // An outside request to compose — e.g. clicking an email address in the
  // contact hero — switches tabs and puts the cursor in the message field, so
  // the broker lands ready to type. Keyed on the request counter, not the kind,
  // so clicking the same address twice re-focuses.
  const focusSeq = useComposeFocus((s) => s.seq);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [pendingFocus, setPendingFocus] = useState<ComposeKind | null>(null);
  useEffect(() => {
    if (focusSeq === 0) return;
    const { kind, draft } = useComposeFocus.getState();
    if (!kind) return;
    setTab(kind);
    setPendingFocus(kind);
    // An AI draft rides along on the same signal. Guarded on the contact so a
    // draft written for one person can't land in another's composer — the store
    // is module-level and outlives navigation between contacts.
    //
    // Applied on every request, which is what makes revision work: asking the
    // assistant to shorten the email raises a new draft, and the composer's
    // fields follow. It does overwrite hand edits, but that's the instruction —
    // the broker asked for a rewrite.
    if (draft && draft.contactId === contact.id) {
      setSubject(draft.subject);
      setBody((b) => ({ ...b, email: draft.body }));
    }
    // A value staged by `stage_field_value`, for whichever tab it belongs to.
    // Same overwrite semantics for the same reason: a revision is an
    // instruction to replace what's there, and the broker asked for it.
    const { activityDraft } = useComposeFocus.getState();
    if (activityDraft && activityDraft.contactId === contact.id) {
      setBody((b) => ({ ...b, [activityDraft.kind]: activityDraft.body }));
      // Absent means "leave the subject alone" — a body revision must not wipe
      // a subject line the broker wrote themselves.
      if (activityDraft.subject !== undefined) setSubject(activityDraft.subject);
      readFromTopRef.current = true;
    }
  }, [focusSeq, contact.id]);
  // Publish this composer's send so the assistant can hit it on an explicit
  // "send it" (see `composerSend.ts`). Registered every render because the
  // closure has to see the current subject/body — the whole point is that the
  // assistant sends what the broker is looking at, hand edits and all.
  useEffect(() => {
    registerComposerSend(() => {
      if (tab !== "email") {
        return { sent: false, reason: "The composer isn't on the Email tab." };
      }
      if (!subject.trim() && !body.email.trim()) {
        return { sent: false, reason: "The email draft is empty." };
      }
      const sent = {
        sent: true as const,
        subject: subject.trim(),
        to: contact.email,
        contactId: contact.id,
        contactName: contactFullName(contact),
        body: body.email,
      };
      handleSubmit();
      return sent;
    });
    return () => registerComposerSend(null);
  });

  // Deliberately a second pass: the requested tab's textarea doesn't exist until
  // the tab switch above commits, so focusing in that same effect would land on
  // whichever tab was open before. Waiting for `tab` to match is what makes the
  // ref point at the right field.
  useEffect(() => {
    if (!pendingFocus || pendingFocus !== tab) return;
    setPendingFocus(null);
    bodyRef.current?.focus();
  }, [pendingFocus, tab]);

  /**
   * Which of this contact's activity fields the rail is holding, or null. Two
   * jobs: it tints that field so the broker can see what the assistant is
   * scoped to, and its value is what the model reads to know what it is
   * revising.
   *
   * Pinned to one TAB rather than to the composer, because the five tabs are
   * five fields — carrying the tint across a tab switch would claim Otto was
   * holding a field it has never been handed.
   */
  const fieldAsk = useAssistant((s) => s.fieldAsk);
  const pinnedKind =
    fieldAsk?.target.kind === "contact-activity" && fieldAsk.target.contactId === contact.id
      ? fieldAsk.target.activity
      : null;

  // Keep the pinned value following the broker's own edits. Without this, text
  // typed after the sparkle was clicked is invisible to the assistant, and
  // "shorten it" shortens the version from the moment of the click.
  const pinnedValue = pinnedKind ? body[pinnedKind] : "";
  useEffect(() => {
    if (!pinnedKind) return;
    useAssistant.getState().updateFieldAskValue(pinnedValue.trim());
  }, [pinnedKind, pinnedValue]);

  /**
   * A value that arrived from the assistant rather than from typing, and so
   * should be read from the first word.
   *
   * Handing the composer text focuses it, and focusing a textarea whose caret
   * sits at the end scrolls that end into view — so a note long enough to hit
   * the cap opened on its last paragraph, with the beginning above the fold of
   * a field the broker had never scrolled.
   */
  const readFromTopRef = useRef(false);

  // Fit the field to its value. Runs on `tab` as well as the value because the
  // same textarea serves every tab: switching from a long note to an empty call
  // log has to bring the height back with it.
  //
  // After the focus effect above, deliberately: it is the focus that moves the
  // caret, so the reset has to come once the field is both sized and focused.
  useEffect(() => {
    const el = bodyRef.current;
    autosize(el, body[tab]);
    if (el && readFromTopRef.current) {
      readFromTopRef.current = false;
      el.setSelectionRange(0, 0);
      el.scrollTop = 0;
    }
  }, [body, tab]);

  // A contact can carry more than one number; the dropdown only appears when
  // there's a choice to make. With a single number we fold it into the button.
  // `contact.phone` is the primary and leads the list, followed by any extras.
  // De-duplicate: the same number must never appear twice (it would render two
  // "selected" rows in the Select and collide on the value key).
  const phones = [
    ...new Set([contact.phone, ...(contact.phones ?? [])].filter(Boolean)),
  ];
  const [selectedPhone, setSelectedPhone] = useState(phones[0]);
  const multiplePhones = phones.length > 1;
  // Self-heal if the selected number was edited away (e.g. the primary changed):
  // fall back to the current primary so we never call a number that's gone.
  const activePhone = phones.includes(selectedPhone) ? selectedPhone : phones[0];

  // A draft "has value" (flip secondary → primary) when its body has content —
  // or, for email, when either the subject or the message body is filled.
  const hasValue =
    body[tab].trim() !== "" ||
    (tab === "email" && subject.trim() !== "");

  /**
   * A field's sparkle: hand it to Otto (§"Ask at the rail, review at the
   * field"). The rail opens with that field pinned as a context chip, and
   * either asks what it should say or offers the revise presets —
   * `activityFieldAsk` decides which from the current value.
   *
   * Takes the kind rather than reading `tab`, so the email tab's own sparkle
   * cannot pin the wrong field if the two ever drift apart.
   */
  function askOttoAbout(kind: ComposeKind) {
    useAssistant.getState().askAtField(
      activityFieldAsk({
        activity: kind,
        contactId: contact.id,
        fullName: contactFullName(contact),
        firstName: contact.firstName,
        // An email's value is its message body; the subject rides alongside as
        // something Otto may set, not as the field being revised.
        value: body[kind],
      }),
    );
  }

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
      relatedDeal: relatedDeal[tab] || undefined,
    });
    // Reset the just-submitted tab back to a clean slate.
    setTabBody(tab, "");
    // The note is on the record, so the field the chip was scoped to no longer
    // holds anything — and a chip still reading "Earl Pettigrew: Note" over an
    // empty box would scope the next question to a draft that has been filed.
    // Logging is the end of that conversation.
    if (pinnedKind === tab) useAssistant.getState().clearFieldAsk();
    if (tab === "email") {
      setSubject("");
      // Whatever the assistant was holding as sendable has now gone out by hand;
      // clearing it stops a later "send it" from posting the same email twice.
      setPendingEmail(null);
    }
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
          {/* Secondary until the draft has something in it — an empty composer
              has nothing to submit, so a primary button there is an invitation
              to click a no-op. Same treatment the Call tab already used. */}
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

    return (
      <div className="d-flex flex-column gap-4 p-4">
        {tab === "call" && renderCallControls()}

        {/* Tinted while the assistant holds this field (Figma node 1483:172765):
            the chip in the rail says *what* Otto is scoped to, and this says it
            again where the broker's eyes already are. Only the Note tab — the
            pin is on the note, and carrying the tint across a tab switch would
            claim Otto was holding a field it has never been handed. */}
        <div className={`compose-textarea${pinnedKind === tab ? " compose-textarea--ai" : ""}`}>
          <Textarea
            ref={bodyRef}
            value={body[tab]}
            onChange={(e) => setTabBody(tab, e.target.value)}
            placeholder={PLACEHOLDER[tab](composeName)}
            rows={tab === "call" ? 5 : 3}
          />
          <SparkleButton
            label={fieldAskLabel(tab, hasValue)}
            onClick={() => askOttoAbout(tab)}
          />
        </div>

        {tab === "call" && (
          <OutcomeChips value={outcome} onChange={setOutcome} />
        )}

        {/* Every kind of activity can belong to a deal, so the selector leads
            the footer on all of them — on Note it takes the slot the "private
            to you" helper used to hold. */}
        {ctaRow(
          <RelatedDealSelect
            deals={deals}
            value={relatedDeal[tab]}
            onChange={(v) => setRelatedDeal((r) => ({ ...r, [tab]: v }))}
          />,
        )}
      </div>
    );
  }

  function renderCallControls() {
    // Full-width, stacked: the phone picker (only when there's a choice) and the
    // call button, followed by the "Already Called?" divider that leads into the
    // log fields below. Call button is primary until a log draft is started.
    return (
      <div className="d-flex flex-column gap-3 align-items-stretch">
        {multiplePhones && (
          <Select
            value={activePhone}
            onValueChange={(v) => v && setSelectedPhone(v)}
          >
            <Select.Trigger className="w-100" aria-label="Phone number">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {phones.map((p) => (
                <Select.Item key={p} value={p}>
                  {p}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        )}
        <Button
          variant={hasValue ? "secondary" : "primary"}
          onClick={() => onStartCall(activePhone)}
          className="w-100 justify-content-center"
        >
          <FontAwesomeIcon icon={faPhone} />
          Call {activePhone}
        </Button>
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
            <div
              className={`compose-textarea${
                pinnedKind === "email" ? " compose-textarea--ai" : ""
              }`}
            >
              <Textarea
                ref={bodyRef}
                value={body.email}
                onChange={(e) => setTabBody("email", e.target.value)}
                placeholder={PLACEHOLDER.email(composeName)}
                rows={5}
              />
              <SparkleButton
                label={fieldAskLabel("email", hasValue)}
                onClick={() => askOttoAbout("email")}
              />
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-between gap-2">
            <div className="d-flex align-items-center gap-2 min-w-0">
              <RelatedDealSelect
                deals={deals}
                value={relatedDeal.email}
                onChange={(v) => setRelatedDeal((r) => ({ ...r, email: v }))}
              />
              <button type="button" className="compose-attach-btn">
                <FontAwesomeIcon icon={faPaperclip} />
                Attachments
              </button>
            </div>
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
    <div className="compose-module">
      <div className="compose-header">
        {headerStart}
        <div className="compose-tabs">
          <Tooltip.Provider delay={150}>
            <Tabs value={tab} onValueChange={(v) => v && setTab(v as ComposeKind)}>
              <Tabs.List variant="pills">
                {TABS.map((t) => (
                  <Tooltip key={t.key}>
                    <Tooltip.Trigger
                      render={
                        <Tabs.Tab
                          value={t.key}
                          aria-label={TAB_TOOLTIP[t.key]}
                          icon={<FontAwesomeIcon icon={t.icon} />}
                        >
                          {t.label}
                        </Tabs.Tab>
                      }
                    />
                    <Tooltip.Content>{TAB_TOOLTIP[t.key]}</Tooltip.Content>
                  </Tooltip>
                ))}
              </Tabs.List>
            </Tabs>
          </Tooltip.Provider>
        </div>
      </div>

      {renderBody()}
    </div>
  );
}
