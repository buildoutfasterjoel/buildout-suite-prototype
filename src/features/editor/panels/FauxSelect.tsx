import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown } from "@fortawesome/pro-regular-svg-icons";

/**
 * Presentational select field matching the Figma input. Non-functional in
 * Phase 1 — it reflects the current value; real selection lands in Phase 2.
 */
export function FauxSelect({ value }: { value: string }) {
  return (
    <div
      className="d-flex align-items-center justify-content-between flex-grow-1 px-3"
      style={{
        minHeight: 36,
        minWidth: 0,
        border: "1px solid #d5dae2",
        borderRadius: 6,
        background: "#fff",
        color: "#22262f",
        fontSize: 14,
      }}
    >
      <span className="text-truncate">{value}</span>
      <FontAwesomeIcon icon={faCaretDown} style={{ color: "#22262f" }} />
    </div>
  );
}
