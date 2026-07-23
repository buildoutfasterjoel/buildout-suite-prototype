import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Calendar } from "@buildoutinc/blueprint-react/ui/Calendar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrashCan,
  faCalendar,
} from "@fortawesome/pro-regular-svg-icons";

// ── Small field wrappers ─────────────────────────────────────────────────────
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
}) {
  return (
    <Field>
      <Field.Label>{label}</Field.Label>
      {textarea ? (
        <Textarea
          rows={rows ?? 3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Field>
      <Field.Label>{label}</Field.Label>
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
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
    <Field>
      <Field.Label>{label}</Field.Label>
      <InputGroup>
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
        <Input
          type="text"
          readOnly
          placeholder="Pick a date"
          value={
            selected ? selected.toLocaleDateString(undefined, DATE_FORMAT) : ""
          }
        />
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
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  labels?: Record<string, string>;
}) {
  return (
    <Field>
      <Field.Label>{label}</Field.Label>
      <Select value={value} onValueChange={(v) => v && onChange(v as T)}>
        <Select.Trigger className="w-100">
          <Select.Value>
            {(v) => (labels ? (labels[v as string] ?? String(v)) : String(v))}
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
    </Field>
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
  return (
    <div className="d-flex align-items-center justify-content-between gap-3 py-1">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

/** A responsive two-column grid of fields. */
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="row g-3">{children}</div>;
}
export function Col({ children }: { children: React.ReactNode }) {
  return <div className="col-md-6">{children}</div>;
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
              variant="ghost"
              size="icon-sm"
              aria-label="Remove bullet"
              onClick={() => onChange(bullets.filter((_, j) => j !== i))}
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </Button>
          </div>
        ))}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange([...bullets, ""])}
          >
            <FontAwesomeIcon icon={faPlus} />
            Add bullet
          </Button>
        </div>
      </div>
    </Field>
  );
}
