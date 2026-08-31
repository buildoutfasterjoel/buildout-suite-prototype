import type { ReactNode } from "react";
import type {
  Contact,
  Property,
  UnderwritingResult,
  UnderwritingResultSection,
} from "#/data/types";
import {
  TYPE_LABELS,
  crePhotoUrl,
  galleryPhotoIds,
  getPhotoUrl,
} from "#/components/properties/propertyDisplay";
import { buildCtx, type Ctx } from "#/components/deals/underwriting/underwritingResult";
import { bovRangeText, type BovPricing } from "#/components/deals/underwriting/bovPricing";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { CURRENT_USER } from "#/data/teammates";

/**
 * The assembled BOV, as the broker previews it before sending — a cover, a
 * valuation summary, the property, whatever the underwriting run actually
 * produced, comparables, and the conclusion. It used to be the cover alone
 * under a "1 of 12" badge, which read as a stub the moment anyone scrolled.
 *
 * Every figure is derived from the property and the approved run (`buildCtx`,
 * `bovPricingFor`) rather than invented here, so the preview, the underwriting
 * section in the document editor, and the range quoted in the cover email all
 * agree. No Math.random: the same deal previews the same BOV every time.
 *
 * This is a *preview* — a screen rendering of the document, not the document
 * itself. The real pages live in `features/editor/underwritingPages.ts`, which
 * is what "Edit document" opens.
 */

// ── Formatting ────────────────────────────────────────────────────────────────

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
/** Matches `bovRangeText`'s scale, for the fallback range when there's no run. */
const short = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : `$${Math.round(n / 1_000).toLocaleString("en-US")}K`;
const pct = (d: number) => `${(d * 100).toFixed(1)}%`;
const perSf = (n: number) => `$${n.toFixed(2)}`;
const sf = (n: number) => `${Math.round(n).toLocaleString("en-US")} SF`;

/** "Mar 2025" — a comp's sale date, `months` back from today. */
function monthsAgo(months: number): string {
  const d = new Date();
  // To the 1st before stepping back, or a month-end date lands past the short
  // month it was aimed at — on the 31st, "9 months ago" prints the 10th month.
  d.setDate(1);
  d.setMonth(d.getMonth() - months);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function addressLine(property: Property): string {
  return [property.street, property.city, property.state].filter(Boolean).join(", ") +
    (property.zip ? ` ${property.zip}` : "");
}

// ── Page chrome ───────────────────────────────────────────────────────────────

/** One sheet: running header, title, body, and the page number in the footer. */
function Sheet({
  property,
  page,
  total,
  title,
  eyebrow,
  children,
}: {
  property: Property;
  page: number;
  total: number;
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section className="bov-page">
      <header className="bov-page__head">
        <span className="bov-page__head-name">{property.name}</span>
        <span className="bov-page__head-kicker">Broker Opinion of Value</span>
      </header>
      {eyebrow && <div className="bov-page__eyebrow">{eyebrow}</div>}
      <h3 className="bov-page__title">{title}</h3>
      <div className="d-flex flex-column gap-3">{children}</div>
      <footer className="bov-page__foot">
        <span>{addressLine(property)}</span>
        <span>
          Page {page} of {total}
        </span>
      </footer>
    </section>
  );
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bov-stat">
      <div className="bov-stat__label">{label}</div>
      <div className="bov-stat__value">{value}</div>
      {note && <div className="bov-stat__note">{note}</div>}
    </div>
  );
}

