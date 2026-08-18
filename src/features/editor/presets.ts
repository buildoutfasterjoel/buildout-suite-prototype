import type { DealUnderwriting, Property } from "#/data/types";
import type { Block, Cell, DynamicKey, Page, TableBlock } from "./types";
import { uid } from "./blocks/blockFactory";
import { buildUnderwritingSection } from "./underwritingPages";
import {
  LOGO_SRC,
  addressOf,
  addressStyle,
  headerCell,
  headingStyle,
  heroImage,
  valueCell,
} from "./templates/helpers";
import {
  buildContentsPage,
  buildCoverPage,
  buildPhotoGalleryPage,
  buildPropertyDescriptionPage,
  buildFinancialSummaryPage,
  buildPropertySummaryPage,
} from "./templates/designer";

/**
 * Spec for a lightweight locked page in the sample proposal: a heading, address,
 * and hero image, plus (when `dynamicKey` is set) a one-row table binding a live
 * listing field — this is what makes the Pages panel's "has dynamic data" bolt
 * indicator light up for the page.
 */
interface StubPageSpec {
  name: string;
  /** Photo seed, for visual variety across pages. */
  seed: string;
  dynamicKey?: DynamicKey;
  dynamicLabel?: string;
  format?: Cell["format"];
}

function buildStubPage(property: Property | undefined, spec: StubPageSpec): Page {
  const blocks: Block[] = [
    { id: uid("block"), type: "heading", text: spec.name, style: headingStyle },
    { id: uid("block"), type: "text", text: addressOf(property), style: addressStyle },
    heroImage(spec.seed),
  ];

  if (spec.dynamicKey) {
    const table: TableBlock = {
      id: uid("block"),
      type: "table",
      title: spec.name,
      style: { borderWidth: 1, borderStyle: "solid", borderColor: "#d5dae2" },
      rows: [[headerCell(spec.dynamicLabel ?? "Detail"), valueCell("—", spec.dynamicKey, spec.format)]],
    };
    blocks.push(table);
  }

  return {
    id: uid("page"),
    name: spec.name,
    logoSrc: LOGO_SRC,
    locked: true,
    blocks,
  };
}

/** Rename a built page (and its heading block, which always leads) in place. */
function withPageIdentity(page: Page, name: string): Page {
  const blocks = page.blocks.map((b, i) => (i === 0 && b.type === "heading" ? { ...b, text: name } : b));
  return { ...page, name, blocks };
}

/**
 * The sample "Proposal" document's page list — a 14-page CRE offering
 * memorandum: a cover, a table of contents, then one page per section of a real
 * proposal (property, location, financials, comps, demographics, the team).
 * Every entry is a real, selectable page — two reuse the richer hand-built
 * designer templates, the rest are lightweight stubs.
 *
 * Deliberately short. An earlier pass ran 23 pages, but seven of those were
 * title-only section dividers and four were near-duplicate map/comps pages, so
 * scrolling the document mostly meant scrolling past filler. The section
 * divider survives as a gallery template (`brandDivider`) for anyone who wants
 * one; it just isn't seeded seven times.
 */
export function buildDocumentPages(
  property?: Property,
  underwriting?: DealUnderwriting,
): Page[] {
  const propertySummary = buildPropertySummaryPage(property);
  const financialSummary = withPageIdentity(buildFinancialSummaryPage(property), "Financial Summary");

  return [
    // The real designer cover, not a stub — it's the page the BOV send flow
    // previews, so the opened document has to lead with the same artwork.
    buildCoverPage(property),
    buildContentsPage(property),
    // Once the AI has generated underwriting for this deal, it leads the body —
    // pages scale with the thoroughness the user chose. Empty otherwise.
    ...buildUnderwritingSection(property, underwriting),
    propertySummary,
    buildPropertyDescriptionPage(property),
    buildStubPage(property, {
      name: "Complete Highlights",
      seed: "editor-highlights",
      dynamicKey: "buildingSqFt",
      dynamicLabel: "Building Size",
      format: "text",
    }),
    // Keeps the section name the document's contents already advertises.
    withPageIdentity(buildPhotoGalleryPage(property), "Additional Photos"),
    buildStubPage(property, {
      name: "Location Map",
      seed: "editor-location-map",
      dynamicKey: "city",
      dynamicLabel: "City",
      format: "text",
    }),
    buildStubPage(property, {
      name: "Site Plans",
      seed: "editor-site-plans",
      dynamicKey: "zoning",
      dynamicLabel: "Zoning",
      format: "text",
    }),
    financialSummary,
    buildStubPage(property, {
      name: "Income & Expenses",
      seed: "editor-income",
      dynamicKey: "noi",
      dynamicLabel: "Net Operating Income",
      format: "currency",
    }),
    buildStubPage(property, {
      name: "Sale Comps",
      seed: "editor-sale-comps",
      dynamicKey: "capRate",
      dynamicLabel: "Cap Rate",
      format: "percent",
    }),
    buildStubPage(property, {
      name: "Lease Comps",
      seed: "editor-lease-comps",
      dynamicKey: "vacancyRate",
      dynamicLabel: "Vacancy Rate",
      format: "percent",
    }),
    buildStubPage(property, {
      name: "Demographics",
      seed: "editor-demographics",
      dynamicKey: "censusTract",
      dynamicLabel: "Census Tract",
      format: "text",
    }),
    buildStubPage(property, {
      name: "Advisor Bios",
      seed: "editor-advisor",
      dynamicKey: "name",
      dynamicLabel: "Prepared For",
      format: "text",
    }),
  ];
}
