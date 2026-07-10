import { useMemo, useState } from "react";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import {
  DEMOGRAPHIC_CATEGORIES,
  DEMOGRAPHIC_ROWS,
  getDemographicMetrics,
  type DemographicRing,
  type DemographicUnit,
} from "#/data/listingDemographics";
import { formatMoney } from "#/components/deals/dealDisplay";
import { Section } from "../listingWidgets";

function formatValue(value: number, unit: DemographicUnit): string {
  if (unit === "currency") return formatMoney(value);
  if (unit === "percent") return `${value}%`;
  return value.toLocaleString();
}

export function DemographicsTable({
  listingId,
  rings,
  refreshNonce,
  hiddenRowIds,
  onToggleRow,
}: {
  listingId: string;
  rings: DemographicRing[];
  refreshNonce: number;
  hiddenRowIds: Record<string, boolean>;
  onToggleRow: (rowId: string, hidden: boolean) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>(
    DEMOGRAPHIC_CATEGORIES[0],
  );

  const metricsByRing = useMemo(
    () =>
      Object.fromEntries(
        rings.map((ring) => [ring.id, getDemographicMetrics(listingId, ring, refreshNonce)]),
      ),
    [listingId, rings, refreshNonce],
  );

  const rows = DEMOGRAPHIC_ROWS.filter((row) => row.category === selectedCategory);

  return (
    <Section title="Demographic Data">
      <p className="text-muted mb-0" style={{ fontSize: 13 }}>
        Rows hidden here are also hidden from exported documents.
      </p>
      <div className="d-flex align-items-start gap-4">
        <Tabs
          value={selectedCategory}
          onValueChange={(v) => v && setSelectedCategory(v)}
          orientation="vertical"
        >
          <Tabs.List
            variant="pills"
            orientation="vertical"
            className="flex-shrink-0"
            style={{ width: 160 }}
          >
            {DEMOGRAPHIC_CATEGORIES.map((category) => (
              <Tabs.Tab key={category} value={category}>
                {category}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Metric</Table.Head>
                {rings.map((ring) => (
                  <Table.Head key={ring.id} className="text-end">
                    {ring.label}
                  </Table.Head>
                ))}
                <Table.Head className="text-end">Visible</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => {
                const hidden = hiddenRowIds[row.id] ?? false;
                return (
                  <Table.Row key={row.id} className={hidden ? "text-muted" : undefined}>
                    <Table.Cell>{row.label}</Table.Cell>
                    {rings.map((ring) => (
                      <Table.Cell key={ring.id} className="text-end">
                        {formatValue(metricsByRing[ring.id][row.id], row.unit)}
                      </Table.Cell>
                    ))}
                    <Table.Cell>
                      <div className="d-flex justify-content-end">
                        <Switch
                          checked={!hidden}
                          onCheckedChange={(checked) => onToggleRow(row.id, !checked)}
                          aria-label={`${hidden ? "Show" : "Hide"} ${row.label} in exported documents`}
                        />
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      </div>
    </Section>
  );
}
