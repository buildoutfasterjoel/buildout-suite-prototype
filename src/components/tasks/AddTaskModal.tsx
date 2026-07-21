import { useEffect, useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Calendar } from "@buildoutinc/blueprint-react/ui/Calendar";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendar,
  faCirclePlus,
  faUser,
  faXmark,
} from "@fortawesome/pro-regular-svg-icons";
import { CURRENT_USER, TEAMMATES } from "#/data/teammates";
import { getContactOptions } from "#/data/store";

/** The payload emitted on Save — a plain snapshot of the form. */
export interface NewTaskDraft {
  name: string;
  assigneeId: string;
  dueDate: Date | null;
  type: string | null;
  source: string;
  contactId: string | null;
  notes: string;
  reminders: Date[];
  followUpDate: Date | null;
  requireAttachments: boolean;
}

const TASK_TYPES = [
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
  { value: "listing", label: "Listing" },
  { value: "property", label: "Property" },
];

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/**
 * A date picker field: a read-only input whose calendar opens from a leading
 * icon addon. Kept local so every date in the form (due date, reminders,
 * follow-up) shares one consistent control.
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
  return (
    <InputGroup>
      <InputGroup.Addon>
        <Popover>
          <Popover.Trigger
            nativeButton={false}
            render={<FontAwesomeIcon icon={faCalendar} />}
          />
          <Popover.Content className="p-0" align="start">
            <Calendar
              mode="single"
              selected={value ?? undefined}
              onSelect={onChange}
            />
          </Popover.Content>
        </Popover>
      </InputGroup.Addon>
      <Input readOnly placeholder={placeholder} value={value ? fmtDate(value) : ""} />
    </InputGroup>
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

export function AddTaskModal({
  open,
  onOpenChange,
  defaultContactId = null,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select a contact (e.g. when opened from a contact's Tasks panel). */
  defaultContactId?: string | null;
  onSave?: (draft: NewTaskDraft) => void;
}) {
  const contactOptions = useMemo(() => getContactOptions(), []);
  const assignees = useMemo(
    () => [
      CURRENT_USER,
      ...TEAMMATES.filter((t) => t.id !== CURRENT_USER.id),
    ],
    [],
  );

  const [name, setName] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>(CURRENT_USER.id);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [source, setSource] = useState<string>("contact");
  const [contactId, setContactId] = useState<string | null>(defaultContactId);
  const [notes, setNotes] = useState("");
  const [reminders, setReminders] = useState<Array<Date | null>>([]);
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState<Date | null>(null);
  const [requireAttachments, setRequireAttachments] = useState(false);

  // The modal is mounted once globally, so its state survives across opens.
  // Sync the pre-selected contact each time it opens (or the default changes).
  useEffect(() => {
    if (open) setContactId(defaultContactId);
  }, [open, defaultContactId]);

  const canSave = name.trim().length > 0;

  const reset = () => {
    setName("");
    setAssigneeId(CURRENT_USER.id);
    setDueDate(null);
    setType(null);
    setSource("contact");
    setContactId(defaultContactId);
    setNotes("");
    setReminders([]);
    setCreateFollowUp(false);
    setFollowUpDate(null);
    setRequireAttachments(false);
  };

  const close = () => onOpenChange(false);

  const handleSave = () => {
    if (!canSave) return;
    onSave?.({
      name: name.trim(),
      assigneeId,
      dueDate,
      type,
      source,
      contactId,
      notes: notes.trim(),
      reminders: reminders.filter((r): r is Date => r != null),
      followUpDate: createFollowUp ? followUpDate : null,
      requireAttachments,
    });
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
          <Modal.Title>Add Task</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 24, maxHeight: 560 }}>
          <div className="d-flex flex-column gap-3">
            <Field>
              <Field.Label>
                Task Name <span className="text-danger">*</span>
              </Field.Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Send follow-up proposal"
                autoFocus
              />
            </Field>

            <Field>
              <Field.Label>Assigned To</Field.Label>
              <Select value={assigneeId} onValueChange={(v) => v && setAssigneeId(v)}>
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

            <Field>
              <Field.Label>Due Date</Field.Label>
              <DateField value={dueDate} onChange={(d) => setDueDate(d ?? null)} />
            </Field>

            <div className="row g-3">
              <div className="col-6">
                <Field>
                  <Field.Label>Type</Field.Label>
                  <Select value={type} onValueChange={setType}>
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
              <div className="col-6">
                <Field>
                  <Field.Label>Source</Field.Label>
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
            </div>

            {source === "contact" && (
              <Field>
                <Field.Label>Contact</Field.Label>
                <Select value={contactId} onValueChange={setContactId}>
                  <Select.Trigger className="w-100">
                    <SelectDisplay
                      icon={faUser}
                      placeholder="Select a contact"
                      label={contactOptions.find((c) => c.value === contactId)?.name}
                    />
                  </Select.Trigger>
                  <Select.Content>
                    {contactOptions.map((c) => (
                      <Select.Item key={c.value} value={c.value}>
                        {c.name}
                        {c.company ? ` · ${c.company}` : ""}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>
            )}

            <Field>
              <Field.Label>Notes</Field.Label>
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
                      <Field.Label className="fs-small text-muted">
                        Follow-Up Date
                      </Field.Label>
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
          </div>
        </Modal.Body>
        <Modal.Footer className="border-top" style={{ padding: 16 }}>
          <Modal.Close render={<Button variant="ghost" appearance="muted" />}>
            Cancel
          </Modal.Close>
          <Button variant="primary" disabled={!canSave} onClick={handleSave}>
            Save
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
