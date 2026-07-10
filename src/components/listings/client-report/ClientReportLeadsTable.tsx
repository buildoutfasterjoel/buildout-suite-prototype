import { useMemo, useState } from "react";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSort,
  faSortUp,
  faSortDown,
  faAddressBook,
} from "@fortawesome/pro-regular-svg-icons";
import type { ClientReportLead } from "#/data/listingClientReport";
import { Section } from "../listingWidgets";

type SortKey = "company" | "name" | "leadStatus" | "pageViews" | "lastAction";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

const ALL = "all";

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/** Filterable, sortable leads roster with a per-row editable Notes field. */
export function ClientReportLeadsTable({ leads }: { leads: ClientReportLead[] }) {
  const [companyFilter, setCompanyFilter] = useState(ALL);
  const [lastActionFilter, setLastActionFilter] = useState(ALL);
  const [leadStatusFilter, setLeadStatusFilter] = useState(ALL);
  const [sort, setSort] = useState<SortState>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const companies = useMemo(() => uniqueSorted(leads.map((l) => l.company)), [leads]);
  const lastActions = useMemo(() => uniqueSorted(leads.map((l) => l.lastAction)), [leads]);
  const leadStatuses = useMemo(() => uniqueSorted(leads.map((l) => l.leadStatus)), [leads]);

  const rows = useMemo(() => {
    let result = leads.filter(
      (l) =>
        (companyFilter === ALL || l.company === companyFilter) &&
        (lastActionFilter === ALL || l.lastAction === lastActionFilter) &&
        (leadStatusFilter === ALL || l.leadStatus === leadStatusFilter),
    );

    if (sort) {
      const { key, dir } = sort;
      result = [...result].sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return dir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [leads, companyFilter, lastActionFilter, leadStatusFilter, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function sortIcon(key: SortKey) {
    if (sort?.key !== key) return faSort;
    return sort.dir === "asc" ? faSortUp : faSortDown;
  }

  function SortableHead({ label, sortKey }: { label: string; sortKey: SortKey }) {
    return (
      <Table.Head>
        <Button
          variant="ghost"
          className="p-0 fw-semibold text-body"
          onClick={() => toggleSort(sortKey)}
        >
          {label}
          <FontAwesomeIcon
            icon={sortIcon(sortKey)}
            className={sort?.key === sortKey ? "" : "text-muted opacity-50"}
          />
        </Button>
      </Table.Head>
    );
  }

  return (
    <Section title="Leads">
      <div className="d-flex flex-column gap-3">
        {/* Filter row */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Select value={companyFilter} onValueChange={(v) => setCompanyFilter(v ?? ALL)}>
            <Select.Trigger className="w-auto">
              <Select.Value placeholder="Company">
                {(v: string) => (v === ALL ? "All Companies" : v)}
              </Select.Value>
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={ALL}>All Companies</Select.Item>
              {companies.map((c) => (
                <Select.Item key={c} value={c}>
                  {c}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>

          <Select value={lastActionFilter} onValueChange={(v) => setLastActionFilter(v ?? ALL)}>
            <Select.Trigger className="w-auto">
              <Select.Value placeholder="Last Action">
                {(v: string) => (v === ALL ? "All Last Actions" : v)}
              </Select.Value>
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={ALL}>All Last Actions</Select.Item>
              {lastActions.map((a) => (
                <Select.Item key={a} value={a}>
                  {a}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>

          <Select value={leadStatusFilter} onValueChange={(v) => setLeadStatusFilter(v ?? ALL)}>
            <Select.Trigger className="w-auto">
              <Select.Value placeholder="Lead Status">
                {(v: string) => (v === ALL ? "All Lead Statuses" : v)}
              </Select.Value>
            </Select.Trigger>
            <Select.Content>
              <Select.Item value={ALL}>All Lead Statuses</Select.Item>
              {leadStatuses.map((s) => (
                <Select.Item key={s} value={s}>
                  {s}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <Empty className="py-6">
            <Empty.Media>
              <FontAwesomeIcon icon={faAddressBook} aria-label="No leads" />
            </Empty.Media>
            <Empty.Content>
              <Empty.Title>No leads match these filters</Empty.Title>
              Try clearing a filter to see more leads.
            </Empty.Content>
          </Empty>
        ) : (
          <Table variant="bordered" dense>
            <Table.Header>
              <Table.Row>
                <SortableHead label="Company" sortKey="company" />
                <SortableHead label="Name" sortKey="name" />
                <SortableHead label="Lead Status" sortKey="leadStatus" />
                <SortableHead label="Page Views" sortKey="pageViews" />
                <SortableHead label="Last Action" sortKey="lastAction" />
                <Table.Head>Notes</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((lead) => (
                <Table.Row key={lead.id}>
                  <Table.Cell className="text-nowrap">{lead.company}</Table.Cell>
                  <Table.Cell className="text-nowrap">{lead.name}</Table.Cell>
                  <Table.Cell className="text-nowrap">{lead.leadStatus}</Table.Cell>
                  <Table.Cell>{lead.pageViews.toLocaleString()}</Table.Cell>
                  <Table.Cell className="text-nowrap">{lead.lastAction}</Table.Cell>
                  <Table.Cell style={{ minWidth: 200 }}>
                    <Input
                      placeholder="Add a note…"
                      value={notes[lead.id] ?? ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [lead.id]: e.target.value }))
                      }
                      aria-label={`Notes for ${lead.name}`}
                    />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </Section>
  );
}
