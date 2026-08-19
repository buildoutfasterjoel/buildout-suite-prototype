import type { DealUnderwriting, DocumentGeneration, Property } from "#/data/types";
import type { EditorDocument } from "./types";
import { buildDocumentPages, buildGeneratedDocumentPages } from "./presets";

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

/**
 * Build a generated document from its stored outline. Distinct from
 * `buildSampleDocument`, which builds the fixed Proposal every deal gets when no
 * generated document was requested.
 */
export function buildGeneratedDocument(
  property: Property | undefined,
  name: string,
  generation: DocumentGeneration,
): EditorDocument {
  return {
    id: "doc-generated",
    name,
    pages: buildGeneratedDocumentPages(property, generation.sections),
  };
}
