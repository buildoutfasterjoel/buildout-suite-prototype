import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisVertical,
  faEnvelopeOpen,
} from "@fortawesome/pro-regular-svg-icons";
import { EMAIL_STATUS_DISPLAY, TYPE_LABELS, type Email } from "#/data/emails";

/**
 * Blueprint's `.sticky-cell` hardcodes `left: 0`, so freezing more than one left
 * column requires giving each a fixed width and offsetting the next column's `left`
 * by the cumulative width of the columns before it.
 */
const CHECKBOX_COL_W = 44;

/** Colored status dot + label, matching the mock's inline status indicators. */
function StatusCell({ status }: { status: Email["status"] }) {
  const { label, dotColor } = EMAIL_STATUS_DISPLAY[status];
  return (
    <span className="d-inline-flex align-items-center gap-2 text-nowrap">
      <span
        className="rounded-circle d-inline-block"
        style={{ width: 8, height: 8, backgroundColor: dotColor }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

/** Paginated email-campaign list. Selection is local to the table. */
export function EmailsTable({
  emails,
  filtersActive,
}: {
  emails: Email[];
  filtersActive: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const allSelected =
    emails.length > 0 && emails.every((e) => selected.has(e.id));
  const someSelected = emails.some((e) => selected.has(e.id));

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of emails) checked ? next.add(e.id) : next.delete(e.id);
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

  if (emails.length === 0) {
    return (
      <Empty className="py-6">
        <Empty.Media>
          <FontAwesomeIcon icon={faEnvelopeOpen} aria-label="No emails" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>No emails found</Empty.Title>
          {filtersActive
            ? "No emails match your search or filters."
            : "Emails you create will appear here."}
        </Empty.Content>
      </Empty>
    );
  }

  return (
    <Table variant="sticky" dense>
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
                aria-label="Select all emails"
              />
            </div>
          </Table.Head>
          <Table.Head sticky style={{ left: CHECKBOX_COL_W }}>
            Status
          </Table.Head>
          <Table.Head>Campaign</Table.Head>
          <Table.Head>Subject</Table.Head>
          <Table.Head>Type</Table.Head>
          <Table.Head>Created At</Table.Head>
          <Table.Head>Last Edited</Table.Head>
          <Table.Head sticky="end" aria-label="Actions" />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {emails.map((email) => (
          <Table.Row key={email.id}>
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
                  checked={selected.has(email.id)}
                  onCheckedChange={(c) => toggleOne(email.id, c === true)}
                  aria-label={`Select ${email.campaign}`}
                />
              </div>
            </Table.Cell>
            <Table.Cell sticky style={{ left: CHECKBOX_COL_W }}>
              <StatusCell status={email.status} />
            </Table.Cell>
            <Table.Cell>
              {email.status === "sent" ? (
                <Link
                  to="/email/$emailId"
                  params={{ emailId: email.id }}
                  className="text-nowrap"
                >
                  {email.campaign}
                </Link>
              ) : (
                <span className="text-nowrap">{email.campaign}</span>
              )}
            </Table.Cell>
            <Table.Cell className="text-nowrap">{email.subject}</Table.Cell>
            <Table.Cell className="text-nowrap">
              {TYPE_LABELS[email.type]}
            </Table.Cell>
            <Table.Cell className="text-nowrap">{email.createdAt}</Table.Cell>
            <Table.Cell className="text-nowrap">
              {email.lastEditedAt}, {email.lastEditedBy}
            </Table.Cell>
            <Table.Cell sticky="end">
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${email.campaign}`}
                    >
                      <FontAwesomeIcon icon={faEllipsisVertical} />
                    </Button>
                  }
                />
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item
                    disabled={email.status !== "sent"}
                    onClick={() => {
                      if (email.status === "sent") {
                        void navigate({
                          to: "/email/$emailId",
                          params: { emailId: email.id },
                        });
                      }
                    }}
                  >
                    View
                  </DropdownMenu.Item>
                  <DropdownMenu.Item>Edit</DropdownMenu.Item>
                  <DropdownMenu.Item>Duplicate</DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item>Archive</DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
