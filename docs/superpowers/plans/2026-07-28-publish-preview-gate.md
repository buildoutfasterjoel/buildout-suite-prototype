# Publish Preview Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Pitching → Active gate's form-of-missing-fields with a preview of the listing about to go live — content, photos, documents — that the broker either approves or bails out of to the edit space.

**Architecture:** A pure model builder (`src/data/publishPreview.ts`) turns a `Listing` + the gate's working form into typed sections of `ok`/`missing` rows plus photo and document lists. A view component (`PublishPreview.tsx`) renders it inside the existing stage-gate modal. `StageGate` delegates to it when `config.publishes`; the other four gates are untouched. `requestStageChange` stops silently committing publish transitions so the review always happens.

**Tech Stack:** React 19 · TypeScript · TanStack Start/Router · Zustand · Vitest · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro

**Spec:** `docs/superpowers/specs/2026-07-28-publish-preview-gate-design.md`

## Global Constraints

- **Stay inside the project folder:** `/Users/joellopez/Dev/projects/buildout/prototypes/suite-prototype`. Do not create, modify, or read files outside it. No `/tmp` — use the session scratchpad if you need a temp file.
- **Package manager is Bun.** Tests: `bun --bun run test`. Single file: `bun --bun run test <path>`.
- **`vite build` does NOT type-check.** The type gate is `bunx tsc --noEmit`. Run it before every commit.
- Vitest prints a `ReferenceError: module is not defined` line from `node_modules/react/index.js` on every run. It is **pre-existing noise, not a failure.** The gate is the `Test Files … passed` / `Tests … passed` summary.
- **All UI uses Blueprint React**, imported from the `ui` subpath: `import { Button } from "@buildoutinc/blueprint-react/ui/Button"`.
- **Icons:** FontAwesome Pro, `pro-regular` by default; `pro-duotone` **only** for `Alert` and `Banner`. Never pass `fixedWidth` to `FontAwesomeIcon` — it is deprecated in this codebase.
- On a Blueprint `Alert` with `withIcon`, the icon must be a **direct child** of `Alert` (the theme's `.alert-icon` rule only reserves the gutter).
- `Field.Label` / `Field.Description` crash at runtime unless inside a `Field` root. For detached helper text use `<div className="form-text">`.
- Do not put margin utilities on icons inside a Blueprint `Badge` — it already has flex gap.
- Styling is **Bootstrap 5 utility classes** (the Blueprint theme extends Bootstrap). No Tailwind.
- **`src/components/deals/DealMarketingEditor.tsx` is indented with TAB characters**, unlike the rest of the codebase (2 spaces). Match the file you are editing; do not reformat.
- Tests are logic-only `.test.ts` files colocated with their module. There are **zero** `.test.tsx` files in this repo — do not introduce component-rendering tests.
- **Do not merge, push, or open PRs.** Leave the branch as-is. Commit only.
- Branch: `joel/polish-4`.

---

### Task 1: Derived photo gallery

Photos are not modeled on `Listing`. This derives a deterministic gallery from the existing curated CRE photo pool so the preview (and the Media tab) have real imagery.

**Files:**
- Modify: `src/components/properties/propertyDisplay.ts` (add after `getPhotoUrl`, currently ends line 149)
- Create: `src/components/properties/listingGallery.test.ts`
- Modify: `src/components/listings/ListingMedia.tsx`

**Interfaces:**
- Consumes: existing `hash(s: string): number`, `CRE_PHOTO_IDS: string[]`, `crePhotoUrl(photoId: string, w?: number, h?: number): string`, and `getPhotoUrl(id: string, w?: number, h?: number): string` — all already exported from `propertyDisplay.ts`.
- Produces: `listingGallery(id: string, count?: number, w?: number, h?: number): string[]` — array of `count` distinct photo URLs; index 0 always equals `getPhotoUrl(id, w, h)`.

- [ ] **Step 1: Write the failing test**

Create `src/components/properties/listingGallery.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  listingGallery,
  getPhotoUrl,
  CRE_PHOTO_IDS,
} from "./propertyDisplay";

describe("listingGallery", () => {
  it("returns the requested number of photos", () => {
    expect(listingGallery("deal-1", 5)).toHaveLength(5);
  });

  it("defaults to 5 photos", () => {
    expect(listingGallery("deal-1")).toHaveLength(5);
  });

  it("leads with the deal's existing hero photo", () => {
    // The gallery must agree with the thumbnail shown everywhere else.
    expect(listingGallery("deal-1", 5, 480, 280)[0]).toBe(
      getPhotoUrl("deal-1", 480, 280),
    );
  });

  it("is deterministic for the same id", () => {
    expect(listingGallery("deal-1", 5)).toEqual(listingGallery("deal-1", 5));
  });

  it("returns distinct photos", () => {
    const photos = listingGallery("deal-1", 5);
    expect(new Set(photos).size).toBe(5);
  });

  it("caps at the size of the photo pool", () => {
    const photos = listingGallery("deal-1", CRE_PHOTO_IDS.length + 10);
    expect(photos).toHaveLength(CRE_PHOTO_IDS.length);
  });

  it("passes width and height through to the photo URL", () => {
    expect(listingGallery("deal-1", 1, 120, 90)[0]).toContain("w=120");
    expect(listingGallery("deal-1", 1, 120, 90)[0]).toContain("h=90");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test src/components/properties/listingGallery.test.ts`
Expected: FAIL — `listingGallery` is not exported from `./propertyDisplay`.

- [ ] **Step 3: Implement `listingGallery`**

Append to `src/components/properties/propertyDisplay.ts`, directly after `getPhotoUrl`:

```ts
/**
 * A deterministic photo gallery for a listing. Photos aren't modeled on
 * `Listing`, so this derives one from the curated CRE pool: it starts at the
 * deal's own hero photo (so the gallery agrees with the thumbnail shown on
 * cards, including pinned story properties) and walks the pool from there.
 */
export function listingGallery(
  id: string,
  count = 5,
  w = 480,
  h = 280,
): string[] {
  const hero = pinnedPhotoResolver?.(id) ?? CRE_PHOTO_IDS[hash(id) % CRE_PHOTO_IDS.length];
  const start = CRE_PHOTO_IDS.indexOf(hero);
  // A pinned photo may live outside the pool — keep it first, then fill.
  const rest = CRE_PHOTO_IDS.filter((p) => p !== hero);
  const ordered =
    start === -1
      ? [hero, ...rest]
      : [hero, ...rest.slice(start), ...rest.slice(0, start)];
  return ordered.slice(0, Math.min(count, ordered.length)).map((p) => crePhotoUrl(p, w, h));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test src/components/properties/listingGallery.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Point the Media tab at the gallery**

Replace the whole body of `src/components/listings/ListingMedia.tsx`:

```tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload } from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import type { Listing } from "#/data/types";
import { listingGallery } from "#/components/properties/propertyDisplay";
import { ListingPageHeader } from "./ListingPageHeader";

