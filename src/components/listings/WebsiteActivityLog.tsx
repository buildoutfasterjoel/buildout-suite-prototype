import { useMemo, useState } from "react";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
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
import { getListingWebsiteActivity } from "#/data/listingWebsiteActivity";
import { Section } from "./listingWidgets";

const EVENT_TYPE_OPTIONS = [
  "Page View",
  "Lead Form Submitted",
  "Document Downloaded",
  "Contact Clicked",
];
const SOURCE_OPTIONS = [
  "Direct",
  "Organic Search",
  "Email Campaign",
  "Referral",
  "LoopNet",
  "Crexi",
  "CoStar",
  "Ten-X",
  "Brevitas",
  "RCM1",
];
const DEVICE_OPTIONS = ["Desktop", "Mobile", "Tablet"];

/** Visual-only filter dropdowns from the Activity Log toolbar. */
const FILTERS = [
  { label: "Event Type", options: EVENT_TYPE_OPTIONS },
  { label: "Source", options: SOURCE_OPTIONS },
  { label: "Device", options: DEVICE_OPTIONS },
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
        e.visitor.toLowerCase().includes(q) || e.page.toLowerCase().includes(q),
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
                placeholder="Search by visitor or page"
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
                <Table.Head>Timestamp</Table.Head>
                <Table.Head>Visitor</Table.Head>
                <Table.Head>Event</Table.Head>
                <Table.Head>Page</Table.Head>
                <Table.Head>Source</Table.Head>
                <Table.Head>Device</Table.Head>
                <Table.Head>Location</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filtered.map((event) => (
                <Table.Row key={event.id}>
                  <Table.Cell className="text-nowrap">
                    {event.timestamp}
                  </Table.Cell>
                  <Table.Cell>
                    {event.visitor === "Anonymous" ? (
                      <span className="text-muted">Anonymous</span>
                    ) : (
                      event.visitor
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="secondary" appearance="muted">
                      {event.eventType}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="text-nowrap">{event.page}</Table.Cell>
                  <Table.Cell className="text-nowrap">
                    {event.source}
                  </Table.Cell>
                  <Table.Cell>{event.device}</Table.Cell>
                  <Table.Cell className="text-nowrap">
                    {event.location}
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
