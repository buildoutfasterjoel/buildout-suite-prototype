import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Calendar } from "@buildoutinc/blueprint-react/ui/Calendar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrashCan,
  faCalendar,
  faTriangleExclamation,
  faCirclePlus,
} from "@fortawesome/pro-regular-svg-icons";
import {
  conflictRowId,
  useIngestionConflict,
} from "#/components/deals/ingestionConflictContext";
import type { IngestionFieldKey, YesNoNA } from "#/data/types";

// ── Small field wrappers ─────────────────────────────────────────────────────
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  rows,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
  /** Renders a red `*` after the label (visual hint only — no validation). */
  required?: boolean;
}) {
  return (
    <Field className="record-form__field">
      <InputGroup>
        <InputGroup.Addon asText className="record-form__gutter">
          <Field.Label className="align-self-start">
            {label}
            {required && <span className="text-danger ms-1">*</span>}
          </Field.Label>
        </InputGroup.Addon>
        {textarea ? (
          <Textarea
            className="record-form__control"
            rows={rows ?? 3}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <Input
            className="record-form__control"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </InputGroup>
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  fieldKey,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  /** When set and an unresolved ingestion conflict exists for it, the field
   * renders the doc-vs-record arbitration row beneath the input. */
  fieldKey?: IngestionFieldKey;
}) {
  const { conflict, resolve } = useIngestionConflict(fieldKey);
  return (
    <Field className="record-form__field">
      <InputGroup>
        <InputGroup.Addon asText className="record-form__gutter">
          <Field.Label className="d-flex align-items-center gap-2">
            {label}
            {conflict && (
              <FontAwesomeIcon
                icon={faTriangleExclamation}
                className="text-warning"
              />
            )}
          </Field.Label>
        </InputGroup.Addon>
        <Input
          type="number"
          className={
            conflict
              ? "ingestion-conflict__input record-form__control"
              : "record-form__control"
          }
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      </InputGroup>
      {conflict && (
        <div
          className="ingestion-conflict__row"
          id={conflictRowId(conflict.fieldKey)}
        >
          {/* The field itself already shows the value on record — the value the
              broker would be keeping — so this row names only the alternative the
              documents propose. Showing both here (beside an input holding one of
              them) read as a bug. */}
          <span className="fs-small">
            <span className="text-muted">{conflict.docSource} says </span>
            <span className="fw-semibold">{conflict.docValue}</span>
          </span>
          <div className="d-flex gap-2 flex-shrink-0">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onChange(conflict.docRaw);
                resolve("doc");
              }}
            >
              Use {conflict.docValue}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onChange(conflict.currentRaw);
                resolve("current");
              }}
            >
              Keep {conflict.currentValue}
            </Button>
          </div>
        </div>
      )}
    </Field>
  );
}

/**
 * A derived figure — the output of a calculation, not something to type into.
 *
 * Deliberately not a read-only `Input`: a disabled-looking text box beside a
 * column of live ones reads as a field that is merely switched off, and invites
 * a click. A label and a figure read as a result. Body-size bold rather than a
 * KPI tile, because these sit inside a form that already stacks many headings
 * and numbers.
 *
 * Renders nothing when `value` is blank, so an un-entered input does not leave a
 * dangling label with no figure beside it.
 */
export function Readout({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="record-form__readout">
      <span className="fs-small text-muted">{label}</span>
      <span className="fw-semibold">{value}</span>
    </div>
  );
}

/**
 * A field whose value is fixed — Deal Type, which a listing cannot change.
 *
 * Exists so a fixed value still sits in the gutter like every field around it.
 * Rendering it as a bare `Field` + readOnly `Input` is what left Deal Type as
 * the one top-labeled row in a form of gutter-labeled ones.
 */
export function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Field className="record-form__field">
      <InputGroup>
        <InputGroup.Addon asText className="record-form__gutter">
          <Field.Label>{label}</Field.Label>
        </InputGroup.Addon>
        <Input className="record-form__control" readOnly value={value} />
      </InputGroup>
    </Field>
  );
}

export const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

