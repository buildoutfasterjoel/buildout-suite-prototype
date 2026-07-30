import { createContext, useContext, useMemo } from "react";
import type { IngestionConflict, IngestionFieldKey } from "#/data/types";

interface ConflictCtx {
  /** The run's conflicts. Resolved entries are filtered out on read, so a field
   * the broker has already settled renders as a normal field. */
  conflicts: IngestionConflict[];
  onResolve: (fieldKey: IngestionFieldKey, side: "doc" | "current") => void;
}

const Ctx = createContext<ConflictCtx | null>(null);

/**
 * Supplies the ingestion conflicts to the shared field wrappers, so arbitration
 * renders on the real form field instead of in a parallel review surface. Absent
 * provider (the normal edit route) means every field renders unchanged.
 */
export function IngestionConflictProvider({
  conflicts,
  onResolve,
  children,
}: ConflictCtx & { children: React.ReactNode }) {
  const value = useMemo(
    () => ({ conflicts, onResolve }),
    [conflicts, onResolve],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The unresolved conflict for a field, if any, plus its resolver. */
export function useIngestionConflict(fieldKey: IngestionFieldKey | undefined) {
  const ctx = useContext(Ctx);
  const conflict =
    ctx && fieldKey
      ? ctx.conflicts.find((c) => c.fieldKey === fieldKey && !c.resolution)
      : undefined;
  return {
    conflict,
    resolve: (side: "doc" | "current") => {
      if (ctx && fieldKey) ctx.onResolve(fieldKey, side);
    },
  };
}

/**
 * DOM id of a field's arbitration row. The row only renders while the conflict is
 * unresolved, which makes it the scroll target review mode aims at.
 */
export function conflictRowId(fieldKey: IngestionFieldKey): string {
  return `ingestion-conflict-${fieldKey}`;
}

/** How many unresolved conflicts fall on a given set of field keys — for tab badges. */
export function countConflictsFor(
  conflicts: IngestionConflict[],
  fieldKeys: IngestionFieldKey[],
): number {
  return conflicts.filter(
    (c) => !c.resolution && fieldKeys.includes(c.fieldKey),
  ).length;
}
