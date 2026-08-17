/**
 * A saved report is a standard report plus the filters someone pinned to it —
 * the "custom reporting" half of the index. Fixtures rather than seed data:
 * nothing else in the app reads or writes them yet, so putting them in
 * IndexedDB would move SEED_VERSION for no gain.
 *
 * Dates are literal ISO strings, not offsets from today, so the list reads the
 * same on every render and in tests.
 */
export type SavedReport = {
  id: string;
  name: string;
  /** Slug of the standard report this was built from — see REPORTS_BY_ID. */
  baseReportId: string;
  /** The pinned filters, rendered as badges. */
  filters: string[];
  lastRunAt: string;
  owner: string;
};

export const SAVED_REPORTS: SavedReport[] = [
  {
    id: "saved-industrial-vacancy",
    name: "Industrial Vacancy — West Loop",
    baseReportId: "inventory",
    filters: ["Industrial", "West Loop", "Available"],
    lastRunAt: "2026-08-14",
    owner: "Ethan Delgado",
  },
  {
    id: "saved-q3-pipeline",
    name: "Q3 Pipeline by Broker",
    baseReportId: "pipeline",
    filters: ["Jul 1 – Sep 30, 2026", "All stages", "Grouped by broker"],
    lastRunAt: "2026-08-11",
    owner: "Ethan Delgado",
  },
  {
    id: "saved-expiring-leases",
    name: "Leases Expiring in 90 Days",
    baseReportId: "critical-dates",
    filters: ["Lease expiration", "Next 90 days"],
    lastRunAt: "2026-08-03",
    owner: "Ethan Delgado",
  },
  {
    id: "saved-open-receivables",
    name: "Open Receivables Over 30 Days",
    baseReportId: "receivables",
    filters: ["Unpaid", "Aged 30+ days", "All offices"],
    lastRunAt: "2026-07-28",
    owner: "Priya Raman",
  },
];

/** "Aug 14, 2026" — parsed as local time so the date doesn't shift a day back. */
export function formatLastRun(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
