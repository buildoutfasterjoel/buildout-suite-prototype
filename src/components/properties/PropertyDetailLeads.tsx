import { useMemo, useState } from "react";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faEllipsisVertical,
  faPlus,
  faSliders,
  faCircleXmark,
  faCaretDown,
  faAddressBook,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, Property } from "#/data/types";
import { getStore } from "#/data/store";
import { hash } from "./propertyDisplay";

const ACCESS_LEVELS = ["Low", "Medium", "High"] as const;
const REFERRAL_SOURCES = [
  "Website",
  "Email",
  "Direct",
  "Referral",
  "Syndication",
];
const LEAD_STATUSES = ["No Status", "New", "Engaged", "Contacted", "Qualified"];
const ADDED_BY = ["AE", "MK", "JL", "RS", "TC", "DP"];

const ROLE_LABELS: Record<Contact["role"], string> = {
  owner: "Owner",
  broker: "Broker",
  buyer: "Buyer",
  tenant: "Tenant",
  lender: "Lender",
};

/** Visual-only filter dropdowns from the Leads toolbar. */
const FILTERS: { label: string; options: string[] }[] = [
  { label: "Lead Status", options: LEAD_STATUSES },
  { label: "Referral Source", options: REFERRAL_SOURCES },
  { label: "Waitlist Status", options: ["On Waitlist", "Not on Waitlist"] },
  { label: "Role", options: Object.values(ROLE_LABELS) },
  { label: "CA Status", options: ["Signed", "Not Signed"] },
];

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  addedBy: string;
  accessLevel: (typeof ACCESS_LEVELS)[number];
  verified: boolean;
  leadStatus: string;
  referralSource: string;
  company: string;
  role: string;
  dateAdded: string;
  lastUpdated: string;
  exchange1031: string;
  expiration1031: string;
};

function fmtDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** Synthesize the lead-only columns deterministically from a contact. */
function toLead(contact: Contact): Lead {
  const h = hash(contact.id);
  const added = new Date(2026, 5, 22);
  added.setDate(added.getDate() - (h % 120));
  const updated = new Date(2026, 5, 22);
  updated.setDate(updated.getDate() - (h % 14));
  const has1031 = h % 5 === 0;
  return {
    id: contact.id,
    name: `${contact.firstName} ${contact.lastName}`,
    email: contact.email,
    phone: contact.phone,
    addedBy: ADDED_BY[h % ADDED_BY.length],
    accessLevel: ACCESS_LEVELS[h % ACCESS_LEVELS.length],
    verified: h % 3 === 0,
    leadStatus: LEAD_STATUSES[h % LEAD_STATUSES.length],
    referralSource: REFERRAL_SOURCES[h % REFERRAL_SOURCES.length],
    company: contact.company,
    role: ROLE_LABELS[contact.role],
    dateAdded: fmtDate(added),
    lastUpdated: fmtDate(updated),
    exchange1031: has1031 ? "Yes" : "--",
    expiration1031: has1031
      ? fmtDate(
          new Date(added.getFullYear() + 1, added.getMonth(), added.getDate()),
        )
      : "--",
  };
}

const muted = <span className="text-muted">--</span>;

/**
 * Blueprint's `.sticky-cell` hardcodes `left: 0`, so freezing more than one left
 * column requires giving each a fixed width and offsetting the next column's `left`
 * by the cumulative width of the columns before it.
 */
const CHECKBOX_COL_W = 44;

/** "Leads" content for the property detail page — contacts interested in this listing. */
export function PropertyDetailLeads({ property }: { property: Property }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const leads = useMemo(
    () =>
      [...getStore().contacts.values()]
        .filter((c) => c.propertyIds.includes(property.id))
        .map(toLead),
    [property.id],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? leads.filter((l) => l.name.toLowerCase().includes(q)) : leads;
  }, [leads, search]);

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
      {/* Title row */}
      <div className="d-flex align-items-center gap-3">
        <h2 className="fs-4 mb-0 flex-grow-1">Leads</h2>
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
          Add Lead
        </Button>
      </div>

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
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Empty className="py-6">
          <Empty.Media>
            <FontAwesomeIcon icon={faAddressBook} aria-label="No leads" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No leads yet</Empty.Title>
            {search
              ? "No leads match your search."
              : "Leads interested in this listing will appear here."}
          </Empty.Content>
        </Empty>
      ) : (
        <Table variant="sticky" dense>
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
                    aria-label="Select all leads"
                  />
                </div>
              </Table.Head>
              <Table.Head sticky style={{ left: CHECKBOX_COL_W }}>
                Name
              </Table.Head>
              <Table.Head>Email</Table.Head>
              <Table.Head>Phone</Table.Head>
              <Table.Head>Added By</Table.Head>
              <Table.Head>Sale Doc Access Level</Table.Head>
              <Table.Head>Account Status</Table.Head>
              <Table.Head>Lead Status</Table.Head>
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
            {filtered.map((lead) => (
              <Table.Row key={lead.id}>
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
                      checked={selected.has(lead.id)}
                      onCheckedChange={(c) => toggleOne(lead.id, c === true)}
                      aria-label={`Select ${lead.name}`}
                    />
                  </div>
                </Table.Cell>
                <Table.Cell sticky style={{ left: CHECKBOX_COL_W }}>
                  <span className="text-primary fw-semibold text-nowrap">
                    {lead.name}
                  </span>
                </Table.Cell>
                <Table.Cell>{lead.email}</Table.Cell>
                <Table.Cell>{lead.phone || muted}</Table.Cell>
                <Table.Cell>
                  <Avatar size="sm">
                    <Avatar.Fallback>{lead.addedBy}</Avatar.Fallback>
                  </Avatar>
                </Table.Cell>
                <Table.Cell>
                  <Select defaultValue={lead.accessLevel}>
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
                  {lead.verified ? (
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
                      lead.leadStatus === "No Status"
                        ? "text-muted text-nowrap"
                        : "text-nowrap"
                    }
                  >
                    {lead.leadStatus}
                  </span>
                </Table.Cell>
                <Table.Cell>{muted}</Table.Cell>
                <Table.Cell className="text-nowrap">
                  {lead.referralSource}
                </Table.Cell>
                <Table.Cell className="text-nowrap">
                  {lead.company || muted}
                </Table.Cell>
                <Table.Cell className="text-nowrap">
                  {lead.role || muted}
                </Table.Cell>
                <Table.Cell className="text-nowrap">
                  {lead.dateAdded}
                </Table.Cell>
                <Table.Cell className="text-nowrap">
                  {lead.lastUpdated}
                </Table.Cell>
                <Table.Cell>
                  {lead.exchange1031 === "--" ? muted : lead.exchange1031}
                </Table.Cell>
                <Table.Cell className="text-nowrap">
                  {lead.expiration1031 === "--" ? muted : lead.expiration1031}
                </Table.Cell>
                <Table.Cell sticky="end">
                  <DropdownMenu>
                    <DropdownMenu.Trigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${lead.name}`}
                        >
                          <FontAwesomeIcon icon={faEllipsisVertical} />
                        </Button>
                      }
                    />
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Item>View</DropdownMenu.Item>
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
    </div>
  );
}