function FactGrid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="bov-facts">
      {rows.map(([label, value]) => (
        <div className="bov-facts__row" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <p className="bov-page__prose">{children}</p>;
}

/** A run section, rendered as its stored shape: label/value pairs or a matrix. */
function ResultSection({ section }: { section: UnderwritingResultSection }) {
  return (
    <div>
      <div className="bov-page__section-name">{section.name}</div>
      <table className="bov-table">
        {section.kind === "matrix" && section.columns && (
          <thead>
            <tr>
              {section.columns.map((c, i) => (
                <th key={c} className={i === 0 ? "" : "text-end"}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {section.rows.map((row, ri) => (
            <tr key={ri} className={row.emphasis ? "is-total" : undefined}>
              {row.cells.map((cell, ci) => (
                <td key={ci} className={ci === 0 ? "" : "text-end"}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Deterministic comparables ─────────────────────────────────────────────────

interface Comp {
  address: string;
  sqft: number;
  soldOn: string;
  price: number;
  perSf: number;
  cap: number;
}

const COMP_STREETS = ["1420 Halsted Ave", "308 Kingsbury Row", "77 Wabash Court", "915 Delmar Blvd"];
/** Fixed offsets off the subject's own basis — no randomness, stable per deal. */
const COMP_SF_FACTOR = [0.86, 1.21, 0.95, 1.34];
const COMP_PSF_FACTOR = [1.08, 0.94, 1.02, 0.89];
const COMP_CAP_DELTA = [-0.004, 0.006, 0, 0.003];
const COMP_MONTHS = [3, 7, 11, 16];

function buildComps(property: Property, c: Ctx, subjectPerSf: number): Comp[] {
  return COMP_STREETS.map((street, i) => {
    const compSqft = Math.round((c.sqft * COMP_SF_FACTOR[i]) / 100) * 100;
    const compPerSf = subjectPerSf * COMP_PSF_FACTOR[i];
    return {
      address: `${street}, ${property.city || "Chicago"}`,
      sqft: compSqft,
      soldOn: monthsAgo(COMP_MONTHS[i]),
      price: Math.round((compSqft * compPerSf) / 10_000) * 10_000,
      perSf: compPerSf,
      cap: c.cap + COMP_CAP_DELTA[i],
    };
  });
}

// ── Pages ─────────────────────────────────────────────────────────────────────

interface PageSpec {
  key: string;
  /** Rendered with its resolved page number once the full set is known. */
  render: (page: number, total: number) => ReactNode;
}

export interface BovPreviewProps {
  property: Property;
  /** The owner the BOV is prepared for — named on the cover. */
  contact: Contact;
  /** The approved run, priced. Null only if the deal somehow has no run. */
  pricing: BovPricing | null;
  /** The stored run. Its sections decide the middle of the document. */
  result: UnderwritingResult | undefined;
}

export function BovPreviewPages({ property, contact, pricing, result }: BovPreviewProps) {
  const c = buildCtx(property);
  const low = pricing?.valueLow ?? Math.round(c.price * 0.95);
  const high = pricing?.valueHigh ?? Math.round(c.price * 1.05);
  const mid = (low + high) / 2;
  const subjectPerSf = mid / c.sqft;
  const comps = buildComps(property, c, subjectPerSf);
  const compAvgPerSf = comps.reduce((sum, x) => sum + x.perSf, 0) / comps.length;
  const compAvgCap = comps.reduce((sum, x) => sum + x.cap, 0) / comps.length;
  const rangeText = pricing ? bovRangeText(pricing) : `${short(low)} – ${short(high)}`;
  const photos = galleryPhotoIds(property.id, 3);

  // Two run sections per sheet, matching how the document editor lays the same
  // sections out — a broker flipping from the preview into the editor sees the
  // same pagination.
  const sections = result?.sections ?? [];
  const sectionPages: UnderwritingResultSection[][] = [];
  for (let i = 0; i < sections.length; i += 2) sectionPages.push(sections.slice(i, i + 2));

  // The three valuation approaches, weighted to a conclusion.
  const incomeValue = c.noi / c.cap;
  const salesValue = compAvgPerSf * c.sqft;
  const concluded = incomeValue * 0.6 + salesValue * 0.3 + mid * 0.1;
  const recommended = Math.round((concluded * 1.03) / 25_000) * 25_000;

  const pages: PageSpec[] = [
    // ── Cover ────────────────────────────────────────────────────────────────
    {
      key: "cover",
      render: (page, total) => (
        <div className="bov-cover position-relative">
          <img
            src={getPhotoUrl(property.id, 1200, 640)}
            alt={property.name}
            className="bov-cover__photo"
          />
          <div className="bov-cover__band">
            <div className="bov-cover__kicker">Broker Opinion of Value</div>
            <div className="bov-cover__name">{property.name}</div>
            <div className="bov-cover__address">{addressLine(property)}</div>
            <hr className="bov-cover__rule" />
            <div className="bov-cover__meta">
              {TYPE_LABELS[property.propertyType]} Property | {sf(property.buildingSqFt)}
            </div>
            <div className="bov-cover__prepared">
              Prepared for {contactFullName(contact)} by {CURRENT_USER.name} · Confidential
            </div>
          </div>
          <span className="bov-cover__page">
            <strong>{page}</strong> of {total}
          </span>
        </div>
      ),
    },

    // ── Valuation summary ────────────────────────────────────────────────────
    {
      key: "valuation",
      render: (page, total) => (
        <Sheet
          property={property}
          page={page}
          total={total}
          eyebrow="Executive summary"
          title="Opinion of Value"
        >
          <div className="bov-headline">
            <div className="bov-headline__label">Indicated value range</div>
            <div className="bov-headline__range">{rangeText}</div>
            <div className="bov-headline__basis">
              {perSf(subjectPerSf)} / SF · {pct(c.cap)} going-in cap on {money(c.noi)} NOI
            </div>
          </div>
          <div className="bov-stats">
            <StatTile label="Net Operating Income" value={money(c.noi)} note="In-place, T-12 basis" />
            <StatTile label="Going-In Cap Rate" value={pct(c.cap)} note="Subject, at midpoint" />
            <StatTile label="Price / SF" value={perSf(subjectPerSf)} note={`${sf(c.sqft)} building`} />
            <StatTile label="Effective Gross Income" value={money(c.egi)} note="Net of vacancy loss" />
          </div>
          {pricing?.occupancyNote && (
            <div className="bov-callout">
              <strong>Occupancy note.</strong> The marketing materials show{" "}
              {pricing.mismatch.stated}% occupancy while the T-12 reflects{" "}
              {pricing.mismatch.actual}% — a {pricing.mismatch.gapPts}-point gap. The range
              above is underwritten to the lower in-place figure, not the marketed one.
            </div>
          )}
          <Prose>
            This opinion reflects the property's in-place income, its position in the{" "}
            {property.submarket || "local"} submarket, and recent closed sales of comparable
            assets. It is a broker's opinion prepared for the owner's planning purposes — not
            an appraisal, and not a commitment to any price or terms.
          </Prose>
        </Sheet>
      ),
    },

    // ── Property overview ────────────────────────────────────────────────────
    {
      key: "property",
      render: (page, total) => (
        <Sheet
          property={property}
          page={page}
          total={total}
          eyebrow="The asset"
          title="Property Overview"
        >
          <div className="bov-photostrip">
            {photos.map((id) => (
              <img key={id} src={crePhotoUrl(id, 420, 260)} alt="" />
            ))}
          </div>
          <FactGrid
            rows={[
              ["Property Type", TYPE_LABELS[property.propertyType]],
              ["Submarket", property.submarket || "Central Business District"],
              ["Year Built", property.yearBuilt > 0 ? String(property.yearBuilt) : "—"],
              ["Building Size", sf(c.sqft)],
              ["Lot Size", property.lotSqFt > 0 ? sf(property.lotSqFt) : sf(c.sqft * 1.8)],
              ["Stories", property.stories > 0 ? String(property.stories) : "—"],
              ["Building Class", property.buildingClass || "—"],
              ["Zoning", property.zoning || "Mixed-use (MU-2)"],
              ["Parking", property.parkingSpaces > 0 ? `${property.parkingSpaces} spaces` : "Street"],
              ["Occupancy", `${Math.round(property.occupancyPct)}%`],
            ]}
          />
          <Prose>
            The building sits in {property.city}
            {property.county ? `, ${property.county} County` : ""}, within an established{" "}
            {property.submarket || "urban"} corridor. Tenancy, systems, and deferred maintenance
            were reviewed at a desktop level for this opinion; a buyer would confirm each in
            diligence.
          </Prose>
        </Sheet>
      ),
    },

    // ── The run's own sections ───────────────────────────────────────────────
    ...sectionPages.map((group, i) => ({
      key: `sections-${i}`,
      render: (page: number, total: number) => (
        <Sheet
          property={property}
          page={page}
          total={total}
          eyebrow={sectionPages.length > 1 ? `Underwriting ${i + 1} of ${sectionPages.length}` : "Underwriting"}
          title={group.map((s) => s.name).join(" · ")}
        >
          {group.map((section) => (
            <ResultSection key={section.key} section={section} />
          ))}
        </Sheet>
      ),
    })),

    // ── Comparables ──────────────────────────────────────────────────────────
    {
      key: "comps",
      render: (page, total) => (
        <Sheet
          property={property}
          page={page}
          total={total}
          eyebrow="Market evidence"
          title="Comparable Sales"
        >
          <table className="bov-table">
            <thead>
              <tr>
                <th>Address</th>
                <th className="text-end">SF</th>
                <th className="text-end">Sold</th>
                <th className="text-end">Price</th>
                <th className="text-end">$/SF</th>
                <th className="text-end">Cap</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((comp) => (
                <tr key={comp.address}>
                  <td>{comp.address}</td>
                  <td className="text-end">{comp.sqft.toLocaleString()}</td>
                  <td className="text-end">{comp.soldOn}</td>
                  <td className="text-end">{money(comp.price)}</td>
                  <td className="text-end">{perSf(comp.perSf)}</td>
                  <td className="text-end">{pct(comp.cap)}</td>
                </tr>
              ))}
              <tr className="is-total">
                <td>Comparable set average</td>
                <td className="text-end">
                  {Math.round(
                    comps.reduce((s, x) => s + x.sqft, 0) / comps.length,
                  ).toLocaleString()}
                </td>
                <td className="text-end">—</td>
                <td className="text-end">—</td>
                <td className="text-end">{perSf(compAvgPerSf)}</td>
                <td className="text-end">{pct(compAvgCap)}</td>
              </tr>
              <tr className="is-subject">
                <td>Subject — {property.name}</td>
                <td className="text-end">{c.sqft.toLocaleString()}</td>
                <td className="text-end">—</td>
                <td className="text-end">{money(mid)}</td>
                <td className="text-end">{perSf(subjectPerSf)}</td>
                <td className="text-end">{pct(c.cap)}</td>
              </tr>
            </tbody>
          </table>
          <Prose>
            The set brackets the subject on both size and price per square foot. The subject
            underwrites {perSf(Math.abs(subjectPerSf - compAvgPerSf))} / SF{" "}
            {subjectPerSf >= compAvgPerSf ? "above" : "below"} the comparable average, which the
            in-place rent roll and the building's condition support.
          </Prose>
        </Sheet>
      ),
    },

    // ── Conclusion ───────────────────────────────────────────────────────────
    {
      key: "conclusion",
      render: (page, total) => (
        <Sheet
          property={property}
          page={page}
          total={total}
          eyebrow="Reconciliation"
          title="Valuation Conclusion"
        >
          <table className="bov-table">
            <thead>
              <tr>
                <th>Approach</th>
                <th className="text-end">Indicated Value</th>
                <th className="text-end">Weight</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Income capitalization</td>
                <td className="text-end">{money(incomeValue)}</td>
                <td className="text-end">60%</td>
              </tr>
              <tr>
                <td>Sales comparison</td>
                <td className="text-end">{money(salesValue)}</td>
                <td className="text-end">30%</td>
              </tr>
              <tr>
                <td>Price per square foot</td>
                <td className="text-end">{money(mid)}</td>
                <td className="text-end">10%</td>
              </tr>
              <tr className="is-total">
                <td>Concluded value</td>
                <td className="text-end">{money(concluded)}</td>
                <td className="text-end">—</td>
              </tr>
            </tbody>
          </table>
          <div className="bov-headline bov-headline--compact">
            <div className="bov-headline__label">Recommended list price</div>
            <div className="bov-headline__range">{money(recommended)}</div>
            <div className="bov-headline__basis">
              Range of {rangeText} · 90–120 day marketing period
            </div>
          </div>
          <div>
            <div className="bov-page__section-name">Recommended next steps</div>
            <ol className="bov-steps">
              <li>Confirm the in-place rent roll and expense actuals against the T-12.</li>
              <li>Resolve outstanding capital items so they price as known, not as risk.</li>
              <li>
                Approve a marketing plan and go to a targeted buyer list before a broad launch.
              </li>
            </ol>
          </div>
          <div className="bov-signoff">
            <div>
              Prepared by <strong>{CURRENT_USER.name}</strong>, {CURRENT_USER.role} ·{" "}
              {CURRENT_USER.company ?? "Buildout"}
            </div>
            <div>{CURRENT_USER.email}</div>
            <div className="mt-1">
              Confidential — prepared for {contactFullName(contact)}. This is a broker's
              opinion of value, not an appraisal.
            </div>
          </div>
        </Sheet>
      ),
    },
  ];

  return (
    <div className="bov-doc">
      {pages.map((p, i) => (
        <div key={p.key}>{p.render(i + 1, pages.length)}</div>
      ))}
    </div>
  );
}
