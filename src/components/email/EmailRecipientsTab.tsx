import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faEraser,
  faMagnifyingGlass,
  faSort,
  faSortDown,
  faSortUp,
  faUserGroupSimple,
} from "@fortawesome/pro-regular-svg-icons";
import {
  countByAction,
  formatRecipientDate,
  RECIPIENT_ACTIONS,
  type EmailRecipient,
  type RecipientAction,
} from "#/data/emailRecipients";

type SortKey = "name" | "action" | "date";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

/** Recipient roster as CSV, so the download button hands back real data. */
function downloadReport(recipients: EmailRecipient[], subject: string) {
  const rows = [
    ["Name", "Action", "Date"],
    ...recipients.map((r) => [r.name, r.action, formatRecipientDate(r.date)]),
  ];
  const csv = rows
    .map((cells) => cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${subject.replace(/[^\w]+/g, "-").toLowerCase()}-recipients.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Recipients tab: search + per-action filter chips over a sortable roster.
 * Each recipient carries one terminal action, so the chip counts partition the
 * list (see `RECIPIENT_ACTIONS`).
 */
export function EmailRecipientsTab({
  recipients,
  subject,
}: {
  recipients: EmailRecipient[];
  subject: string;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<RecipientAction>>(new Set());
  const [sort, setSort] = useState<SortState>(null);

  const counts = useMemo(() => countByAction(recipients), [recipients]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    let result = recipients.filter(
      (r) =>
        (needle === "" || r.name.toLowerCase().includes(needle)) &&
        (selected.size === 0 || selected.has(r.action)),
    );

    if (sort) {
      const { key, dir } = sort;
      result = [...result].sort((a, b) => {
        const cmp = a[key].localeCompare(b[key]);
        return dir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [recipients, search, selected, sort]);

  function toggleAction(action: RecipientAction) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(action) ? next.delete(action) : next.add(action);
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function SortableHead({ label, sortKey }: { label: string; sortKey: SortKey }) {
    const active = sort?.key === sortKey;
    return (
      <Table.Head>
        <Button
          variant="ghost"
          className="p-0 fw-semibold text-body w-100 justify-content-between"
          onClick={() => toggleSort(sortKey)}
        >
          {label}
          <FontAwesomeIcon
            icon={!active ? faSort : sort.dir === "asc" ? faSortUp : faSortDown}
            className={active ? "" : "text-muted opacity-50"}
          />
        </Button>
      </Table.Head>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      {/* Search + report download */}
      <div className="d-flex align-items-end justify-content-between gap-3 flex-wrap">
        <Field style={{ minWidth: 320 }}>
          <Field.Label>Search</Field.Label>
          <InputGroup>
            <InputGroup.Addon>
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </InputGroup.Addon>
            <Input
              type="search"
              placeholder="Search by contact name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
        </Field>

        <Button
          variant="ghost"
          onClick={() => downloadReport(rows, subject)}
          disabled={rows.length === 0}
        >
          <FontAwesomeIcon icon={faDownload} />
          Download Recipients Report
        </Button>
      </div>

      {/* Action filter chips */}
      <div className="d-flex align-items-center gap-2 flex-wrap">
        {RECIPIENT_ACTIONS.map((action) => (
          <Button
            key={action}
            size="sm"
            variant={selected.has(action) ? "primary" : "outline"}
            className="rounded-pill"
            aria-pressed={selected.has(action)}
            onClick={() => toggleAction(action)}
          >
            {action} ({counts[action]})
          </Button>
        ))}
        {selected.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            <FontAwesomeIcon icon={faEraser} />
            Clear Selected
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty className="py-6">
          <Empty.Media>
            <FontAwesomeIcon
              icon={faUserGroupSimple}
              aria-label="No recipients"
            />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No recipients found</Empty.Title>
            No recipients match your search or filters.
          </Empty.Content>
        </Empty>
      ) : (
        <Table>
          <Table.Header sticky>
            <Table.Row>
              <SortableHead label="Name" sortKey="name" />
              <SortableHead label="Action" sortKey="action" />
              <SortableHead label="Date" sortKey="date" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((r) => (
              <Table.Row key={r.contactId}>
                <Table.Cell>
                  <Link
                    to="/backoffice/contacts/$contactId"
                    params={{ contactId: r.contactId }}
                  >
                    {r.name}
                  </Link>
                </Table.Cell>
                <Table.Cell className="text-nowrap">{r.action}</Table.Cell>
                <Table.Cell className="text-nowrap">
                  {formatRecipientDate(r.date)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}
