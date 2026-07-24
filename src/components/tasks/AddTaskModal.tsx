import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Calendar } from "@buildoutinc/blueprint-react/ui/Calendar";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpFromBracket,
  faCalendar,
  faCirclePlus,
  faHandshake,
  faTrashCan,
  faUser,
  faXmark,
} from "@fortawesome/pro-regular-svg-icons";
import { CURRENT_USER, TEAMMATES, type Teammate } from "#/data/teammates";
import {
  getContactOptions,
  getContactShares,
  getDealOptions,
} from "#/data/store";
import type { Task } from "#/data/types";

/** The payload emitted on Save — a plain snapshot of the form. */
export interface NewTaskDraft {
  name: string;
  assigneeId: string;
  dueDate: Date | null;
  type: string | null;
  source: string;
  /** Linked contact — set when source is "contact". */
  contactId: string | null;
  /** Linked deal — set when source is "deal". */
  dealId: string | null;
  notes: string;
  reminders: Date[];
  followUpDate: Date | null;
  requireAttachments: boolean;
}

/** "none" is the default — a task doesn't have to be typed. */
const TASK_TYPES = [
  { value: "none", label: "None" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "to-do", label: "To-Do" },
  { value: "follow-up", label: "Follow-Up" },
  { value: "showing", label: "Showing" },
];

const TASK_SOURCES = [
  { value: "contact", label: "Contact" },
  { value: "deal", label: "Deal" },
];

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** Full spelled-out date shown above the due-date quick picks. */
const fmtDateLong = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

/** Quick due-date choices, as day offsets from today. The 8th slot is Custom. */
const DUE_QUICK_PICKS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "2 Days", days: 2 },
  { label: "3 Days", days: 3 },
  { label: "1 Week", days: 7 },
  { label: "2 Weeks", days: 14 },
  { label: "3 Weeks", days: 21 },
];

const addDays = (base: Date, n: number) =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Parse a stored ISO `YYYY-MM-DD` into a local Date (no UTC shift), or null. */
const parseISO = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

/**
 * A date picker field: the entire field (icon + input) is the popover trigger,
 * so clicking anywhere in it opens the calendar; picking a date closes it. Kept
 * local so every date in the form (due date, reminders, follow-up) is consistent.
 */
function DateField({
  value,
  onChange,
  placeholder = "Select a date",
}: {
  value: Date | null;
  onChange: (d: Date | undefined) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        nativeButton={false}
        render={
          <InputGroup role="button" style={{ cursor: "pointer" }}>
            <InputGroup.Addon>
              <FontAwesomeIcon icon={faCalendar} />
            </InputGroup.Addon>
            {/* pointer-events: none so clicks fall through to the trigger group */}
            <Input
              readOnly
              tabIndex={-1}
              placeholder={placeholder}
              value={value ? fmtDate(value) : ""}
              style={{ cursor: "pointer", pointerEvents: "none", backgroundColor: "transparent" }}
            />
          </InputGroup>
        }
      />
      <Popover.Content className="p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
      </Popover.Content>
    </Popover>
  );
}

/**
 * Due date as a set of quick-pick buttons (today through 3 weeks out) plus a
 * Custom option that opens a calendar. Clicking the active pick again clears
 * the date. A date that matches no preset (edited tasks, calendar picks)
 * lights up Custom.
 */
