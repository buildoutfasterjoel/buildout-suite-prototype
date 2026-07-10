import { useMemo, useState } from "react";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Progress } from "@buildoutinc/blueprint-react/ui/Progress";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faArrowDown,
  faArrowUpArrowDown,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import { CONTACT_LISTS } from "#/data/contactLists";

type SortDir = "asc" | "desc";
type SortKey =
  | "label"
  | "type"
  | "count"
  | "activity"
  | "reached"
  | "created"
  | "updated"
  | "updatedBy";

/** A list row with its derived contact count. */
type ListRow = (typeof CONTACT_LISTS)[number] & { count: number };

/** Format an ISO date as "Jun 26, 2026". */
function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** A sortable column header button with a direction indicator. */
function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align = "start",
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "start" | "end";
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`btn btn-link p-0 text-reset text-decoration-none d-inline-flex align-items-center gap-1 fw-semibold text-uppercase w-100 justify-content-${align}`}
    >
      {label}
      <FontAwesomeIcon
        icon={active ? (dir === "asc" ? faArrowUp : faArrowDown) : faArrowUpArrowDown}
        className="text-muted"
      />
    </button>
  );
}

/**
 * The "My Lists" view: a table of the user's saved lists. Selecting a row opens
 * the contacts table filtered by that list.
 */
export function ContactListsOverview({
  contacts,
  onOpenList,
}: {
  contacts: Contact[];
  onOpenList: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("label");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const rows = useMemo<ListRow[]>(() => {
    const withCounts = CONTACT_LISTS.map((list) => ({
      ...list,
      count: contacts.filter(list.predicate).length,
    }));
    const value = (r: ListRow): string | number => {
      switch (sortKey) {
        case "label":
          return r.label.toLowerCase();
        case "type":
          return r.type;
        case "count":
          return r.count;
        case "activity":
          return r.lastActivityDays;
        case "reached":
          return r.pctReached;
        case "created":
          return r.createdOn;
        case "updated":
          return r.lastUpdated;
        case "updatedBy":
          return r.lastUpdatedBy.toLowerCase();
      }
    };
    withCounts.sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return withCounts;
  }, [contacts, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const headerProps = (key: SortKey) => ({
    sortKey: key,
    active: sortKey === key,
    dir: sortDir,
    onSort: handleSort,
  });

  return (
    <Table variant="sticky">
      <Table.Header sticky>
        <Table.Row>
          <Table.Head>
            <SortHeader label="List" {...headerProps("label")} />
          </Table.Head>
          <Table.Head>
            <SortHeader label="Type" {...headerProps("type")} />
          </Table.Head>
          <Table.Head>
            <SortHeader label="Contacts" {...headerProps("count")} />
          </Table.Head>
          <Table.Head>
            <SortHeader label="Last Activity" {...headerProps("activity")} />
          </Table.Head>
          <Table.Head>
            <SortHeader label="% Reached" {...headerProps("reached")} />
          </Table.Head>
          <Table.Head>
            <SortHeader label="Created On" {...headerProps("created")} />
          </Table.Head>
          <Table.Head>
            <SortHeader label="Last Updated" {...headerProps("updated")} />
          </Table.Head>
          <Table.Head>
            <SortHeader label="Last Updated By" {...headerProps("updatedBy")} />
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((list) => (
          <Table.Row key={list.id}>
            {/* List */}
            <Table.Cell>
              <button
                type="button"
                onClick={() => onOpenList(list.id)}
                className="btn btn-link p-0 text-reset text-decoration-none d-inline-flex align-items-center gap-2 fw-semibold text-nowrap"
              >
                <FontAwesomeIcon icon={list.icon} className={list.iconClass} />
                {list.label}
              </button>
            </Table.Cell>

            {/* Type */}
            <Table.Cell>
              {list.type === "dynamic" ? (
                <Badge variant="secondary">Dynamic</Badge>
              ) : (
                <Badge variant="secondary" appearance="muted">
                  Static
                </Badge>
              )}
            </Table.Cell>

            {/* Contacts */}
            <Table.Cell className="fw-semibold">{list.count}</Table.Cell>

            {/* Last Activity */}
            <Table.Cell className="text-nowrap text-muted">
              {list.lastActivityDays}d ago
            </Table.Cell>

            {/* % Reached */}
            <Table.Cell>
              <div className="d-flex align-items-center gap-2 text-nowrap">
                <Progress value={list.pctReached} style={{ width: 72 }} />
                <span className="fw-semibold">{list.pctReached}%</span>
              </div>
            </Table.Cell>

            {/* Created On */}
            <Table.Cell className="text-nowrap">
              <span className="text-buildout-blue-700">
                {formatDate(list.createdOn)}
              </span>
            </Table.Cell>

            {/* Last Updated */}
            <Table.Cell className="text-nowrap">
              {formatDate(list.lastUpdated)}
            </Table.Cell>

            {/* Last Updated By */}
            <Table.Cell className="text-nowrap">{list.lastUpdatedBy}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
