/**
 * The documents in Rosa's arc, shared so the names match end to end: the
 * financials email's attachment chips, the AI progress modal's "scanning"
 * step, the created deal's document set, and the signed-agreement email chip
 * all read from one source of truth.
 */

/** Miguel's financials Rosa attaches to her follow-up email (T-12 + rent roll). */
export const ROSA_FINANCIAL_DOCS = [
  { name: "The Delgado Building — T12.pdf", meta: "PDF · 268 KB", size: "268 KB" },
  { name: "Delgado Rent Roll — July 2026.xlsx", meta: "XLSX · 96 KB", size: "96 KB" },
];

/** The signed listing agreement Rosa returns after reading the BOV. */
export const ROSA_SIGNED_AGREEMENT = {
  name: "Delgado Listing Agreement — Signed.pdf",
  meta: "PDF · 1.1 MB",
  size: "1.1 MB",
};

/** The LOI the buyer lead emails in after his call (see rosaLoi.ts). */
export const DELGADO_LOI = {
  name: "Delgado Building — Letter of Intent (Trejo Residential).pdf",
  meta: "PDF · 412 KB",
  size: "412 KB",
};
