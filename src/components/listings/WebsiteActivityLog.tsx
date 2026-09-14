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
import { getStore } from "#/data/store";
import { useDataStore } from "#/data/dataStore";
import {
  inquiredSpaceDeal,
  inquiryListingId,
} from "#/data/unitScopedMarketing";
import { toInquiry } from "#/components/properties/inquiryRow";
import { InquiryFlyout } from "#/components/properties/InquiryFlyout";
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
  // The inquirer whose detail panel is open. Held as a contact id, not the
  // projection, so the panel re-reads the current record as it is edited.
  const [openId, setOpenId] = useState<string | null>(null);

  // An edit in the panel lands on the contact record, so the log's names follow it.
  const contacts = useDataStore((s) => s.contacts);

  const events = useMemo(
    () => getListingWebsiteActivity(listing.id),
    [listing.id, contacts],
  );

  /**
   * The open row's inquiry, keyed to the listing the Inquiries page would key
   * it to — a suite's inquiry belongs to the suite even when it is opened from
   * the building's log, or the two surfaces would store rival edits.
   */
  const open = useMemo(() => {
    const contact = openId ? contacts.get(openId) : undefined;
    const property = getStore().properties.get(listing.propertyId);
    if (!contact || !property) return null;
    const spaceDeal = inquiredSpaceDeal(contact, property);
    return {
      inquiry: toInquiry(contact, inquiryListingId(contact, listing, property)),
      // Which suite they inquired about, the same as the building's Inquiries table.
      spaceLabel: property.units.find((u) => u.id === spaceDeal?.unitId)?.label,
    };
  }, [openId, contacts, listing]);

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
                    {event.performedById ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setOpenId(event.performedById!);
                        }}
                      >
                        {event.performedBy}
                      </a>
                    ) : (
                      <span className="text-muted">{event.performedBy}</span>
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

      <InquiryFlyout
        inquiry={open?.inquiry ?? null}
        spaceLabel={open?.spaceLabel}
        open={openId !== null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
      />
    </Section>
  );
}
