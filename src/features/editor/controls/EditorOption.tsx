import type { ReactNode } from "react";

/**
 * A labelled control row in the properties panel — the workhorse layout from
 * the Figma. Horizontal puts the label beside the value; vertical stacks them
 * (used for full-width swatch grids).
 */
export function EditorOption({
  label,
  orientation = "horizontal",
  children,
}: {
  label: string;
  orientation?: "horizontal" | "vertical";
  children: ReactNode;
}) {
  if (orientation === "vertical") {
    return (
      <div className="d-flex flex-column gap-2">
        <span className="fs-small" style={{ color: "#506079" }}>
          {label}
        </span>
        <div className="d-flex align-items-center gap-2 w-100">{children}</div>
      </div>
    );
  }

  return (
    <div className="d-flex align-items-center gap-3">
      <span className="fs-small flex-shrink-0" style={{ color: "#506079", width: 96 }}>
        {label}
      </span>
      <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