/**
 * Media library for a listing. Uploads aren't modeled yet — the gallery is
 * derived from the listing id (see `listingGallery`) so it matches the photos
 * shown on the deal card and in the publish preview.
 */
export function ListingMedia({ listing }: { listing: Listing }) {
  const photos = listingGallery(listing.id, 8, 480, 280);

  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader
        title="Media"
        actions={
          <Button variant="outline">
            <FontAwesomeIcon icon={faUpload} />
            Upload Media
          </Button>
        }
      />

      <div className="row g-3">
        {photos.map((src) => (
          <div key={src} className="col-6 col-md-4 col-xl-3">
            <img
              src={src}
              alt=""
              className="w-100 rounded border"
              style={{ aspectRatio: "4 / 3", objectFit: "cover" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Check `ListingPageHeader` accepts an `actions` prop — `ListingWebsite.tsx:34-40` already passes one, so it does.

- [ ] **Step 6: Type-check and run the full suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: tsc silent (exit 0); all test files pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/properties/propertyDisplay.ts src/components/properties/listingGallery.test.ts src/components/listings/ListingMedia.tsx
git commit -m "feat(listings): derive a photo gallery for listings

Photos aren't modeled on Listing, so derive a deterministic gallery from
the curated CRE pool, led by the deal's existing hero photo. The Media tab
renders it instead of claiming no media exists.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The publish preview model

The pure logic the whole feature rests on: what the preview shows and what counts as a gap.

**Files:**
- Modify: `src/data/stageGates.ts` (export `fieldSatisfied`, currently private at line 333)
- Create: `src/data/publishPreview.ts`
- Create: `src/data/publishPreview.test.ts`

**Interfaces:**
- Consumes: `listingGallery` (Task 1); from `stageGates.ts` — `fieldSatisfied(field: RequiredField, form: GateFormState): boolean`, `REQUIRED_FIELD_LABEL: Record<RequiredField, string>`, `seedGateForm(deal: Listing): GateFormState`, types `RequiredField` / `GateFormState`.
- Produces: `buildPublishPreview(deal, property, form): PublishPreviewModel` and the types `PreviewRowStatus`, `PreviewRow`, `PreviewSection`, `PublishPreviewModel` (exact shapes in Step 3).

- [ ] **Step 1: Write the failing test**

Create `src/data/publishPreview.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Listing, Property } from "./types";
import { seedGateForm } from "./stageGates";
import { buildPublishPreview } from "./publishPreview";

/** Minimal Listing stub covering only what buildPublishPreview reads. */
function dealStub(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "deal-1",
    name: "123 Main St",
    dealType: "Sale",
    dealSide: "seller",
    status: "proposal",
    propertyId: "prop-1",
    sellerContactIds: [],
    buyerContactIds: [],
    tenantContactIds: [],
    documents: [],
    internalBrokers: [],
    marketing: {
      saleTitle: "Prime Retail Pad",
      saleDescription: "Corner lot with drive-thru",
      leaseTitle: "",
      leaseDescription: "",
      availableSqFt: 0,
      propertyUse: "Retail",
      spaceLeaseTerms: [],
    },
    financials: { askingPrice: 1_950_000 },
    transaction: {
      listedOnDate: "2026-07-01",
      listingExpirationDate: "2026-12-31",
      salePrice: 0,
      commissionAmount: 0,
      commissionPct: 0,
      closeProbability: 20,
      contractExecutedDate: null,
      closeDate: null,
      leaseCommencementDate: null,
      deadReason: null,
    },
    ...overrides,
  } as unknown as Listing;
}

const property = {
  id: "prop-1",
  street: "123 Main St",
  city: "Chicago",
  state: "IL",
} as unknown as Property;

function build(deal: Listing) {
  return buildPublishPreview(deal, property, seedGateForm(deal));
}

function contentRows(deal: Listing) {
  return build(deal).sections.find((s) => s.id === "content")!.rows;
}

function row(deal: Listing, label: string) {
  return contentRows(deal).find((r) => r.label === label);
}

describe("buildPublishPreview", () => {
  it("puts the property address in the deal section", () => {
    const deal = build(dealStub());
    const rows = deal.sections.find((s) => s.id === "deal")!.rows;
    expect(rows.find((r) => r.label === "Property")?.value).toBe(
      "123 Main St, Chicago, IL",
    );
  });

  it("marks a fully populated sale deal as having no gaps", () => {
    expect(contentRows(dealStub()).every((r) => r.status === "ok")).toBe(true);
  });

  it("shows the asking price row for a sale deal", () => {
    expect(row(dealStub(), "Asking price")?.status).toBe("ok");
    expect(row(dealStub(), "Lease rate")).toBeUndefined();
  });

  it("shows lease rate and available SF instead for a lease deal", () => {
    const lease = dealStub({
      dealType: "Lease",
      marketing: {
        ...dealStub().marketing,
        leaseTitle: "Suite 200",
        leaseDescription: "Second floor suite",
        availableSqFt: 2400,
        spaceLeaseTerms: [{ leaseRate: 28, leaseRateUnits: "SF/Yr" }],
      },
    } as Partial<Listing>);
    expect(row(lease, "Lease rate")?.status).toBe("ok");
    expect(row(lease, "Available SF")?.status).toBe("ok");
    expect(row(lease, "Asking price")).toBeUndefined();
  });

  it("flags a missing listing title", () => {
    const deal = dealStub({
      marketing: { ...dealStub().marketing, saleTitle: "" },
    } as Partial<Listing>);
    const titleRow = row(deal, "Listing title");
    expect(titleRow?.status).toBe("missing");
    expect(titleRow?.value).toBeNull();
    expect(titleRow?.field).toBe("saleTitle");
  });

  it("flags a missing listing description", () => {
    const deal = dealStub({
      marketing: { ...dealStub().marketing, saleDescription: "" },
    } as Partial<Listing>);
    expect(row(deal, "Listing description")?.status).toBe("missing");
  });

  it("flags a missing asking price", () => {
    const deal = dealStub({ financials: { askingPrice: 0 } } as Partial<Listing>);
    expect(row(deal, "Asking price")?.status).toBe("missing");
  });

  it("carries the derived photo gallery", () => {
    expect(build(dealStub()).photos).toHaveLength(5);
  });

  it("passes deal documents through", () => {
    const deal = dealStub({
      documents: [
        { id: "d1", name: "Listing Agreement — Signed.pdf", uploadedAt: "2026-07-01" },
        { id: "d2", name: "BOV.pdf", uploadedAt: "2026-07-02", aiGenerated: true },
      ],
    } as Partial<Listing>);
    expect(build(deal).documents.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("represents an empty document list rather than dropping it", () => {
    expect(build(dealStub({ documents: [] } as Partial<Listing>)).documents).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test src/data/publishPreview.test.ts`
Expected: FAIL — cannot resolve `./publishPreview`.

- [ ] **Step 3: Export `fieldSatisfied`, then write the model**

In `src/data/stageGates.ts` line 333, change the declaration only:

```ts
export function fieldSatisfied(field: RequiredField, form: GateFormState): boolean {
```

Create `src/data/publishPreview.ts`:

```ts
import type { DealDocument, Listing, Property } from './types'
import { fieldSatisfied, REQUIRED_FIELD_LABEL, type GateFormState, type RequiredField } from './stageGates'
import { listingGallery } from '#/components/properties/propertyDisplay'

export type PreviewRowStatus = 'ok' | 'missing'

export interface PreviewRow {
  label: string
  /** Display value, or null when not set. */
  value: string | null
  status: PreviewRowStatus
  /** Set when this row corresponds to a gating publish requirement. */
  field?: RequiredField
}

/** Row-based sections only. Photos and documents are separate model fields. */
export interface PreviewSection {
  id: 'deal' | 'content'
  title: string
  rows: PreviewRow[]
}

export interface PublishPreviewModel {
  sections: PreviewSection[]
  /** Resolved photo URLs for the gallery strip. */
  photos: string[]
  documents: DealDocument[]
}

/** A row for a gating requirement — status and value both derive from the form. */
function gatedRow(
  field: RequiredField,
  form: GateFormState,
  value: string | null,
  label = REQUIRED_FIELD_LABEL[field],
): PreviewRow {
  const ok = fieldSatisfied(field, form)
  return { label, value: ok ? value : null, status: ok ? 'ok' : 'missing', field }
}

/** A plain context row — never gates. */
function infoRow(label: string, value: string | null): PreviewRow {
  return { label, value, status: 'ok' }
}

function money(value: number | null): string | null {
  return value == null ? null : `$${value.toLocaleString()}`
}

/**
 * The listing as it will appear once published: the deal context, the marketing
 * content that gates the publish, the derived photo gallery, and the documents
 * on the deal. Row status uses `stageGates.fieldSatisfied`, so "missing" here
 * and "missing" in the gate are the same rule.
 */
export function buildPublishPreview(
  deal: Listing,
  property: Property | undefined,
  form: GateFormState,
): PublishPreviewModel {
  const isLease = deal.dealType === 'Lease'

  const address = property
    ? [property.street, property.city, property.state].filter(Boolean).join(', ')
    : deal.name

  const dealSection: PreviewSection = {
    id: 'deal',
    title: 'Deal',
    rows: [
      infoRow('Property', address),
      infoRow('Side', deal.dealSide === 'seller' ? 'Sell-side' : 'Buy-side'),
      infoRow('Deal type', deal.dealType),
    ],
  }

  const contentRows: PreviewRow[] = [
    gatedRow('saleTitle', form, form.saleTitle || null, 'Listing title'),
    gatedRow('saleDescription', form, form.saleDescription || null, 'Listing description'),
  ]

  if (isLease) {
    contentRows.push(
      gatedRow(
        'leaseRate',
        form,
        form.leaseRate == null ? null : `$${form.leaseRate.toLocaleString()} ${form.leaseRateUnits}`,
        'Lease rate',
      ),
      gatedRow(
        'availableSqFt',
        form,
        form.availableSqFt == null ? null : `${form.availableSqFt.toLocaleString()} SF`,
        'Available SF',
      ),
    )
  } else {
    contentRows.push(gatedRow('askingPrice', form, money(form.askingPrice), 'Asking price'))
  }

  contentRows.push(infoRow('Property use', deal.marketing.propertyUse ?? null))

  return {
    sections: [dealSection, { id: 'content', title: 'Listing content', rows: contentRows }],
    photos: listingGallery(deal.id, 5, 480, 280),
    documents: deal.documents ?? [],
  }
}
```

Note the labels passed explicitly ("Listing title", "Asking price") — `REQUIRED_FIELD_LABEL` already matches for most, but passing them keeps the preview's copy independent of the gate's terse indicator labels.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test src/data/publishPreview.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Type-check and run the full suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: tsc silent; all files pass.

- [ ] **Step 6: Commit**

```bash
git add src/data/publishPreview.ts src/data/publishPreview.test.ts src/data/stageGates.ts
git commit -m "feat(deals): model the publish preview

Turn a listing plus the gate's working form into typed sections of ok/missing
rows, a photo gallery, and the deal's documents. Row status reuses
stageGates.fieldSatisfied so 'missing' keeps one definition.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The preview view

**Files:**
- Create: `src/components/deals/PublishPreview.tsx`

**Interfaces:**
- Consumes: `buildPublishPreview`, `PublishPreviewModel`, `PreviewRow` (Task 2); `GateFormState` from `#/data/stageGates`.
- Produces: `<PublishPreview>` with this exact prop contract, consumed by Task 4:

```ts
interface PublishPreviewProps {
  deal: Listing
  property: Property | undefined
  form: GateFormState
  /** AI-generated document ids the broker has ticked as reviewed. */
  reviewedDocIds: Set<string>
  onToggleReviewed: (docId: string, reviewed: boolean) => void
  /** Renders the two listing-date pickers, supplied by StageGate. */
  dateFields: ReactNode
}
```

No test file — this is presentation, and the repo has no `.test.tsx` convention. Its logic lives in Task 2 where it is tested.

- [ ] **Step 1: Create the component**

Create `src/components/deals/PublishPreview.tsx`:

```tsx
import type { ReactNode } from "react";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFile, faImages, faSparkle } from "@fortawesome/pro-regular-svg-icons";
import { faTriangleExclamation } from "@fortawesome/pro-duotone-svg-icons";
import type { Listing, Property } from "#/data/types";
import type { GateFormState } from "#/data/stageGates";
import { buildPublishPreview, type PreviewRow } from "#/data/publishPreview";

function Row({ row }: { row: PreviewRow }) {
  const missing = row.status === "missing";
  return (
    <>
      <dt className="col-4 fw-normal text-muted">{row.label}</dt>
      <dd className={`col-8 mb-1 ${missing ? "text-warning-emphasis" : ""}`}>
        {missing ? (
          <span className="d-inline-flex align-items-center gap-2">
            <span className="fst-italic">Not set</span>
            {/* Badge supports only primary | secondary | outline. */}
            <Badge variant="outline">Required</Badge>
          </span>
        ) : (
          (row.value ?? "—")
        )}
      </dd>
    </>
  );
}

/**
 * The listing as it will appear once published — shown in place of the publish
 * gate's field form. Content gaps are surfaced as flagged rows the broker fixes
 * in the marketing editor; the document-review attestation and the listing dates
 * stay actionable here, since neither has an editor equivalent.
 */
export function PublishPreview({
  deal,
  property,
  form,
  reviewedDocIds,
  onToggleReviewed,
  dateFields,
}: {
  deal: Listing;
  property: Property | undefined;
  form: GateFormState;
  reviewedDocIds: Set<string>;
  onToggleReviewed: (docId: string, reviewed: boolean) => void;
  dateFields: ReactNode;
}) {
  const model = buildPublishPreview(deal, property, form);
  const gaps = model.sections.flatMap((s) =>
    s.rows.filter((r) => r.status === "missing"),
  );

  return (
    <div className="d-flex flex-column gap-3">
      {gaps.length > 0 && (
        <Alert severity="warning" withIcon>
          {/* `withIcon` only reserves the gutter — the icon must be a direct child. */}
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <Alert.Title>
            {gaps.length} {gaps.length === 1 ? "item needs" : "items need"} attention
            before this goes live
          </Alert.Title>
          {gaps.map((g) => g.label).join(", ")}
        </Alert>
      )}

      {model.sections.map((section) => (
        <div key={section.id} className="border rounded p-3 bg-body-tertiary">
          <div className="fw-semibold mb-2">{section.title}</div>
          <dl className="row g-0 mb-0">
            {section.rows.map((row) => (
              <Row key={row.label} row={row} />
            ))}
          </dl>
        </div>
      ))}

      <div className="border rounded p-3 bg-body-tertiary">
        <div className="fw-semibold mb-2 d-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faImages} className="text-muted" />
          Photos
          <span className="text-muted fw-normal fs-small">
            {model.photos.length}
          </span>
        </div>
        <div className="d-flex gap-2 overflow-x-auto">
          {model.photos.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              className="rounded border flex-shrink-0"
              style={{ width: 108, height: 72, objectFit: "cover" }}
            />
          ))}
        </div>
      </div>

      <div className="border rounded p-3 bg-body-tertiary">
        <div className="fw-semibold mb-2 d-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faFile} className="text-muted" />
          Documents
        </div>
        {model.documents.length === 0 ? (
          <div className="text-muted">No documents on this deal.</div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {model.documents.map((doc) =>
              doc.aiGenerated ? (
                <label
                  key={doc.id}
                  className="d-flex align-items-center gap-2 mb-0"
                  style={{ cursor: "pointer" }}
                >
                  <Checkbox
                    checked={reviewedDocIds.has(doc.id)}
                    onCheckedChange={(c) => onToggleReviewed(doc.id, c === true)}
                  />
                  <span className="flex-grow-1">{doc.name}</span>
                  <Badge variant="secondary">
                    <FontAwesomeIcon icon={faSparkle} />
                    Review
                  </Badge>
                </label>
              ) : (
                <div key={doc.id} className="d-flex align-items-center gap-2">
                  <span className="flex-grow-1">{doc.name}</span>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {dateFields}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `bunx tsc --noEmit`
Expected: silent (exit 0).

`Badge`'s only variants are `primary | secondary | outline` (verified in `node_modules/@buildoutinc/blueprint-react/src/components/Badge/index.tsx:9`) — the code above already uses valid ones. Do not add a custom class to fake a warning colour.

- [ ] **Step 3: Run the full suite**

Run: `bun --bun run test`
Expected: all files pass (no new tests here; this confirms nothing regressed).

- [ ] **Step 4: Commit**

```bash
git add src/components/deals/PublishPreview.tsx
git commit -m "feat(deals): add the publish preview view

Renders the preview model as listing content, a photo strip, and the deal's
documents, with the AI-document review attestation inline.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Delegate the publish gate to the preview

**Files:**
- Modify: `src/components/deals/StageGate.tsx` (body around lines 401-522; footer at 737-742)

**Interfaces:**
- Consumes: `<PublishPreview>` (Task 3).
- Produces: no new exports. `StageGate`'s existing props are unchanged.

- [ ] **Step 1: Import the preview and Link**

Add to the imports at the top of `src/components/deals/StageGate.tsx`:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { PublishPreview } from "#/components/deals/PublishPreview";
```

- [ ] **Step 2: Extract the date fields into a variable**

Inside `StageGate`, after `const confirmable = canConfirm(config, effectiveForm);` (line 352), add:

```tsx
  // The publish preview keeps the two listing dates interactive — they're the
  // AI-extracted values a broker should confirm at the publish moment.
  const listingDateFields = (
    <div className="d-flex flex-column gap-3">
      <Field>
        <Field.Label>Listing Executed</Field.Label>
        <GateDatePicker
          value={form.listedOnDate}
          onChange={(v) => set("listedOnDate", v)}
          placeholder="Pick a date"
        />
      </Field>
      <Field>
        <Field.Label>Listing Expires</Field.Label>
        <GateDatePicker
          value={form.listingExpirationDate}
          onChange={(v) => set("listingExpirationDate", v)}
          placeholder="Pick a date"
        />
      </Field>
      {aiDatesFromAgreement && (
        <div className="ai-draft">
          <FontAwesomeIcon icon={faSparkle} className="ai-draft__icon" />
          AI pulled the executed and expiration dates from {agreementDoc.name} —
          review before publishing.
        </div>
      )}
    </div>
  );
```

- [ ] **Step 3: Render the preview instead of the publish fields**

In the `Modal.Body`, replace the entire `{config.publishes && (...)}` blocks — the read-only summary block at lines 403-419 **and** the listing-content block at lines 421-522 — with a single branch. The `{(config.kind === "field" || config.kind === "dead") && (` wrapper and everything after `config.publishes` (the `show("aiDocsReviewed")` block onward) stay exactly as they are, because they serve the other gates.

```tsx
              {config.publishes ? (
                <PublishPreview
                  deal={deal}
                  property={summaryProperty}
                  form={effectiveForm}
                  reviewedDocIds={reviewedDocIds}
                  onToggleReviewed={(docId, reviewed) =>
                    setReviewedDocIds((prev) => {
                      const next = new Set(prev);
                      if (reviewed) next.add(docId);
                      else next.delete(docId);
                      return next;
                    })
                  }
                  dateFields={listingDateFields}
                />
              ) : null}
```

Then guard the four blocks that follow so they no longer render on the publish path — the publish gate's document review now lives inside the preview, and its dates inside `listingDateFields`. Change these four conditions:

- `{show("aiDocsReviewed") && aiDocs.length > 0 && (` → `{!config.publishes && show("aiDocsReviewed") && aiDocs.length > 0 && (`
- `{show("listedOnDate") && (` → `{!config.publishes && show("listedOnDate") && (`
- `{show("listingExpirationDate") && (` → `{!config.publishes && show("listingExpirationDate") && (`
- `{aiDatesFromAgreement && (show("listedOnDate") || show("listingExpirationDate")) && (` → `{!config.publishes && aiDatesFromAgreement && (show("listedOnDate") || show("listingExpirationDate")) && (`

Leave `show("buyerLinked")`, `show("tenantLinked")`, `show("salePrice")`, `show("commissionAmount")`, `show("leaseTermMonths")`, `show("leaseCommencementDate")`, `show("closeDate")` and `show("deadReason")` untouched — none of them belong to a publishing gate, so they can't collide.

- [ ] **Step 4: Add the Back-to-editing footer button**

Add a navigate hook near the top of the component, beside the other hooks (before the `if (!deal || !config) return null;` early return, so hook order stays stable):

```tsx
  const navigate = useNavigate();
```

Replace the `Modal.Footer` (lines 737-742) with:

```tsx
        <Modal.Footer>
          {config.publishes ? (
            <Button
              variant="outline"
              onClick={() => {
                useStageGate.getState().setPendingPublish(deal.id);
                onOpenChange(false);
                navigate({
                  to: "/listings/$listingId/edit",
                  params: { listingId: deal.id },
                });
              }}
            >
              Back to editing
            </Button>
          ) : (
            <Modal.Close render={<Button variant="ghost">Cancel</Button>} />
          )}
          <Button variant="primary" disabled={!confirmable} onClick={commit}>
            {config.publishes ? "Approve & Publish" : "Confirm"}
          </Button>
        </Modal.Footer>
```

Add `import { useStageGate } from "#/components/deals/useStageGate";` to the imports. `setPendingPublish` is created in Task 5 — **this task will not type-check until Task 5 is done.** Do Step 5 below before committing.

Replacing the `Cancel` button on the publish path does not strip plain-cancel: Blueprint's `Modal` renders its own `btn-close` X (verified at `node_modules/@buildoutinc/blueprint-react/src/components/Modal/index.tsx:81-89`), which dismisses without navigating or setting the flag — exactly the behavior the spec asks for.

- [ ] **Step 5: Clear the flag on a successful publish**

In `commit()` (line 354), after `commitStageTransition(input);` add:

```tsx
    useStageGate.getState().clearPendingPublish();
```

- [ ] **Step 6: Stop here and complete Task 5 before type-checking**

This task and Task 5 are a single compiling unit: `StageGate` now calls store actions Task 5 adds. Proceed to Task 5, then run `bunx tsc --noEmit && bun --bun run test` and commit both together with the Task 5 message.

---

### Task 5: Always open the publish gate, and track the bail-out

**Files:**
- Modify: `src/components/deals/useStageGate.ts`
- Modify: `src/components/deals/useStageGate.test.ts` (the case at line 137)

**Interfaces:**
- Consumes: nothing new.
- Produces: on the `useStageGate` store — `pendingPublishDealId: string | null`, `setPendingPublish(dealId: string): void`, `clearPendingPublish(): void`. Consumed by Task 4 and Task 6.

- [ ] **Step 1: Write the failing tests**

In `src/components/deals/useStageGate.test.ts`, **replace** the case at line 137 (`"publishes in place with no modal when the deal is fully populated"`) with:

```ts
  it("opens the preview even when the deal is fully populated", () => {
    // Publishing always gets a review moment — this is the behavior change from
    // the 2026-07-28 publish-preview spec, reversing the earlier zero-click swap.
    const deal = fullyPublishableActive();
    requestSetupCompletion(deal.id);

    const gate = useStageGate.getState();
    expect(gate.open).toBe(true);
    expect(gate.mode).toBe("complete");
    // Nothing is published until the broker approves in the preview.
    expect(useDataStore.getState().listings.get(deal.id)?.publishedAt).toBeNull();
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe("active");
  });
```

Then append a new describe block at the end of the file:

```ts
/** A sell-side Sale deal in Pitching that satisfies every publish requirement. */
function fullyPublishableProposal(): Listing {
  const base = [...useDataStore.getState().listings.values()][0];
  const deal: Listing = {
    ...base,
    dealSide: "seller",
    dealType: "Sale",
    status: "proposal",
    publishedAt: null,
    documents: (base.documents ?? []).filter((d) => !d.aiGenerated),
    marketing: {
      ...base.marketing,
      saleTitle: "Prime Retail Pad",
      saleDescription: "Corner lot with drive-thru",
    },
    financials: { ...base.financials, askingPrice: 1_950_000 },
    transaction: {
      ...base.transaction,
      listedOnDate: "2026-07-01",
      listingExpirationDate: "2026-12-31",
    },
  };
  putDeal(deal);
  return deal;
}

describe("publish transitions always open the preview", () => {
  beforeEach(() => useStageGate.getState().close());

  it("opens the gate for Pitching -> Active even with no gaps", () => {
    const deal = fullyPublishableProposal();
    requestStageChange(deal.id, "active");

    expect(useStageGate.getState().open).toBe(true);
    expect(useStageGate.getState().targetStage).toBe("active");
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe("proposal");
  });

  it("still commits a buy-side move to Active with no gate", () => {
    const base = [...useDataStore.getState().listings.values()][0];
    putDeal({ ...base, dealSide: "buyer", status: "proposal" } as Listing);
    requestStageChange(base.id, "active");

    expect(useStageGate.getState().open).toBe(false);
    expect(useDataStore.getState().listings.get(base.id)?.status).toBe("active");
  });

  it("still commits a non-publishing forward move with no gaps", () => {
    const deal = sellSideUnderContract("2026-08-01");
    requestStageChange(deal.id, "closed");

    expect(useStageGate.getState().open).toBe(false);
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe("closed");
  });
});

describe("pendingPublishDealId", () => {
  beforeEach(() => useStageGate.getState().close());

  it("starts null", () => {
    expect(useStageGate.getState().pendingPublishDealId).toBeNull();
  });

  it("records the deal the broker bailed out of", () => {
    useStageGate.getState().setPendingPublish("deal-9");
    expect(useStageGate.getState().pendingPublishDealId).toBe("deal-9");
  });

  it("clears on demand", () => {
    useStageGate.getState().setPendingPublish("deal-9");
    useStageGate.getState().clearPendingPublish();
    expect(useStageGate.getState().pendingPublishDealId).toBeNull();
  });

  it("survives close() so the editor banner still shows", () => {
    useStageGate.getState().setPendingPublish("deal-9");
    useStageGate.getState().close();
    expect(useStageGate.getState().pendingPublishDealId).toBe("deal-9");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test src/components/deals/useStageGate.test.ts`
Expected: FAIL — `setPendingPublish is not a function`, and the publish-gate cases fail because the gate still auto-commits.

- [ ] **Step 3: Add the store fields**

In `src/components/deals/useStageGate.ts`, extend the interface:

```ts
interface StageGateState {
  open: boolean;
  dealId: string | null;
  targetStage: PropertyStatus | null;
  mode: GateMode;
  /**
   * The deal a broker bailed out of publishing to go edit. Survives `close()`
   * so the marketing editor can offer a way back into the preview.
   */
  pendingPublishDealId: string | null;
  openGate: (
    dealId: string,
    targetStage: PropertyStatus,
    mode?: GateMode,
  ) => void;
  setPendingPublish: (dealId: string) => void;
  clearPendingPublish: () => void;
  close: () => void;
}
```

And the store:

```ts
export const useStageGate = create<StageGateState>((set) => ({
  open: false,
  dealId: null,
  targetStage: null,
  mode: "transition",
  pendingPublishDealId: null,
  openGate: (dealId, targetStage, mode = "transition") =>
    set({ open: true, dealId, targetStage, mode }),
  setPendingPublish: (dealId) => set({ pendingPublishDealId: dealId }),
  clearPendingPublish: () => set({ pendingPublishDealId: null }),
  // `pendingPublishDealId` intentionally survives close — the editor banner
  // depends on it after the modal is dismissed.
  close: () =>
    set({ open: false, dealId: null, targetStage: null, mode: "transition" }),
}));
```

- [ ] **Step 4: Always open for publishing gates**

In `requestStageChange`, the forward-field-gate shortcut currently reads:

```ts
  if (config.kind === "field") {
    const form = seedGateForm(deal);
    if (unsatisfiedRequired(config, form).length === 0) {
```

Change it to skip the shortcut when the gate publishes:

```ts
  // A publishing transition ALWAYS opens the gate, gaps or not: the preview of
  // the listing about to go live is the point, not a fallback for missing data.
  // Non-publishing forward gates keep the zero-click swap.
  if (config.kind === "field" && !config.publishes) {
    const form = seedGateForm(deal);
    if (unsatisfiedRequired(config, form).length === 0) {
```

In `requestSetupCompletion`, delete the whole early-commit block:

```ts
  const form = seedGateForm(deal);
  if (unsatisfiedRequired(config, form).length === 0) {
    commitStageTransition(
      buildTransitionInput(
        config,
        form,
        deal.id,
        deal.internalBrokers[0]?.name ?? "You",
        deal.dealType,
      ),
    );
    return;
  }
```

so it always reaches `useStageGate.getState().openGate(dealId, deal.status, "complete");`.

Also delete the now-unused `const config = completeSetupGate(deal);` line above it, and remove `completeSetupGate` from the import block — `requestSetupCompletion` was its only caller in this file.

Keep the imports of `seedGateForm`, `unsatisfiedRequired`, `buildTransitionInput`, and `commitStageTransition`: `requestStageChange` still uses all four. `bunx tsc --noEmit` in Step 6 confirms.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun --bun run test src/components/deals/useStageGate.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check and run the full suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: tsc silent; **all 81+ test files pass.** If `setupIncompleteBanner.test.ts` fails, stop and report — the spec predicts it should not, because it drives `commitStageTransition` directly and only routes `requestStageChange` to the Under Contract gate.

- [ ] **Step 7: Commit Tasks 4 and 5 together**

```bash
git add src/components/deals/StageGate.tsx src/components/deals/useStageGate.ts src/components/deals/useStageGate.test.ts
git commit -m "feat(deals): show a listing preview before publishing

The publish gate now renders the listing about to go live instead of a form
of missing fields, and a publishing transition always opens it — previously a
fully-populated deal published with no confirmation at all. Bailing out records
the deal so the marketing editor can offer a way back.

Non-publishing gates keep their zero-click swap.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The return path banner

**Files:**
- Modify: `src/components/deals/DealMarketingEditor.tsx` (imports; the returned JSX starting line 437)

**Interfaces:**
- Consumes: `pendingPublishDealId`, `clearPendingPublish` (Task 5); `requestStageChange`, `requestSetupCompletion` from `#/components/deals/useStageGate`.
- Produces: nothing exported.

⚠️ **This file is indented with TAB characters.** Match it. Do not let an editor reformat the file — a whitespace-only diff across 760 lines will bury the change.

- [ ] **Step 1: Add the imports**

```tsx
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { faRocketLaunch } from "@fortawesome/pro-duotone-svg-icons";
import {
	useStageGate,
	requestStageChange,
	requestSetupCompletion,
} from "#/components/deals/useStageGate";
```

If `Alert` is already imported in this file, don't duplicate the import.

- [ ] **Step 2: Read the flag in the component**

Inside `DealMarketingEditor`, with the other hooks:

```tsx
	const pendingPublishDealId = useStageGate((s) => s.pendingPublishDealId);
	const showPublishBanner = pendingPublishDealId === listing.id;
```

- [ ] **Step 3: Render the banner**

Insert as the first child inside the outer `<div className="d-flex flex-column gap-6 p-4">` at line 438, above the "Edit Listing" heading row:

```tsx
			{showPublishBanner && (
				<Alert severity="info" withIcon>
					{/* `withIcon` only reserves the gutter — the icon must be a direct child. */}
					<FontAwesomeIcon icon={faRocketLaunch} />
					<Alert.Title>Finish up, then publish</Alert.Title>
					<div className="d-flex align-items-center justify-content-between gap-3">
						<span>
							You stepped out of the publish review to make changes. Save them,
							then head back to publish.
						</span>
						<Button
							variant="primary"
							size="sm"
							className="flex-shrink-0"
							onClick={() =>
								listing.status === "proposal"
									? requestStageChange(listing.id, "active")
									: requestSetupCompletion(listing.id)
							}
						>
							Review &amp; publish
						</Button>
					</div>
				</Alert>
			)}
```

The `status === "proposal"` branch matters: a deal still in Pitching takes the normal stage transition, while one already sitting in a live stage takes the publish-in-place path.

- [ ] **Step 4: Clear the flag when the broker cancels out of the editor**

In `save()` (line 411) leave the flag alone — they're coming back to publish. In the `Cancel` button's `back()` handler at line 428, clear it:

```tsx
				<Button
					variant="ghost"
					onClick={() => {
						useStageGate.getState().clearPendingPublish();
						back();
					}}
				>
					Cancel
				</Button>
```

- [ ] **Step 5: Type-check and run the full suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: tsc silent; all test files pass.

- [ ] **Step 6: Confirm the diff is not a reformat**

Run: `git diff --stat src/components/deals/DealMarketingEditor.tsx`
Expected: roughly 30-40 changed lines, **not** 700+. If it shows the whole file, the indentation was converted — revert with `git checkout src/components/deals/DealMarketingEditor.tsx` and redo the edit preserving tabs.

- [ ] **Step 7: Commit**

```bash
git add src/components/deals/DealMarketingEditor.tsx
git commit -m "feat(deals): offer a way back into the publish review

A broker who bails out of the publish preview to edit lands in the marketing
editor with a banner that takes them back, rather than having to find the
pipeline board again.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Verify the whole flow

No code. This is the gate before handing back.

- [ ] **Step 1: Full type-check and test run**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: tsc exit 0; every test file passes. Record the actual `Test Files` / `Tests` counts — do not claim success without them.

- [ ] **Step 2: Confirm the build compiles**

Run: `bun --bun run build`
Expected: completes without error. (Reminder: this does **not** type-check; Step 1 is the type gate.)

- [ ] **Step 3: Review the branch diff**

Run: `git log --oneline main..HEAD` and `git diff main...HEAD --stat`
Confirm: no files outside the project folder, no `routeTree.gen.ts` hand-edits, no unrelated reformatting.

- [ ] **Step 4: Ask the user to exercise the flow in the browser**

Per `CLAUDE.md`, do not use Playwright. Start the dev server (`bun --bun run dev`, http://localhost:3000) and ask the user to confirm:
1. Dragging a Pitching deal to Active opens the preview **even when nothing is missing**.
2. The preview shows listing content, a photo strip, and the deal's documents.
3. A deal with a blank title/description shows flagged rows and a disabled Publish.
4. "Back to editing" lands on the edit page with the banner, and "Review & publish" reopens the preview.
5. "Approve & Publish" publishes and moves the card, as before.
6. A lease deal shows lease rate + available SF instead of asking price.

---

## Known behavioral consequence

`src/components/contacts/ContactEngagementPanel.tsx:218` calls
`requestStageChange(deal.id, "active")` — the Rosa hero-arc "Start a Deal" beat.
After Task 5 that call opens the publish preview instead of possibly
auto-committing. This is intended (it is a publish), but it adds a modal step to
the flagship demo. Flag it to the user at handoff so it isn't a surprise mid-demo.