/** Format a stored date value (ISO string or `yyyy-mm-dd`) as a local Date. */
export function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  // Plain `yyyy-mm-dd` parses as UTC midnight; pin to local to avoid an
  // off-by-one day. Full ISO strings already carry a time/zone.
  return new Date(value.length <= 10 ? `${value}T00:00:00` : value);
}

/** Serialize a picked Date to a local `yyyy-mm-dd` (no timezone drift). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Blueprint date input: a read-only field with a calendar-icon addon that opens
 * a single-date Calendar popover, closing once a date is picked.
 * (Documented InputGroup + Popover + Calendar pattern.)
 */
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);
  return (
    <Field className="record-form__field">
      <InputGroup>
        <InputGroup.Addon asText className="record-form__gutter">
          <Field.Label>{label}</Field.Label>
        </InputGroup.Addon>

        <Input
          className="record-form__control"
          type="text"
          readOnly
          placeholder="Pick a date"
          value={
            selected ? selected.toLocaleDateString(undefined, DATE_FORMAT) : ""
          }
        />
        <InputGroup.Addon>
          <Popover open={open} onOpenChange={setOpen}>
            <Popover.Trigger
              nativeButton={false}
              aria-label="Open date picker"
              render={<FontAwesomeIcon icon={faCalendar} />}
            />
            <Popover.Content className="p-0" align="start">
              <Calendar
                mode="single"
                selected={selected}
                defaultMonth={selected}
                onSelect={(d) => {
                  onChange(d ? toISODate(d) : null);
                  setOpen(false);
                }}
              />
            </Popover.Content>
          </Popover>
        </InputGroup.Addon>
      </InputGroup>
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  labels,
  placeholder,
}: {
  label: string;
  /** `null` renders the placeholder instead of forcing a default option —
   * use this for a field that hasn't been set rather than coercing to
   * `options[0]` (which would silently imply a choice the user never made). */
  value: T | null;
  options: readonly T[];
  onChange: (v: T) => void;
  labels?: Record<string, string>;
  /** Shown in the trigger when `value` is null. Defaults to "Select…". */
  placeholder?: string;
}) {
  return (
    <Field className="record-form__field">
      <InputGroup>
        <InputGroup.Addon asText className="record-form__gutter">
          <Field.Label>{label}</Field.Label>
        </InputGroup.Addon>
        <Select value={value} onValueChange={(v) => v && onChange(v as T)}>
          <Select.Trigger className="bg-card record-form__control">
            <Select.Value>
              {(v) =>
                v == null
                  ? (placeholder ?? "Select…")
                  : labels
                    ? (labels[v as string] ?? String(v))
                    : String(v)
              }
            </Select.Value>
          </Select.Trigger>
          <Select.Content>
            {options.map((o) => (
              <Select.Item key={o} value={o}>
                {labels?.[o] ?? o}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </InputGroup>
    </Field>
  );
}

/**
 * `SelectField` with typeahead, for option lists long enough that one scroll of
 * every choice is worse than filtering. Same shape as `SelectField` except the
 * change handler also takes `null` — the clear button is the point of an
 * autocomplete, so the caller's field has to be nullable.
 */
export function ComboField<T extends string>({
  label,
  value,
  options,
  onChange,
  labels,
  placeholder,
  required,
}: {
  label: string;
  value: T | null;
  options: readonly T[];
  onChange: (v: T | null) => void;
  /** Display text per option, when the stored value is not what a broker would
   *  type. Same shape as `SelectField`'s. The stored value stays the option
   *  itself — only the rendering and the typeahead's haystack change, so "TX"
   *  is still what lands on the record while "Texas" still finds it. */
  labels?: Record<string, string>;
  /** Shown when nothing is selected. Defaults to "Search…". */
  placeholder?: string;
  required?: boolean;
}) {
  const labelFor = (item: T) => labels?.[item] ?? item;
  return (
    <Field className="record-form__field">
      <InputGroup>
        <InputGroup.Addon asText className="record-form__gutter">
          <Field.Label>
            {label}
            {required && <span className="text-danger ms-1">*</span>}
          </Field.Label>
        </InputGroup.Addon>
        <Combobox
          items={options as T[]}
          value={value}
          onValueChange={(v) => onChange((v as T | null) ?? null)}
          // base-ui filters and renders the selected value through this, so it
          // has to be set for `labels` to reach the input and the match logic —
          // without it, typing "Texas" against items of `["TX", …]` finds
          // nothing. Blueprint's Combobox root is a direct alias of base-ui's,
          // so the prop passes straight through.
          itemToStringLabel={(item: T) => labelFor(item)}
        >
          <Combobox.InputGroup>
            <Combobox.Input
              className="flex-grow-0 record-form__control"
              placeholder={placeholder ?? "Search…"}
              showClear
            />
          </Combobox.InputGroup>
          <Combobox.Content>
            <Combobox.Empty className="text-muted">No match</Combobox.Empty>
            <Combobox.List>
              {(item: T) => (
                <Combobox.Item key={item} value={item}>
                  {labelFor(item)}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Content>
        </Combobox>
      </InputGroup>
    </Field>
  );
}

export const YES_NO_NA_OPTIONS: YesNoNA[] = ["Y", "N", "NA"];

/** Y/N/NA select, e.g. Irrigation/Water/1031 Exchange availability. */
export function YesNoNaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: YesNoNA | undefined;
  onChange: (v: YesNoNA) => void;
}) {
  return (
    <SelectField
      label={label}
      value={value ?? "NA"}
      options={YES_NO_NA_OPTIONS}
      onChange={onChange}
    />
  );
}

export function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  // Switch first, label beside it. `justify-content-between` used to push the
  // two to opposite ends of the row, which needed a `maxWidth` wrapper at every
  // call site just to stop them drifting a full column apart — and still left a
  // gap wide enough that the label read as unrelated to the control.
  return (
    <div className="d-flex align-items-center gap-2 py-1">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
      <span>{label}</span>
    </div>
  );
}

/**
 * A responsive two-column grid of fields — the *peer* tier at 16px.
 *
 * `g-4`, not `g-3`. Blueprint remaps Bootstrap's spacer scale onto its own
 * tokens, so `g-3` is 12px here rather than 16px — only 4px off the 8px `gap-2`
 * that binds a control to the field it reveals. At that distance the two tiers
 * are indistinguishable and a switch reads as merely the next thing rather than
 * as belonging to the block above it. 16px restores a 2× step: 8 / 16 / 32 / 64.
 */
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="row g-4">{children}</div>;
}
/**
 * One cell in a `FieldGrid`. `span` is Bootstrap's 12-column scale at the `md`
 * breakpoint; it defaults to 6 so every existing caller is unchanged.
 *
 * Widths are what let related short fields share a row — City / State / Zip on
 * one line rather than three half-width rows — which chunks the form visually
 * without any type change. Bootstrap ships every `col-md-*` class, so building
 * the name at runtime is safe here (this is not Tailwind; nothing is purged).
 */
export function Col({
  children,
  span = 6,
}: {
  children: React.ReactNode;
  span?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12;
}) {
  return <div className={`col-md-${span}`}>{children}</div>;
}

// ── Bullets editor ───────────────────────────────────────────────────────────
export function BulletsField({
  label,
  bullets,
  onChange,
}: {
  label: string;
  bullets: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Field>
      <Field.Label>{label}</Field.Label>
      <div className="d-flex flex-column gap-2">
        {bullets.map((b, i) => (
          <div key={i} className="d-flex align-items-center gap-2">
            <Input
              value={b}
              onChange={(e) =>
                onChange(bullets.map((x, j) => (j === i ? e.target.value : x)))
              }
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Remove bullet"
              onClick={() => onChange(bullets.filter((_, j) => j !== i))}
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </Button>
          </div>
        ))}
        <div>
          <Button variant="outline" onClick={() => onChange([...bullets, ""])}>
            <FontAwesomeIcon icon={faCirclePlus} />
            Add bullet
          </Button>
        </div>
      </div>
    </Field>
  );
}
