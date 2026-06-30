import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisVertical,
  faUsers,
  faFolderOpen,
  faArrowUp,
  faArrowDown,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import {
  RELATIONSHIP_DISPLAY,
  SIDE_DISPLAY,
  DEAL_STAGE_DISPLAY,
  PHONE_STATUS_DOT,
  contactFullName,
  contactInitials,
} from "#/data/contacts";

/**
 * Blueprint's `.sticky-cell` hardcodes `left: 0`, so freezing the checkbox +
 * contact columns together requires a fixed checkbox width and offsetting the
 * contact column's `left` by that width.
 */
const CHECKBOX_COL_W = 44;

type SortDir = "asc" | "desc";

/** A soft, borderless status pill colored by Blueprint palette utilities. */
function Pill({ className, children }: { className: string; children: React.ReactNode }) {
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

export function ContactsTable({
  contacts,
  filtersActive,
  selectionMode,
  sortDir,
  onToggleSort,
}: {
  contacts: Contact[];
  filtersActive: boolean;
  selectionMode: boolean;
  sortDir: SortDir;
  onToggleSort: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const allSelected =
    contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  const someSelected = contacts.some((c) => selected.has(c.id));

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of contacts) checked ? next.add(c.id) : next.delete(c.id);
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

  if (contacts.length === 0) {
    return (
      <Empty className="py-6">
        <Empty.Media>
          <FontAwesomeIcon icon={faUsers} aria-label="No contacts" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>No people found</Empty.Title>
          {filtersActive
            ? "No contacts match your search or filters."
            : "Contacts you claim will appear here."}
        </Empty.Content>
      </Empty>
    );
  }

  const contactLeft = selectionMode ? CHECKBOX_COL_W : 0;

  return (
    <Table variant="sticky" dense>
      <Table.Header sticky>
        <Table.Row>
          {selectionMode && (
            <Table.Head
              sticky
              style={{ left: 0, width: CHECKBOX_COL_W, minWidth: CHECKBOX_COL_W }}
            >
              <div className="position-absolute top-0 start-0 d-flex h-100 w-100 align-items-center justify-content-center">
                <Checkbox
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onCheckedChange={(c) => toggleAll(c === true)}
                  aria-label="Select all contacts"
                />
              </div>
            </Table.Head>
          )}
          <Table.Head sticky style={{ left: contactLeft }}>
            <button
              type="button"
              className="btn btn-link p-0 text-reset text-decoration-none d-inline-flex align-items-center gap-1 fw-semibold text-uppercase"
              onClick={onToggleSort}
            >
              Contact
              <FontAwesomeIcon
                icon={sortDir === "asc" ? faArrowUp : faArrowDown}
                className="text-muted"
              />
            </button>
          </Table.Head>
          <Table.Head>Assigned To</Table.Head>
          <Table.Head>Source</Table.Head>
          <Table.Head>Relationship</Table.Head>
          <Table.Head>Side</Table.Head>
          <Table.Head>Deal Stage</Table.Head>
          <Table.Head>Inquiries</Table.Head>
          <Table.Head>Company</Table.Head>
          <Table.Head>Phone</Table.Head>
          <Table.Head sticky="end" aria-label="Actions" />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {contacts.map((contact) => {
          const rel = RELATIONSHIP_DISPLAY[contact.relationship];
          const fullName = contactFullName(contact);
          return (
            <Table.Row key={contact.id}>
              {selectionMode && (
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
                      onCheckedChange={(c) => toggleOne(contact.id, c === true)}
                      aria-label={`Select ${fullName}`}
                    />
                  </div>
                </Table.Cell>
              )}

              {/* Contact */}
              <Table.Cell sticky style={{ left: contactLeft }}>
                <div className="d-flex align-items-center gap-2">
                  <Avatar size="sm">
                    <Avatar.Fallback className="fw-semibold">
                      {contactInitials(contact)}
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="d-flex flex-column lh-sm">
                    <span className="d-inline-flex align-items-center gap-2 text-nowrap">
                      <Link
                      to="/backoffice/contacts/$contactId"
                      params={{ contactId: contact.id }}
                      className="fw-semibold text-reset text-decoration-none"
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

              <Table.Cell className="text-nowrap">{contact.assignedTo}</Table.Cell>
              <Table.Cell className="text-nowrap">{contact.source}</Table.Cell>

              {/* Relationship */}
              <Table.Cell>
                <Pill className={rel.pillClass}>
                  <span className="d-inline-flex align-items-center gap-1">
                    <span
                      className={`rounded-circle d-inline-block ${rel.dotClass}`}
                      style={{ width: 6, height: 6 }}
                      aria-hidden="true"
                    />
                    {rel.label}
                  </span>
                </Pill>
              </Table.Cell>

              {/* Side */}
              <Table.Cell>
                {contact.side ? (
                  <Pill className={SIDE_DISPLAY[contact.side].pillClass}>
                    {SIDE_DISPLAY[contact.side].label}
                  </Pill>
                ) : (
                  <Dash />
                )}
              </Table.Cell>

              {/* Deal Stage */}
              <Table.Cell>
                {contact.dealStage ? (
                  <Pill className={DEAL_STAGE_DISPLAY[contact.dealStage].pillClass}>
                    {DEAL_STAGE_DISPLAY[contact.dealStage].label}
                  </Pill>
                ) : (
                  <Dash />
                )}
              </Table.Cell>

              {/* Inquiries */}
              <Table.Cell>
                {contact.inquiries > 0 ? (
                  <span className="d-inline-flex align-items-center gap-1 text-nowrap">
                    <FontAwesomeIcon
                      icon={faFolderOpen}
                      className="text-muted"
                    />
                    {contact.inquiries}
                  </span>
                ) : (
                  <Dash />
                )}
              </Table.Cell>

              <Table.Cell>
                <span
                  className="d-inline-block text-truncate"
                  style={{ maxWidth: 180 }}
                  title={contact.company}
                >
                  {contact.company}
                </span>
              </Table.Cell>

              {/* Phone */}
              <Table.Cell>
                <span className="d-inline-flex align-items-center gap-2 text-nowrap">
                  <span
                    className={`rounded-circle d-inline-block ${PHONE_STATUS_DOT[contact.phoneStatus]}`}
                    style={{ width: 8, height: 8 }}
                    aria-hidden="true"
                  />
                  <span
                    className={
                      contact.phoneStatus === "invalid"
                        ? "text-decoration-line-through text-destructive"
                        : undefined
                    }
                  >
                    {contact.phone}
                  </span>
                </span>
              </Table.Cell>

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
