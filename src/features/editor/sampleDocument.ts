import type { DealUnderwriting, Property } from "#/data/types";
import type { EditorDocument } from "./types";
import { buildDocumentPages } from "./presets";

/**
 * Build the sample "Proposal" document, seeded with the bound listing's real
 * data — a CRE offering memorandum (Cover Page, Table of Contents, then grouped
 * sections: Property Information, Location Information, Financial Analysis, Sale
 * Comparables, Lease Comparables, Demographics, Advisor Bios). When the deal has
 * a generated ("ready") underwriting, its section is injected after the TOC.
 */
export function buildSampleDocument(
  property: Property | undefined,
  underwriting?: DealUnderwriting,
): EditorDocument {
  return {
    id: "doc-proposal",
    name: "Proposal",
    pages: buildDocumentPages(property, underwriting),
  };
}
