import { useMemo, useState } from "react";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faDownload,
  faChartLine,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import {
  ACTIVITY_FILTER_OPTIONS,
  getListingWebsiteActivity,
} from "#/data/listingWebsiteActivity";
import { Section } from "./listingWidgets";

/** Visual-only filter dropdown from the Activity Log toolbar. */
const FILTERS = [
  { label: "All User Activities", options: ACTIVITY_FILTER_OPTIONS },
];

/** Searchable/filterable log of individual visits to the listing's website. */
export function WebsiteActivityLog({ listing }: { listing: Listing }) {
  const [search, setSearch] = useState("");

  const events = useMemo(
    () => getListingWebsiteActivity(listing.id),
    [listing.id],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.performedBy.toLowerCase().includes(q) ||
        e.activity.toLowerCase().includes(q),
    );
  }, [events, search]);

  return (
    <Section
      title="Activity Log"
      action={
        <Button variant="outline">
          <FontAwesomeIcon icon={faDownload} />
          Download CSV
        </Button>
      }
    >
      <div className="d-flex flex-column gap-3">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div style={{ minWidth: 240 }}>
            <InputGroup>
              <InputGroup.Addon>
                <FontAwesomeIcon icon={faMagnifyingGlass} />
              </InputGroup.Addon>
              <Input
                type="search"
                placeholder="Search by user or activity"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
          </div>
          {FILTERS.map((f) => (
            <Select key={f.label}>
              <Select.Trigger className="w-auto">
                <Select.Value placeholder={f.label} />
              </Select.Trigger>
              <Select.Content>
                {f.options.map((opt) => (
                  <Select.Item key={opt} value={opt}>
                    {opt}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Empty className="py-6">
            <Empty.Media>
              <FontAwesomeIcon icon={faChartLine} aria-label="No activity" />
            </Empty.Media>
            <Empty.Content>
              <Empty.Title>No activity yet</Empty.Title>
              {search
                ? "No events match your search."
                : "Visits to this listing's website will appear here."}
            </Empty.Content>
          </Empty>
        ) : (
          <Table dense>
            <Table.Header>
              <Table.Row>
                <Table.Head>Performed By</Table.Head>
                <Table.Head>Performed At</Table.Head>
                <Table.Head>Activity</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filtered.map((event) => (
                <Table.Row key={event.id}>
                  <Table.Cell>
                    {event.performedBy === "Anonymous User" ? (
                      <span className="text-muted">Anonymous User</span>
                    ) : (
                      event.performedBy
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-nowrap">
                    {event.performedAt}
                  </Table.Cell>
                  <Table.Cell>{event.activity}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </Section>
  );
}
