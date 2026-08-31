import { useMemo, useState } from "react";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faEllipsisVertical,
  faPlus,
  faSliders,
  faCircleXmark,
  faCaretDown,
  faAddressBook,
  faEnvelope,
  faPhone,
} from "@fortawesome/pro-regular-svg-icons";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import type { Property } from "#/data/types";
import { getLeadsForProperty, getListing } from "#/data/store";
import { leadsForSpaceDeal } from "#/data/unitScopedMarketing";
import { LEAD_STATUSES } from "#/data/leadFacts";
import { useDataStore } from "#/data/dataStore";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";
import { startCallSession } from "#/components/call/useCallSession";
import { updateInquiry } from "#/data/actions";
import {
  ACCESS_LEVELS,
  type AccessLevel,
  REFERRAL_SOURCES,
  ROLE_LABELS,
  toInquiry,
} from "./inquiryRow";
import { InquiryFlyout } from "./InquiryFlyout";
import { ListingPageHeader } from "../listings/ListingPageHeader";

/** Visual-only filter dropdowns from the Inquiries toolbar. */
const FILTERS: { label: string; options: string[] }[] = [
  { label: "Inquiry Status", options: LEAD_STATUSES },
  { label: "Referral Source", options: REFERRAL_SOURCES },
  { label: "Waitlist Status", options: ["On Waitlist", "Not on Waitlist"] },
  { label: "Role", options: Object.values(ROLE_LABELS) },
  { label: "CA Status", options: ["Signed", "Not Signed"] },
];

const muted = <span className="text-muted">—</span>;

/**
 * Blueprint's `.sticky-cell` hardcodes `left: 0`, so freezing more than one left
 * column requires giving each a fixed width and offsetting the next column's `left`
 * by the cumulative width of the columns before it.
 */
const CHECKBOX_COL_W = 44;