function DueDateQuickPick({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (d: Date | null) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const today = new Date();
  const presetDates = DUE_QUICK_PICKS.map((p) => addDays(today, p.days));
  const activePreset = value
    ? presetDates.findIndex((d) => sameDay(d, value))
    : -1;
  const customActive = value != null && activePreset === -1;

  return (
    <div className="d-flex flex-column gap-2">
      <div className="text-center fw-semibold">
        {value ? fmtDateLong(value) : <span className="text-muted fw-normal">No due date</span>}
      </div>
      <div className="row g-2">
        {DUE_QUICK_PICKS.map((p, i) => (
          <div key={p.label} className="col-3">
            <Button
              variant={activePreset === i ? "primary" : "outline"}
              size="sm"
              className="w-100"
              onClick={() =>
                onChange(activePreset === i ? null : presetDates[i])
              }
            >
              {p.label}
            </Button>
          </div>
        ))}
        <div className="col-3">
          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <Popover.Trigger
              render={
                <Button
                  variant={customActive ? "primary" : "outline"}
                  size="sm"
                  className="w-100"
                />
              }
            >
              Custom
            </Popover.Trigger>
            <Popover.Content className="p-0" align="end">
              <Calendar
                mode="single"
                selected={value ?? undefined}
                onSelect={(d) => {
                  onChange(d ?? null);
                  setCustomOpen(false);
                }}
              />
            </Popover.Content>
          </Popover>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a Select trigger's display. We resolve the label ourselves rather than
 * relying on `Select.Value`, which falls back to the raw value string when the
 * dropdown hasn't been opened yet (our values differ from their labels).
 */
function SelectDisplay({
  icon,
  label,
  placeholder,
}: {
  icon?: typeof faUser;
  label?: string | null;
  placeholder: string;
}) {
  return (
    <span className="d-flex align-items-center gap-2 text-truncate">
      {icon && <FontAwesomeIcon icon={icon} className="text-muted" />}
      <span className={label ? "" : "text-muted"}>{label || placeholder}</span>
    </span>
  );
}

/**
 * A field label that does NOT associate (htmlFor) with its control, so clicking
 * it can't open the adjacent Select/Combobox. `nativeLabel={false}` keeps the
 * styled label but drops the native for-association.
 */
function PlainLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Field.Label nativeLabel={false} render={<span />} className={className}>
      {children}
    </Field.Label>
  );
}

/**
 * A searchable single-select lookup over {value,label} options. Combobox is
 * string-keyed (its value is the item text), so we map the picked label back to
 * its id on change and resolve the current id to its label for display.
 */
function LookupField({
  options,
  value,
  onChange,
  icon,
  placeholder,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
  icon: typeof faUser;
  placeholder: string;
}) {
  const items = useMemo(
    () => [...new Set(options.map((o) => o.label))],
    [options],
  );
  const idByLabel = useMemo(
    () => new Map(options.map((o) => [o.label, o.value])),
    [options],
  );
  const labelById = useMemo(
    () => new Map(options.map((o) => [o.value, o.label])),
    [options],
  );
  return (
    <Combobox
      items={items}
      value={value ? labelById.get(value) ?? null : null}
      onValueChange={(v) =>
        onChange(v ? idByLabel.get(v as string) ?? null : null)
      }
    >
      <Combobox.InputGroup>
        <InputGroup.Addon>
          <FontAwesomeIcon icon={icon} className="text-muted" />
        </InputGroup.Addon>
        <Combobox.Input placeholder={placeholder} showTrigger showClear />
      </Combobox.InputGroup>
      <Combobox.Content>
        <Combobox.Empty className="text-muted p-2">No matches</Combobox.Empty>
        <Combobox.List>
          {(item: string) => (
            <Combobox.Item key={item} value={item}>
              {item}
            </Combobox.Item>
          )}
        </Combobox.List>
      </Combobox.Content>
    </Combobox>
  );
}

export function AddTaskModal({
  open,
  onOpenChange,
  defaultContactId = null,
  task = null,
  onSave,
  onUpdate,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a contact (e.g. when opened from a contact's Tasks panel). */
  defaultContactId?: string | null;
  /** When set, the modal is in edit mode: fields prefill from this task. */
  task?: Task | null;
  onSave?: (draft: NewTaskDraft) => void;
  onUpdate?: (draft: NewTaskDraft) => void;
  onDelete?: () => void;
}) {
  const isEdit = task != null;
  const contactOptions = useMemo(() => getContactOptions(), []);
  const dealOptions = useMemo(() => getDealOptions(), []);

  const [name, setName] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>(CURRENT_USER.id);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [type, setType] = useState<string>("none");
  const [source, setSource] = useState<string>("contact");
  const [contactId, setContactId] = useState<string | null>(defaultContactId);
  const [dealId, setDealId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [reminders, setReminders] = useState<Array<Date | null>>([]);
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | null>(null);
  const [requireAttachments, setRequireAttachments] = useState(false);

  // Assignees are scoped to whoever has access to the linked contact — the
  // owner plus anyone it's shared with. Deal-sourced or unlinked tasks fall
  // back to the full roster.
  const assignees = useMemo<Teammate[]>(() => {
    if (source === "contact" && contactId) {
      const seen = new Set<string>();
      const roster: Teammate[] = [];
      for (const m of [
        CURRENT_USER,
        ...getContactShares(contactId).map((s) => s.member),
      ]) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          roster.push(m);
        }
      }
      return roster;
    }
    return [CURRENT_USER, ...TEAMMATES];
  }, [source, contactId]);
  // An owner-only contact has exactly one possible assignee — lock the field.
  const assigneeLocked =
    source === "contact" && contactId != null && assignees.length === 1;

  // If the linked contact changes to one the picked assignee can't access,
  // fall back to the owner (always first in the roster).
  useEffect(() => {
    if (!assignees.some((m) => m.id === assigneeId)) {
      setAssigneeId(CURRENT_USER.id);
    }
  }, [assignees, assigneeId]);

  // The modal is mounted once globally, so its state survives across opens.
  // On each open, prefill from the task being edited, or reset to create
  // defaults with the pre-selected contact.
  useEffect(() => {
    if (!open) return;
    if (task) {
      setName(task.name);
      setAssigneeId(task.assigneeId);
      setDueDate(parseISO(task.dueDate));
      setType(task.type ?? "none");
      setSource(task.source);
      setContactId(task.contactId);
      setDealId(task.dealId);
      setNotes(task.notes);
      setReminders(task.reminders.map(parseISO));
      setCreateFollowUp(task.followUpDate != null);
      setFollowUpDate(parseISO(task.followUpDate));
      setRequireAttachments(task.requireAttachments);
    } else {
      setContactId(defaultContactId);
    }
    // Only re-run when the modal opens or the target task changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const canSave = name.trim().length > 0;

  const reset = () => {
    setName("");
    setAssigneeId(CURRENT_USER.id);
    setDueDate(null);
    setType("none");
    setSource("contact");
    setContactId(defaultContactId);
    setDealId(null);
    setNotes("");
    setReminders([]);
    setCreateFollowUp(false);
    setFollowUpDate(null);
    setRequireAttachments(false);
  };

  const close = () => onOpenChange(false);

  const handleSave = () => {
    if (!canSave) return;
    const draft: NewTaskDraft = {
      name: name.trim(),
      assigneeId,
      dueDate,
      // "none" is a UI default, not a real type.
      type: type === "none" ? null : type,
      source,
      // Only send the link that matches the chosen source.
      contactId: source === "contact" ? contactId : null,
      dealId: source === "deal" ? dealId : null,
      notes: notes.trim(),
      reminders: reminders.filter((r): r is Date => r != null),
      followUpDate: createFollowUp ? followUpDate : null,
      requireAttachments,
    };
    if (isEdit) onUpdate?.(draft);
    else onSave?.(draft);
    reset();
    close();
  };

  const handleDelete = () => {
    onDelete?.();
    reset();
    close();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <Modal.Content
        size="lg"
        scrollable
        centered
        style={{ maxWidth: "34.375rem" }}
      >
        <Modal.Header className="border-bottom" style={{ padding: "20px 24px" }}>
          <Modal.Title>{isEdit ? "Edit Task" : "Add Task"}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 24, maxHeight: 560 }}>
          <div className="d-flex flex-column gap-3">
            <Field>
              <PlainLabel>
                Title <span className="text-danger">*</span>
              </PlainLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Send follow-up proposal"
                autoFocus
              />
            </Field>

            {/* Source + Type */}
            <div className="row g-3">
              <div className="col-6">
                <Field>
                  <PlainLabel>Source</PlainLabel>
                  <Select value={source} onValueChange={(v) => v && setSource(v)}>
                    <Select.Trigger className="w-100">
                      <SelectDisplay
                        placeholder="Select..."
                        label={TASK_SOURCES.find((s) => s.value === source)?.label}
                      />
                    </Select.Trigger>
                    <Select.Content>
                      {TASK_SOURCES.map((s) => (
                        <Select.Item key={s.value} value={s.value}>
                          {s.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </Field>
              </div>
              <div className="col-6">
                <Field>
                  <PlainLabel>Type</PlainLabel>
                  <Select value={type} onValueChange={(v) => v && setType(v)}>
                    <Select.Trigger className="w-100">
                      <SelectDisplay
                        placeholder="Select..."
                        label={TASK_TYPES.find((t) => t.value === type)?.label}
                      />
                    </Select.Trigger>
                    <Select.Content>
                      {TASK_TYPES.map((t) => (
                        <Select.Item key={t.value} value={t.value}>
                          {t.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </Field>
              </div>
            </div>

            {/* Linked [Source] + Assigned To */}
            <div className="row g-3">
              <div className="col-6">
                <Field>
                  <PlainLabel>
                    {source === "deal" ? "Linked Deal" : "Linked Contact"}
                  </PlainLabel>
                  {source === "deal" ? (
                    <LookupField
                      options={dealOptions}
                      value={dealId}
                      onChange={setDealId}
                      icon={faHandshake}
                      placeholder="Search deals…"
                    />
                  ) : (
                    <LookupField
                      options={contactOptions}
                      value={contactId}
                      onChange={setContactId}
                      icon={faUser}
                      placeholder="Search contacts…"
                    />
                  )}
                </Field>
              </div>
              <div className="col-6">
                <Field>
                  <PlainLabel>Assigned To</PlainLabel>
                  <Select
                    value={assigneeId}
                    onValueChange={(v) => v && setAssigneeId(v)}
                    disabled={assigneeLocked}
                  >
                    <Select.Trigger className="w-100">
                      <SelectDisplay
                        icon={faUser}
                        placeholder="Select assignee"
                        label={
                          assignees.find((m) => m.id === assigneeId)
                            ? `${assignees.find((m) => m.id === assigneeId)!.name}${
                                assigneeId === CURRENT_USER.id ? " (you)" : ""
                              }`
                            : null
                        }
                      />
                    </Select.Trigger>
                    <Select.Content>
                      {assignees.map((m) => (
                        <Select.Item key={m.id} value={m.id}>
                          {m.name}
                          {m.id === CURRENT_USER.id ? " (you)" : ""}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </Field>
              </div>
            </div>

            {/* Due Date — quick picks + custom calendar */}
            <Field>
              <PlainLabel>Due Date</PlainLabel>
              <DueDateQuickPick value={dueDate} onChange={setDueDate} />
            </Field>

            <Field>
              <PlainLabel>Notes</PlainLabel>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any details…"
              />
            </Field>

            {/* Reminders */}
            <div>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="fw-semibold fs-large">Reminders</span>
                <Button
                  variant="ghost"
                  appearance="muted"
                  size="sm"
                  onClick={() => setReminders((r) => [...r, null])}
                >
                  <FontAwesomeIcon icon={faCirclePlus} className="text-primary" />
                  <span className="text-primary">Add Reminder</span>
                </Button>
              </div>
              {reminders.length > 0 && (
                <div className="d-flex flex-column gap-2">
                  {reminders.map((r, i) => (
                    <div
                      key={i}
                      className="d-flex align-items-center gap-2"
                    >
                      <div className="flex-grow-1">
                        <DateField
                          value={r}
                          onChange={(d) =>
                            setReminders((prev) =>
                              prev.map((x, idx) => (idx === i ? d ?? null : x)),
                            )
                          }
                          placeholder="Remind me on…"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        appearance="muted"
                        size="icon"
                        aria-label="Remove reminder"
                        onClick={() =>
                          setReminders((prev) => prev.filter((_, idx) => idx !== i))
                        }
                      >
                        <FontAwesomeIcon icon={faXmark} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Additional Options */}
            <div>
              <span className="fw-semibold fs-large d-block mb-2">
                Additional Options
              </span>
              <div className="d-flex flex-column gap-2">
                <div className="d-flex align-items-center gap-2">
                  <Checkbox
                    id="task-followup"
                    checked={createFollowUp}
                    onCheckedChange={(v) => setCreateFollowUp(v === true)}
                  />
                  <label htmlFor="task-followup" className="form-check-label">
                    Create a Follow-Up
                  </label>
                </div>
                {createFollowUp && (
                  <div className="ps-4">
                    <Field>
                      <PlainLabel className="fs-small text-muted">
                        Follow-Up Date
                      </PlainLabel>
                      <DateField
                        value={followUpDate}
                        onChange={(d) => setFollowUpDate(d ?? null)}
                        placeholder="Follow up on…"
                      />
                    </Field>
                  </div>
                )}

                <div className="d-flex align-items-start gap-2">
                  <Checkbox
                    id="task-attachments"
                    checked={requireAttachments}
                    onCheckedChange={(v) => setRequireAttachments(v === true)}
                  />
                  <label htmlFor="task-attachments" className="form-check-label">
                    Require Attachments?
                    <span className="d-block text-primary fs-small">
                      Does this task need an attachment in order to be completed?
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Attachments — edit mode only; upload is not wired up yet. */}
            {isEdit && (
              <div>
                <span className="fw-semibold fs-large d-block mb-2">
                  Attachments
                </span>
                <div className="border rounded-3 d-flex flex-column align-items-center justify-content-center text-center gap-2 p-4">
                  <p className="text-muted fs-small mb-0">
                    Drag and drop or click the button to upload files for this task
                  </p>
                  <Button variant="ghost" appearance="muted">
                    <FontAwesomeIcon
                      icon={faArrowUpFromBracket}
                      className="text-primary"
                    />
                    <span className="text-primary">Upload Files</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer
          className="border-top justify-content-between"
          style={{ padding: 16 }}
        >
          {isEdit ? (
            <Button variant="destructive" onClick={handleDelete}>
              <FontAwesomeIcon icon={faTrashCan} />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="d-flex gap-2">
            <Modal.Close render={<Button variant="ghost" appearance="muted" />}>
              Cancel
            </Modal.Close>
            <Button variant="primary" disabled={!canSave} onClick={handleSave}>
              {isEdit ? "Save Changes" : "Save"}
            </Button>
          </div>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
