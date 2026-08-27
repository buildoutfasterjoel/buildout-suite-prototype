/**
 * Converting between a stored `yyyy-mm-dd` string and a `Date`, without
 * timezone drift.
 *
 * A neutral home for three functions the app had copied four times over —
 * `recordForm/fieldWidgets`, `StageGate`, `GlobalAddTaskModal` and
 * `ContactComposeModule` each carry their own. That is not carelessness: the
 * record-form shell is walled off by `containment.test.ts` and may only be
 * imported from the app's long record forms, so anything else that wanted these
 * had nowhere to import them FROM and copied instead.
 *
 * This is that somewhere. New date controls should import from here. The four
 * existing copies are untouched deliberately — migrating working code is its own
 * change, not a rider on a feature branch — but they are the reason this file
 * exists rather than a fifth copy.
 */

/** How a date reads once picked, e.g. "Jun 22, 2026". */
export const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

/**
 * Parse a stored date value into a local `Date`, or `undefined` when there is
 * none.
 *
 * A bare `yyyy-mm-dd` is parsed as UTC midnight, which lands on the previous day
 * for anyone west of Greenwich, so it is pinned to local time first. A full ISO
 * string already carries its own time and zone and is passed through untouched.
 */
export function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  return new Date(value.length <= 10 ? `${value}T00:00:00` : value);
}

/**
 * Serialize a picked `Date` back to `yyyy-mm-dd`.
 *
 * Built from the local getters rather than `toISOString()`, for the same reason
 * — `toISOString` converts to UTC first and can shift the calendar day.
 */
export function toISODate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