/** "Inquiries" content for the property detail page — contacts interested in this listing. */
export function PropertyDetailLeads({
  property,
  dealId,
  initialSearch,
  spaceDealId,
}: {
  property: Property;
  /**
   * The deal whose page this is. Used to key an inquiry that names no space —
   * an edit has to be stored against a listing, and a building-level inquiry's
   * listing is the building's own deal.
   */
  dealId: string;
  /** Pre-fill the name search (deep link from a contact's inquiry card). */
  initialSearch?: string;
  /**
   * Scope to a single space deal's own inquirers — no fallback to
   * building-wide inquiries, unlike media. An inquiry on the building's own
   * listing is not an inquiry on this space, and showing it as one would
   * misattribute the broker's pipeline. Omitted (or null) shows the
   * property's whole inquiry library, unfiltered.
   */
  spaceDealId?: string | null;
}) {
  const [search, setSearch] = useState(initialSearch ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // The row whose detail panel is open. Held as an id, not the row object, so
  // the panel re-reads the current projection when the store changes under it.
  const [openId, setOpenId] = useState<string | null>(null);

  // Keyed on the contacts map so an inquiry that lands while this page is open
  // shows up without a navigation.
  const contacts = useDataStore((s) => s.contacts);

  // The deal's assigned seller is the broker's client, not an inquiry they
  // worked — getLeadsForProperty keeps them out of the list.
  const allLeads = useMemo(
    () => getLeadsForProperty(property.id),
    [property.id, contacts],
  );

  // Inquiries do NOT fall back to building-wide inquiries the way media does —
  // see `leadsForSpaceDeal`. Scoping happens on the raw contacts (which carry
  // `inquiredListingIds`) before the `Inquiry` projection, since that's where
  // the per-listing inquiry data actually lives; a contact who is only linked
  // to the property (not an inquirer on this space) drops out here too.
  const scopedContacts = useMemo(
    () => leadsForSpaceDeal(allLeads, spaceDealId ?? null),
    [allLeads, spaceDealId],
  );

  /**
   * The suite a contact inquired about, for the building-level table's Space
   * column — and, from the same walk, the listing that inquiry belongs to.
   *
   * The listing id matters because every edit in the panel is stored under it.
   * A suite's inquiry read from the building's list is still the *suite's*
   * inquiry: keying it to whichever page you happened to open would write two
   * records for one inquiry and let the two disagree.
   */
  const rowContext = useMemo(() => {
    const spaceLabelById = new Map<string, string>();
    const listingIdById = new Map<string, string>();
    for (const contact of scopedContacts) {
      for (const listingId of contact.inquiredListingIds ?? []) {
        const deal = getListing(listingId);
        // Only a child space deal names a unit; a building-level inquiry does not.
        if (!deal?.parentDealId) continue;
        const unit = property.units.find((u) => u.id === deal.unitId);
        if (unit) {
          spaceLabelById.set(contact.id, unit.label);
          listingIdById.set(contact.id, listingId);
          break;
        }
      }
    }
    return { spaceLabelById, listingIdById };
  }, [scopedContacts, property.units]);

  const spaceLabels = rowContext.spaceLabelById;

  const inquiries = useMemo(
    () =>
      scopedContacts.map((contact) =>
        // On a space page every row is that space's inquiry. On the building's,
        // fall back to the building's own deal for an inquiry naming no suite.
        toInquiry(
          contact,
          spaceDealId ?? rowContext.listingIdById.get(contact.id) ?? dealId,
        ),
      ),
    [scopedContacts, spaceDealId, rowContext, dealId],
  );

  // Inside the suite panel every row is that same suite, so the column would
  // repeat one value on every line — only the building-level view names it.
  const showSpaceColumn = !spaceDealId;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? inquiries.filter((l) => l.name.toLowerCase().includes(q))
      : inquiries;
  }, [inquiries, search]);

  const openInquiry = useMemo(
    () => inquiries.find((i) => i.id === openId) ?? null,
    [inquiries, openId],
  );

  const allSelected =
    filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const someSelected = filtered.some((l) => selected.has(l.id));

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const l of filtered) checked ? next.add(l.id) : next.delete(l.id);
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  return (
    <div className="d-flex flex-column gap-3 p-4" style={{ minWidth: 0 }}>
      {spaceDealId && (
        <Alert severity="info" withIcon>
          <FontAwesomeIcon icon={faCircleInfo} />
          Showing {inquiries.length} of {allLeads.length} — filtered to this
          space. The full library lives on the building.
        </Alert>
      )}
      {/* Title row */}
      <ListingPageHeader
        title="Inquiries"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <Button variant="outline">
                    Actions
                    <FontAwesomeIcon icon={faCaretDown} />
                  </Button>
                }
              />
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item>Export</DropdownMenu.Item>
                <DropdownMenu.Item>Send Email</DropdownMenu.Item>
                <DropdownMenu.Item>Add to List</DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item>Remove Selected</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
            <Button variant="primary">
              <FontAwesomeIcon icon={faPlus} />
              Add Inquiry
            </Button>
          </>
        }
      />

      {/* Filter row */}
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <div style={{ minWidth: 240 }}>
          <InputGroup>
            <InputGroup.Addon>
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </InputGroup.Addon>
            <Input
              type="search"
              placeholder="Search by name"
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
        <Button variant="outline">
          <FontAwesomeIcon icon={faSliders} />
          All Filters
        </Button>

        <div className="ms-auto d-flex align-items-center gap-2">
          <Tooltip>
            <Tooltip.Trigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Email this list"
                >
                  <FontAwesomeIcon icon={faEnvelope} />
                </Button>
              }
            />
            <Tooltip.Content>Email this list</Tooltip.Content>
          </Tooltip>
          <Tooltip>
            <Tooltip.Trigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Call this list"
                  onClick={() =>
                    startCallSession(
                      // Selected inquiries if any, otherwise everyone listed.
                      (selected.size > 0
                        ? filtered.filter((l) => selected.has(l.id))
                        : filtered
                      ).map((l) => l.id),
                      `${property.name} — Inquiries`,
                    )
                  }
                >
                  <FontAwesomeIcon icon={faPhone} />
                </Button>
              }
            />
            <Tooltip.Content>Call this list</Tooltip.Content>
          </Tooltip>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Empty className="py-6">
          <Empty.Media>
            <FontAwesomeIcon icon={faAddressBook} aria-label="No inquiries" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No inquiries yet</Empty.Title>
            {search
              ? "No inquiries match your search."
              : "Inquiries on this deal will appear here."}
          </Empty.Content>
        </Empty>
      ) : (
        <Table variant="sticky">
          <Table.Header sticky>
            <Table.Row>
              <Table.Head
                sticky
                style={{
                  left: 0,
                  width: CHECKBOX_COL_W,
                  minWidth: CHECKBOX_COL_W,
                }}
              >
                <div className="position-absolute top-0 start-0 d-flex h-100 w-100 align-items-center justify-content-center">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={!allSelected && someSelected}
                    onCheckedChange={(c) => toggleAll(c === true)}
                    aria-label="Select all inquiries"
                  />
                </div>
              </Table.Head>
              <Table.Head sticky style={{ left: CHECKBOX_COL_W }}>
                Name
              </Table.Head>
              {showSpaceColumn && <Table.Head>Space</Table.Head>}
              <Table.Head>Email</Table.Head>
              <Table.Head>Phone</Table.Head>
              <Table.Head>Added By</Table.Head>
              <Table.Head>Sale Doc Access Level</Table.Head>
              <Table.Head>Account Status</Table.Head>
              <Table.Head>Inquiry Status</Table.Head>
              <Table.Head>Link Sent</Table.Head>
              <Table.Head>Referral Source</Table.Head>
              <Table.Head>Company</Table.Head>
              <Table.Head>Role / Job Title</Table.Head>
              <Table.Head>Date Added</Table.Head>
              <Table.Head>Last Updated</Table.Head>
              <Table.Head>1031 Exchange</Table.Head>
              <Table.Head>1031 Expiration</Table.Head>
              <Table.Head sticky="end" aria-label="Actions" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filtered.map((inquiry) => (
              <Table.Row
                key={inquiry.id}
                className={`contacts-row${
                  selected.has(inquiry.id) ? " table-active" : ""
                }`}
                onClick={(e) => {
                  if (shouldIgnoreRowClick(e)) return;
                  setOpenId(inquiry.id);
                }}
              >
                <Table.Cell
                  sticky
                  style={{
                    left: 0,
                    width: CHECKBOX_COL_W,
                    minWidth: CHECKBOX_COL_W,
                  }}
                >
                  <div className="position-absolute top-0 start-0 d-flex h-100 w-100 align-items-center justify-content-center">
                    <Checkbox
                      checked={selected.has(inquiry.id)}
                      onCheckedChange={(c) => toggleOne(inquiry.id, c === true)}
                      aria-label={`Select ${inquiry.name}`}
                    />
                  </div>
                </Table.Cell>
                <Table.Cell sticky style={{ left: CHECKBOX_COL_W }}>
                  <div className="d-flex align-items-center gap-2">
                    <Avatar size="lg">
                      <Avatar.Fallback className="fw-semibold">
                        {inquiry.initials}
                      </Avatar.Fallback>
                    </Avatar>
                    {/* Not a link: the name opens the same detail panel the row
                        does. The contact record is one click further, from the
                        panel's footer. */}
                    <span className="row-link fw-semibold text-nowrap">
                      {inquiry.name}
                    </span>
                  </div>
                </Table.Cell>
                {showSpaceColumn && (
                  <Table.Cell className="text-muted">
                    {spaceLabels.get(inquiry.id) ?? "—"}
                  </Table.Cell>
                )}
                <Table.Cell>{inquiry.email}</Table.Cell>
                <Table.Cell>{inquiry.phone || muted}</Table.Cell>
                <Table.Cell>
                  <Avatar size="sm">
                    <Avatar.Fallback>{inquiry.addedBy}</Avatar.Fallback>
                  </Avatar>
                </Table.Cell>
                <Table.Cell>
                  {/* Controlled and persisted, so it agrees with the panel's
                      copy of the same field either way you change it. */}
                  <Select
                    value={inquiry.accessLevel}
                    onValueChange={(v) =>
                      updateInquiry(inquiry.id, inquiry.listingId, {
                        accessLevel: v as AccessLevel,
                      })
                    }
                  >
                    <Select.Trigger size="sm" style={{ minWidth: 120 }}>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {ACCESS_LEVELS.map((lvl) => (
                        <Select.Item key={lvl} value={lvl}>
                          {lvl}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </Table.Cell>
                <Table.Cell>
                  {inquiry.verified ? (
                    <Badge variant="secondary" appearance="muted">
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="secondary" appearance="muted">
                      <FontAwesomeIcon icon={faCircleXmark} />
                      Not Verified
                    </Badge>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <span
                    className={
                      inquiry.status === "No Status"
                        ? "text-muted text-nowrap"
                        : "text-nowrap"
                    }
                  >
                    {inquiry.status}
                  </span>
                </Table.Cell>
                <Table.Cell>{muted}</Table.Cell>
                <Table.Cell className="text-nowrap">
                  {inquiry.referralSource}
                </Table.Cell>
                <Table.Cell className="text-nowrap">
                  {inquiry.company || muted}
                </Table.Cell>
                <Table.Cell className="text-nowrap">
                  {inquiry.role || muted}
                </Table.Cell>
                <Table.Cell className="text-nowrap">
                  {inquiry.dateAdded}
                </Table.Cell>
                <Table.Cell className="text-nowrap">
                  {inquiry.lastUpdated}
                </Table.Cell>
                <Table.Cell>
                  {inquiry.exchange1031 === "--" ? muted : inquiry.exchange1031}
                </Table.Cell>
                <Table.Cell className="text-nowrap">
                  {inquiry.expiration1031 === "--"
                    ? muted
                    : inquiry.expiration1031}
                </Table.Cell>
                <Table.Cell sticky="end">
                  <DropdownMenu>
                    <DropdownMenu.Trigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${inquiry.name}`}
                        >
                          <FontAwesomeIcon icon={faEllipsisVertical} />
                        </Button>
                      }
                    />
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Item onClick={() => setOpenId(inquiry.id)}>
                        View
                      </DropdownMenu.Item>
                      <DropdownMenu.Item>Edit</DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item>Remove</DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      <InquiryFlyout
        inquiry={openInquiry}
        spaceLabel={
          openInquiry && showSpaceColumn
            ? spaceLabels.get(openInquiry.id)
            : undefined
        }
        open={openId !== null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
      />
    </div>
  );
}
