import type { ReactNode } from "react";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import {
  Combobox,
  useComboboxAnchor,
} from "@buildoutinc/blueprint-react/ui/Combobox";

/**
 * A titled block of settings fields. Sections are separated by a rule rather
 * than nested cards — the whole tab already sits inside the content card.
 */
export function SettingsSection({
  title,
  description,
  action,
  children,
  divider = true,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Set false on the last section so the tab doesn't end on a rule. */
  divider?: boolean;
}) {
  return (
    <>
      <section className="d-flex flex-column gap-3">
        <div className="d-flex align-items-start justify-content-between gap-3">
          <div>
            <h2 className="fs-5 fw-semibold mb-0">{title}</h2>
            {description && (
              <p className="text-muted mb-0 mt-1">{description}</p>
            )}
          </div>
          {action}
        </div>
        {children}
      </section>
      {divider && <Separator className="my-5" />}
    </>
  );
}

/** Two fields per row on wide screens, stacked below `md`. */
export function SettingsRow({ children }: { children: ReactNode }) {
  return <div className="row g-4">{children}</div>;
}

export function SettingsCol({ children }: { children: ReactNode }) {
  return <div className="col-md-6">{children}</div>;
}

/** Red asterisk marking a required label, matching the live product. */
export function RequiredMark() {
  return (
    <span className="text-danger ms-1" aria-hidden>
      *
    </span>
  );
}

/**
 * Multi-select combobox rendering the current selection as removable chips.
 * Used for the company's specialties and sub-specialties.
 */
export function MultiSelectField({
  options,
  value,
  onChange,
  placeholder = "Select...",
  emptyMessage = "No matches",
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
}) {
  // Anchor the popup to the chip container rather than the bare input, so the
  // list stays the full field width as chips wrap it onto a second line.
  const anchor = useComboboxAnchor();

  return (
    <Combobox
      multiple
      items={options}
      value={value}
      onValueChange={(next) => onChange(next as string[])}
    >
      <Combobox.InputGroup ref={anchor}>
        <Combobox.Chips>
          {/* Chips are index-based: ChipRemove resolves its target from the
              chip's position inside Chips, so order must track `value`. */}
          {value.map((item) => (
            <Combobox.Chip key={item}>{item}</Combobox.Chip>
          ))}
          <Combobox.Input
            placeholder={value.length ? "" : placeholder}
            showTrigger
          />
        </Combobox.Chips>
      </Combobox.InputGroup>
      <Combobox.Content anchor={anchor}>
        <Combobox.Empty className="text-muted p-2">
          {emptyMessage}
        </Combobox.Empty>
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
