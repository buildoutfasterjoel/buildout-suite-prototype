import { useEffect, useRef, useState } from "react";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDollar } from "@fortawesome/pro-regular-svg-icons";

/**
 * A dollar-amount input: a `$` prefix addon plus live thousands-separator
 * masking as the user types (e.g. `1250000` → `1,250,000`). Up to two decimal
 * places are allowed but never forced, so whole-dollar prices stay clean
 * (`$1,250,000`) while lease-style rates can still carry cents (`$24.50`).
 *
 * The field is `type="text"` — `type="number"` rejects comma characters, so a
 * mask is impossible with it. Display is masked; `onChange` always emits the
 * raw number so form state and persistence are unaffected.
 */

/** Format a stored number as a masked display string (no forced trailing zeros). */
function formatFromNumber(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Mask raw keystrokes → `{ display, numeric }`. Digits + one optional dot, max 2 decimals. */
function maskCurrency(raw: string): {
  display: string;
  numeric: number | null;
} {
  let cleaned = raw.replace(/[^\d.]/g, "");
  // Collapse to a single decimal point (keep the first).
  const dot = cleaned.indexOf(".");
  if (dot !== -1) {
    cleaned =
      cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
  }
  if (cleaned === "") return { display: "", numeric: null };

  const hasDot = cleaned.includes(".");
  const [intPart, decRaw = ""] = cleaned.split(".");
  const decPart = decRaw.slice(0, 2);
  // Trim leading zeros but keep a single leading 0 (e.g. "007" → "7", "0" → "0").
  const intDigits = intPart.replace(/^0+(?=\d)/, "");
  const grouped =
    intDigits === "" ? "" : Number(intDigits).toLocaleString("en-US");

  const display = hasDot
    ? `${grouped === "" ? "0" : grouped}.${decPart}`
    : grouped;
  const numeric = Number(
    `${intDigits === "" ? "0" : intDigits}.${decPart || "0"}`,
  );

  return { display, numeric: Number.isNaN(numeric) ? null : numeric };
}

export interface CurrencyInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  disabled,
  id,
  "aria-label": ariaLabel,
}: CurrencyInputProps) {
  const [text, setText] = useState(() => formatFromNumber(value));
  const focused = useRef(false);

  // Re-sync the display from the external value only when the user isn't
  // actively editing — e.g. Sale Price recomputing the commission amount, or a
  // form reset. Skipping while focused keeps in-progress input (a trailing dot,
  // "24.50") from being clobbered mid-keystroke.
  useEffect(() => {
    if (!focused.current) setText(formatFromNumber(value));
  }, [value]);

  return (
    <InputGroup>
      <InputGroup.Addon asText>
        <FontAwesomeIcon icon={faDollar} />
      </InputGroup.Addon>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          setText(formatFromNumber(value));
        }}
        onChange={(e) => {
          const { display, numeric } = maskCurrency(e.target.value);
          setText(display);
          onChange(numeric);
        }}
      />
    </InputGroup>
  );
}
