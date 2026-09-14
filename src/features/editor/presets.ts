import type { DealUnderwriting, GeneratedSection, Property } from "#/data/types";
import type { Block, DynamicKey, Page, TableBlock } from "./types";
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
  buildLocationMapPage,
  buildPhotoGalleryPage,
  buildPropertyDescriptionPage,
  buildFinancialSummaryPage,
  buildPropertySummaryPage,
} from "./templates/designer";
import { TEMPLATES, buildTemplatePage } from "./templates";

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
      rows: [[headerCell(spec.dynamicLabel ?? "Detail"), valueCell("—", spec.dynamicKey)]],
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
 * Pages for a generated document: one per outline section, named by the section
 * so the page rail reads back the outline the broker approved.
 *
 * A section whose template is missing is skipped rather than thrown on — a
 * stored outline outlives the registry, and a document that lost one page is
 * far better than an editor that will not open.
 */
export function buildGeneratedDocumentPages(
  property: Property | undefined,
  sections: GeneratedSection[],
): Page[] {
  const registered = new Set(TEMPLATES.map((t) => t.key));
  return sections
    .filter((s) => registered.has(s.templateKey))
    .map((s) => withPageIdentity(buildTemplatePage(s.templateKey, property), s.name));
}

/**
 * The one free-form page in the sample document. Every other page is a locked
 * template, so without this the editor opens with nothing to drag and the
 * feature is invisible.
 *
 * Deliberately an overlapping layout — a title band sitting over the hero photo
 * — because that is the thing the stacked layout could not express at all.
 */
function buildFreeFormPage(property: Property | undefined): Page {
  // Requested at the photo frame's own size (below) — an image block covers
  // its box (see the `.bo-editor-frame--boxed` rule in editor.scss), but
  // covering still upscales a source narrower than the frame, so asking for
  // it directly keeps the seeded photo sharp.
  const photo = heroImage("editor-free-form", 816, 520);
  const band: Block = {
    id: uid("block"),
    type: "section",
    padding: 24,
    background: "rgba(18, 38, 63, 0.85)",
    blocks: [],
  };
  const title: Block = {
    id: uid("block"),
    type: "heading",
    text: "Investment Highlights",
    style: { ...headingStyle, color: "#ffffff" },
  };
  const address: Block = {
    id: uid("block"),
    type: "text",
    text: addressOf(property),
    style: { ...addressStyle, color: "#ffffff" },
  };

  return {
    id: uid("page"),
    name: "Investment Highlights",
    logoSrc: LOGO_SRC,
    locked: false,
    blocks: [photo, band, title, address],
    frames: {
      [photo.id]: { x: 0, y: 0, w: 816, h: 520 },
      [band.id]: { x: 48, y: 360, w: 520, h: 132 },
      [title.id]: { x: 72, y: 384, w: 472, h: 48 },
      [address.id]: { x: 72, y: 436, w: 472, h: 32 },
    },
  };
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
    buildFreeFormPage(property),
    // Keeps the section name the document's contents already advertises.
    withPageIdentity(buildPhotoGalleryPage(property), "Additional Photos"),
    // Keeps the section name the document's contents already advertises.
    withPageIdentity(buildLocationMapPage(property), "Location Map"),
    buildStubPage(property, {
      name: "Site Plans",
      seed: "editor-site-plans",
      dynamicKey: "zoning",
      dynamicLabel: "Zoning",
    }),
    financialSummary,
    buildStubPage(property, {
      name: "Income & Expenses",
      seed: "editor-income",
      dynamicKey: "noi",
      dynamicLabel: "Net Operating Income",
    }),
    buildStubPage(property, {
      name: "Sale Comps",
      seed: "editor-sale-comps",
      dynamicKey: "capRate",
      dynamicLabel: "Cap Rate",
    }),
    buildStubPage(property, {
      name: "Lease Comps",
      seed: "editor-lease-comps",
      dynamicKey: "vacancyRate",
      dynamicLabel: "Vacancy Rate",
    }),
    buildStubPage(property, {
      name: "Demographics",
      seed: "editor-demographics",
      dynamicKey: "censusTract",
      dynamicLabel: "Census Tract",
    }),
    buildStubPage(property, {
      name: "Advisor Bios",
      seed: "editor-advisor",
      dynamicKey: "name",
      dynamicLabel: "Prepared For",
    }),
  ];
}
