import type { Property } from "#/data/types";
import type { EditorDocument } from "./types";
import { buildDocumentPages } from "./presets";

/**
 * Build the sample "Proposal" document, seeded with the bound listing's real
 * data — an 18-page CRE offering memorandum (Cover Page, Table of Contents, then
 * grouped sections: Property Information, Location Information, Financial
 * Analysis, Sale Comparables, Lease Comparables, Demographics, Advisor Bios).
 */
export function buildSampleDocument(property: Property | undefined): EditorDocument {
  return {
    id: "doc-proposal",
    name: "Proposal",
    pages: buildDocumentPages(property),
  };
}
