import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import type { Property } from "#/data/types";
import { formatPrice, formatSqFt, formatPct } from "./propertyDisplay";

type Row = { label: string; value: string };

function group(title: string, rows: Row[]) {
  const shown = rows.filter((r) => r.value && r.value !== "—");
  if (shown.length === 0) return null;
  return { title, rows: shown };
}

export function PropertyFactsCard({ property: p }: { property: Property }) {
  const groups = [
    group("Property Information", [
      { label: "Type", value: p.propertySubtype },
      { label: "Building size", value: p.buildingSqFt > 0 ? formatSqFt(p.buildingSqFt) : "—" },
      { label: "Lot size", value: p.lotSqFt > 0 ? formatSqFt(p.lotSqFt) : "—" },
      { label: "Year built", value: p.yearBuilt > 0 ? String(p.yearBuilt) : "—" },
      { label: "Stories", value: p.stories > 0 ? String(p.stories) : "—" },
      { label: "Class", value: p.buildingClass },
    ]),
    group("Location", [
      { label: "Submarket", value: p.submarket },
      { label: "County", value: p.county },
      { label: "Zoning", value: p.zoning },
      { label: "APN", value: p.apn },
    ]),
    group("Tax", [
      { label: "Assessed value", value: p.assessedTaxValue > 0 ? formatPrice(p.assessedTaxValue) : "—" },
      { label: "Tax amount", value: p.taxAmount > 0 ? formatPrice(p.taxAmount) : "—" },
      { label: "Tax year", value: p.taxYear > 0 ? String(p.taxYear) : "—" },
    ]),
    group("Investment metrics", [
      { label: "Asking price", value: p.askingPrice > 0 ? formatPrice(p.askingPrice) : "—" },
      { label: "NOI", value: p.noi > 0 ? formatPrice(p.noi) : "—" },
      { label: "Cap rate", value: p.capRate > 0 ? formatPct(p.capRate) : "—" },
      { label: "Vacancy", value: p.vacancyRate > 0 ? formatPct(p.vacancyRate) : "—" },
    ]),
  ].filter(Boolean) as { title: string; rows: Row[] }[];

  return (
    <Card className="shadow-sm">
      <Card.Body className="d-flex flex-column gap-3">
        {groups.map((g) => (
          <div key={g.title} className="d-flex flex-column gap-1">
            <div className="text-uppercase text-muted fw-semibold fs-xs">{g.title}</div>
            {g.rows.map((r) => (
              <div key={r.label} className="d-flex justify-content-between gap-2">
                <span className="text-muted fs-small">{r.label}</span>
                <span className="fs-small fw-semibold text-end">{r.value}</span>
              </div>
            ))}
          </div>
        ))}
      </Card.Body>
    </Card>
  );
}
