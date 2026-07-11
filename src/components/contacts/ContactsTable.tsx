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
  DEAL_STAGE_DISPLAY,
  NO_DEAL_STAGE,
  PHONE_STATUS_DOT,
  contactFullName,
  contactInitials,
} from "#/components/contacts/contactDisplay";

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

export function ContactsTable({
  contacts,
  filtersActive,
  sortDir,
  onToggleSort,
}: {
  contacts: Contact[];
  filtersActive: boolean;
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
                onCheckedChange={(c) => toggleAll(c === true)}
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
          <Table.Head>Phone</Table.Head>
          <Table.Head>Assigned To</Table.Head>
          <Table.Head>Contact Stage</Table.Head>
          <Table.Head>Deal Stage</Table.Head>
          <Table.Head>Company</Table.Head>
          <Table.Head>Located In</Table.Head>
          <Table.Head>Inquiries</Table.Head>
          <Table.Head sticky="end" aria-label="Actions" />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {contacts.map((contact) => {
          const rel = RELATIONSHIP_DISPLAY[contact.relationship];
          const stage = contact.dealStage
            ? DEAL_STAGE_DISPLAY[contact.dealStage]
            : NO_DEAL_STAGE;
          const fullName = contactFullName(contact);
          return (
            <Table.Row key={contact.id}>
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

              {/* Phone */}
              <Table.Cell>
                <span className="d-inline-flex align-items-center gap-2 text-nowrap">
                  <Dot className={PHONE_STATUS_DOT[contact.phoneStatus]} />
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

              <Table.Cell className="text-nowrap">
                {contact.assignedTo}
              </Table.Cell>

              {/* Contact Stage (relationship) */}
              <Table.Cell>
                <Pill className={rel.pillClass}>
                  <span className="d-inline-flex align-items-center gap-1">
                    <Dot className={rel.dotClass} size={6} />
                    {rel.label}
                  </span>
                </Pill>
              </Table.Cell>

              {/* Deal Stage — dot + label, "None Active" when no deal */}
              <Table.Cell>
                <span className="d-inline-flex align-items-center gap-2 text-nowrap">
                  {contact.dealStage && <Dot className={stage.dotClass} />}
                  <span
                    className={contact.dealStage ? undefined : "text-muted"}
                  >
                    {stage.label}
                  </span>
                </span>
              </Table.Cell>

              {/* Company */}
              <Table.Cell>
                <span
                  className="d-inline-block text-truncate"
                  style={{ maxWidth: 180 }}
                  title={contact.company}
                >
                  {contact.company}
                </span>
              </Table.Cell>

              {/* Located In */}
              <Table.Cell className="text-nowrap">
                {contact.city}, {contact.state}
              </Table.Cell>

              {/* Inquiries */}
              <Table.Cell>
                {contact.inquiries > 0 ? (
                  <Link
                    to="/backoffice/contacts/$contactId"
                    params={{ contactId: contact.id }}
                    className="d-inline-flex align-items-center gap-1 text-nowrap fw-semibold"
                  >
                    <FontAwesomeIcon icon={faFolderOpen} />
                    {contact.inquiries}
                  </Link>
                ) : (
                  <Dash />
                )}
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
