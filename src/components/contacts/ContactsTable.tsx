import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisVertical,
  faUsers,
  faFolderOpen,
  faArrowUp,
  faArrowDown,
  faTableColumns,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import {
  RELATIONSHIP_DISPLAY,
  DEAL_STAGE_DISPLAY,
  NO_DEAL_STAGE,
  PHONE_STATUS_DOT,
  contactFullName,
  contactInitials,
} from "#/components/contacts/contactDisplay";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";
import { activeDealCountsByContact } from "#/data/selectors";
import { useDataStore } from "#/data/dataStore";

/**
 * Blueprint's `.sticky-cell` hardcodes `left: 0`, so freezing the checkbox +
 * contact columns together requires a fixed checkbox width and offsetting the
 * contact column's `left` by that width.
 */
const CHECKBOX_COL_W = 44;

type SortDir = "asc" | "desc";

/** A soft, borderless status pill colored by Blueprint palette utilities. */
function Pill({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Badge
      variant="outline"
      className={`border-0 text-nowrap fw-semibold ${className}`}
    >
      {children}
    </Badge>
  );
}

/** Em dash for empty/not-applicable cells. */
function Dash() {
  return <span className="text-muted">—</span>;
}

/** A small colored dot used inline before a label. */
function Dot({ className, size = 8 }: { className: string; size?: number }) {
  return (
    <span
      className={`rounded-circle d-inline-block ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/** "MMM D, YYYY, h:mm AM" — the compact timestamp used in date columns. */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Tags cell: the first tag as a pill, then a "+N" overflow count. */
function TagCell({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <Dash />;
  const [first, ...rest] = tags;
  return (
    <span className="d-inline-flex align-items-center gap-1 text-nowrap">
      <Badge variant="outline" className="fw-normal">
        {first}
      </Badge>
      {rest.length > 0 && (
        <span className="fs-small text-muted">+{rest.length}</span>
      )}
    </span>
  );
}

/**
 * The optional (manage-able) columns between the frozen Contact column and the
 * frozen actions column. Order here is the render order; `defaultVisible`
 * seeds the initial visibility (the five newest columns start hidden and can be
 * switched on via the header's "Manage columns" button).
 */
/** Per-row context passed to column renderers alongside the contact. */
interface ColumnContext {
  /** Count of active (non-lost) deals the contact is a party to. */
  dealCount: number;
}

interface ContactColumn {
  id: string;
  label: string;
  defaultVisible: boolean;
  render: (c: Contact, ctx: ColumnContext) => ReactNode;
}

const CONTACT_COLUMNS: ContactColumn[] = [
  {
    id: "phone",
    label: "Phone",
    defaultVisible: true,
    render: (c) => (
      <span className="d-inline-flex align-items-center gap-2 text-nowrap">
        <Dot className={PHONE_STATUS_DOT[c.phoneStatus]} />
        <span
          className={
            c.phoneStatus === "invalid"
              ? "text-decoration-line-through text-destructive"
              : undefined
          }
        >
          {c.phone}
        </span>
      </span>
    ),
  },
  {
    id: "assignedTo",
    label: "Assigned To",
    defaultVisible: true,
    render: (c) => <span className="text-nowrap">{c.assignedTo}</span>,
  },
  {
    id: "contactStage",
    label: "Contact Stage",
    defaultVisible: true,
    render: (c) => (
      <Pill className={`contact-stage-badge contact-stage-badge--${c.relationship}`}>
        {RELATIONSHIP_DISPLAY[c.relationship].label}
      </Pill>
    ),
  },
  {
    id: "dealStage",
    label: "Deal Stage",
    defaultVisible: true,
    // Shows the contact's furthest-along deal stage. When they have more than one
    // deal, a "+N" trails it (as in the Tags cell) for the remaining deals.
    render: (c, { dealCount }) => {
      const stage = c.dealStage ? DEAL_STAGE_DISPLAY[c.dealStage] : NO_DEAL_STAGE;
      const extra = c.dealStage ? Math.max(0, dealCount - 1) : 0;
      return (
        <span className="d-inline-flex align-items-center gap-2 text-nowrap">
          {c.dealStage && (
            <Dot className={`deal-stage-dot deal-stage-dot--${c.dealStage}`} />
          )}
          <span className={c.dealStage ? undefined : "text-muted"}>
            {stage.label}
          </span>
          {extra > 0 && <span className="fs-small text-muted">+{extra}</span>}
        </span>
      );
    },
  },
  {
    id: "company",
    label: "Company",
    defaultVisible: true,
    render: (c) => (
      <span
        className="d-inline-block text-truncate"
        style={{ maxWidth: 180 }}
        title={c.company}
      >
        {c.company}
      </span>
    ),
  },
  {
    id: "locatedIn",
    label: "Located In",
    defaultVisible: true,
    render: (c) => (
      <span className="text-nowrap">
        {c.city}, {c.state}
      </span>
    ),
  },
  {
    id: "inquiries",
    label: "Inquiries",
    defaultVisible: true,
    render: (c) =>
      c.inquiries > 0 ? (
        <Link
          to="/backoffice/contacts/$contactId"
          params={{ contactId: c.id }}
          className="d-inline-flex align-items-center gap-1 text-nowrap fw-semibold"
        >
          <FontAwesomeIcon icon={faFolderOpen} />
          {c.inquiries}
        </Link>
      ) : (
        <Dash />
      ),
  },
  {
    id: "tasks",
    label: "Tasks",
    defaultVisible: false,
    render: (c) =>
      c.openTaskCount > 0 ? <span>{c.openTaskCount}</span> : <Dash />,
  },
  {
    id: "tags",
    label: "Tags",
    defaultVisible: false,
    render: (c) => <TagCell tags={c.tags} />,
  },
  {
    id: "source",
    label: "Source",
    defaultVisible: false,
    render: (c) => <span className="text-nowrap">{c.source}</span>,
  },
  {
    id: "lastActive",
    label: "Last Active",
    defaultVisible: false,
    render: (c) =>
      c.lastContactedAt ? (
        <span className="text-nowrap">{formatDateTime(c.lastContactedAt)}</span>
      ) : (
        <span className="text-muted">Never</span>
      ),
  },
  {
    id: "createdOn",
    label: "Created On",
    defaultVisible: false,
    render: (c) => (
      <span className="text-nowrap">{formatDateTime(c.createdAt)}</span>
    ),
  },
];

const DEFAULT_VISIBLE_COLUMNS = new Set(
  CONTACT_COLUMNS.filter((col) => col.defaultVisible).map((col) => col.id),
);

export function ContactsTable({
  contacts,
  filtersActive,
  sortDir,
  onToggleSort,
  selected,
  onToggleOne,
  onToggleAll,
}: {
  contacts: Contact[];
  filtersActive: boolean;
  sortDir: SortDir;
  onToggleSort: () => void;
  selected: Set<string>;
  onToggleOne: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
}) {
  const navigate = useNavigate();
  // Active-deal counts drive the Deal Stage cell's "+N". Recomputed when the
  // listings change so the count tracks live deal mutations.
  const listings = useDataStore((s) => s.listings);
  const dealCounts = useMemo(() => activeDealCountsByContact(), [listings]);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(DEFAULT_VISIBLE_COLUMNS),
  );
  const shownColumns = CONTACT_COLUMNS.filter((col) =>
    visibleColumns.has(col.id),
  );
  const setColumnVisible = (id: string, on: boolean) =>
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const allSelected =
    contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  const someSelected = contacts.some((c) => selected.has(c.id));

  if (contacts.length === 0) {
    return (
      <Empty className="py-6">
        <Empty.Media>
          <FontAwesomeIcon icon={faUsers} aria-label="No contacts" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>No people found</Empty.Title>
          {filtersActive
            ? "No contacts match your search, filters, or selected list."
            : "Contacts you claim will appear here."}
        </Empty.Content>
      </Empty>
    );
  }

  return (
    <Table variant="sticky">
      <Table.Header sticky>
        <Table.Row>
          <Table.Head
            sticky
            style={{ left: 0, width: CHECKBOX_COL_W, minWidth: CHECKBOX_COL_W }}
          >
            <div className="position-absolute top-0 start-0 d-flex h-100 w-100 align-items-center justify-content-center">
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onCheckedChange={(c) => onToggleAll(c === true)}
                aria-label="Select all contacts"
              />
            </div>
          </Table.Head>
          <Table.Head sticky style={{ left: CHECKBOX_COL_W }}>
            <button
              type="button"
              className="btn btn-link p-0 text-reset text-decoration-none d-inline-flex align-items-center gap-1 fw-semibold"
              onClick={onToggleSort}
            >
              Contact
              <FontAwesomeIcon
                icon={sortDir === "asc" ? faArrowUp : faArrowDown}
                className="text-muted"
              />
            </button>
          </Table.Head>
          {shownColumns.map((col) => (
            <Table.Head key={col.id}>{col.label}</Table.Head>
          ))}
          <Table.Head sticky="end" aria-label="Columns">
            <Popover>
              <Popover.Trigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Manage columns"
                  >
                    <FontAwesomeIcon icon={faTableColumns} />
                  </Button>
                }
              />
              <Popover.Content align="end" style={{ minWidth: 220 }}>
                <Popover.Header className="fw-semibold">
                  Manage columns
                </Popover.Header>
                <Popover.Body className="d-flex flex-column gap-1">
                  {CONTACT_COLUMNS.map((col) => (
                    <div
                      key={col.id}
                      className="d-flex align-items-center gap-2 py-1"
                    >
                      <Checkbox
                        checked={visibleColumns.has(col.id)}
                        onCheckedChange={(v) =>
                          setColumnVisible(col.id, v === true)
                        }
                        aria-label={col.label}
                      />
                      <span
                        role="button"
                        className="flex-grow-1 text-nowrap"
                        onClick={() =>
                          setColumnVisible(col.id, !visibleColumns.has(col.id))
                        }
                      >
                        {col.label}
                      </span>
                    </div>
                  ))}
                </Popover.Body>
              </Popover.Content>
            </Popover>
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {contacts.map((contact) => {
          const fullName = contactFullName(contact);
          return (
            <Table.Row
              key={contact.id}
              className={`contacts-row${
                selected.has(contact.id) ? " table-active" : ""
              }`}
              onClick={(e) => {
                if (shouldIgnoreRowClick(e)) return;
                void navigate({
                  to: "/backoffice/contacts/$contactId",
                  params: { contactId: contact.id },
                });
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
                    checked={selected.has(contact.id)}
                    onCheckedChange={(c) => onToggleOne(contact.id, c === true)}
                    aria-label={`Select ${fullName}`}
                  />
                </div>
              </Table.Cell>

              {/* Contact */}
              <Table.Cell sticky style={{ left: CHECKBOX_COL_W }}>
                <div className="d-flex align-items-center gap-2">
                  <Avatar size="lg">
                    <Avatar.Fallback className="fw-semibold">
                      {contactInitials(contact)}
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="d-flex flex-column lh-sm">
                    <span className="d-inline-flex align-items-center gap-2 text-nowrap">
                      <Link
                        to="/backoffice/contacts/$contactId"
                        params={{ contactId: contact.id }}
                        className="row-link fw-semibold text-reset text-decoration-none"
                      >
                        {fullName}
                      </Link>
                      {contact.doNotCall && (
                        <span className="fs-xs text-destructive">
                          do not call
                        </span>
                      )}
                    </span>
                    <span className="fs-small text-muted text-nowrap">
                      {contact.email}
                    </span>
                  </div>
                </div>
              </Table.Cell>

              {shownColumns.map((col) => (
                <Table.Cell key={col.id}>
                  {col.render(contact, {
                    dealCount: dealCounts.get(contact.id) ?? 0,
                  })}
                </Table.Cell>
              ))}

              {/* Actions */}
              <Table.Cell sticky="end">
                <DropdownMenu>
                  <DropdownMenu.Trigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${fullName}`}
                      >
                        <FontAwesomeIcon icon={faEllipsisVertical} />
                      </Button>
                    }
                  />
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Item
                      onClick={() =>
                        void navigate({
                          to: "/backoffice/contacts/$contactId",
                          params: { contactId: contact.id },
                        })
                      }
                    >
                      View
                    </DropdownMenu.Item>
                    <DropdownMenu.Item>Edit</DropdownMenu.Item>
                    <DropdownMenu.Item>Add to list</DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item>Delete</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  );
}
