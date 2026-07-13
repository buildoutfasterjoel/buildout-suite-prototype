import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { ButtonGroup } from "@buildoutinc/blueprint-react/ui/ButtonGroup";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { Progress } from "@buildoutinc/blueprint-react/ui/Progress";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Pagination } from "@buildoutinc/blueprint-react/ui/Pagination";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelopesBulk,
  faEnvelope,
  faBoxArchive,
  faCirclePlus,
  faCaretDown,
  faCircleInfo,
  faMagnifyingGlass,
  faTableList,
  faCalendar,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/pro-regular-svg-icons";
import {
  EMAIL_STATUSES,
  EMAIL_TYPES,
  EMAIL_BROKERS,
  EMAIL_LISTS,
} from "#/data/emails";
import { useDataStore } from "#/data/dataStore";
import { EMAIL_STATUS_DISPLAY, TYPE_LABELS } from "#/components/email/emailDisplay";
import { EmailPerformanceStats } from "#/components/email/EmailPerformanceStats";
import { EmailsTable } from "#/components/email/EmailsTable";
import { EmailsCalendar } from "#/components/email/EmailsCalendar";

export const Route = createFileRoute("/email/")({
  component: EmailsPage,
  head: () => ({
    meta: [{ title: "Emails | Buildout Suite" }],
  }),
});

const ALL = "all";
const PAGE_SIZE = 10;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function prevMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}
function nextMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

/** Value→label maps so each Select trigger shows the label, not the raw value. */
const STATUS_FILTER_LABELS: Record<string, string> = {
  [ALL]: "All Statuses",
  ...Object.fromEntries(
    EMAIL_STATUSES.map((s) => [s, EMAIL_STATUS_DISPLAY[s].label]),
  ),
};
const TYPE_FILTER_LABELS: Record<string, string> = {
  [ALL]: "All Types",
  ...Object.fromEntries(EMAIL_TYPES.map((t) => [t, TYPE_LABELS[t]])),
};
const BROKER_FILTER_LABELS: Record<string, string> = {
  [ALL]: "All Brokers",
  ...Object.fromEntries(EMAIL_BROKERS.map((b) => [b, b])),
};
const LIST_FILTER_LABELS: Record<string, string> = {
  [ALL]: "All Lists",
  ...Object.fromEntries(EMAIL_LISTS.map((l) => [l, l])),
};

/** Small determinate progress ring for the "Emails Sent" quota indicator. */
function QuotaRing({ percent }: { percent: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx={10} cy={10} r={r} fill="none" stroke="#eceef2" strokeWidth={3} />
      <circle
        cx={10}
        cy={10}
        r={r}
        fill="none"
        stroke="#7422ce"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c - filled}`}
        transform="rotate(-90 10 10)"
      />
    </svg>
  );
}

function EmailsPage() {
  const emailsMap = useDataStore((s) => s.emails);
  const emails = useMemo(() => [...emailsMap.values()], [emailsMap]);

  const [tab, setTab] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [broker, setBroker] = useState(ALL);
  const [list, setList] = useState(ALL);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [calMonth, setCalMonth] = useState(() => new Date(2026, 5, 1));

  const filtersActive =
    search.trim() !== "" ||
    [status, type, broker, list].some((v) => v !== ALL);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return emails.filter((e) => {
      if (e.archived !== (tab === "archived")) return false;
      if (status !== ALL && e.status !== status) return false;
      if (type !== ALL && e.type !== type) return false;
      if (broker !== ALL && e.primaryBroker !== broker) return false;
      if (list !== ALL && e.list !== list) return false;
      if (q) {
        const haystack = `${e.campaign} ${e.subject}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [emails, tab, search, status, type, broker, list]);

  // Any change to the active view resets to the first page.
  useEffect(() => {
    setPage(1);
  }, [tab, search, status, type, broker, list]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="d-flex flex-column h-100 overflow-auto">
      {/* Header bar */}
      <div className="bg-white border-bottom shadow-sm">
        <div className="container py-3">
          <div className="d-flex align-items-center gap-3">
            <FontAwesomeIcon
              icon={faEnvelopesBulk}
              className="fs-3 text-body"
            />
            <div className="flex-grow-1">
              <h1 className="fs-4 fw-semibold mb-0">Emails</h1>
              <div className="text-muted">Manage your email campaigns.</div>
            </div>

            {/* Emails Sent quota */}
            <Popover>
              <Popover.Trigger
                openOnHover
                delay={200}
                closeDelay={150}
                nativeButton={false}
                render={
                  <div
                    className="d-flex align-items-center gap-2"
                    role="button"
                    tabIndex={0}
                    aria-label="Email send limit details"
                    style={{ cursor: "default" }}
                  />
                }
              >
                <QuotaRing percent={30} />
                <div className="d-flex flex-column lh-sm">
                  <span className="d-inline-flex align-items-center gap-1 fw-semibold">
                    Emails Sent
                    <span className="text-muted small lh-1">
                      <FontAwesomeIcon icon={faCircleInfo} />
                    </span>
                  </span>
                  <span className="text-muted small">75,000 / 250,000</span>
                </div>
              </Popover.Trigger>
              <Popover.Content side="bottom" align="end" sideOffset={6} style={{ minWidth: 280 }}>
                <Popover.Header>Email Send Limit</Popover.Header>
                <Popover.Body className="d-flex flex-column gap-3">
                  <div className="d-flex flex-column gap-1">
                    <div className="d-flex align-items-baseline gap-1">
                      <span className="fw-semibold">75,000</span>
                      <span className="text-muted">/ 250,000</span>
                      <span className="text-muted ms-auto">30%</span>
                    </div>
                    <Progress value={30} />
                  </div>
                  <div className="d-flex border rounded overflow-hidden">
                    <div className="flex-fill p-2 border-end">
                      <div className="fw-semibold small">175,000</div>
                      <div className="text-muted" style={{ fontSize: "0.7rem" }}>Emails Left</div>
                    </div>
                    <div className="flex-fill p-2">
                      <div className="fw-semibold small">April 25, 2026</div>
                      <div className="text-muted" style={{ fontSize: "0.7rem" }}>Email Limit Resets</div>
                    </div>
                  </div>
                </Popover.Body>
              </Popover.Content>
            </Popover>

            {/* Actions */}
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
                <DropdownMenu.Item>Import Emails</DropdownMenu.Item>
                <DropdownMenu.Item>Export Emails</DropdownMenu.Item>
                <DropdownMenu.Item>Manage Lists</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
            <Button variant="primary">
              <FontAwesomeIcon icon={faCirclePlus} />
              New Email
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-4 d-flex flex-column gap-4">
        <EmailPerformanceStats />

        <Card>
          <Card.Body className="d-flex flex-column gap-3">
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as "active" | "archived")}
            >
              <Tabs.List>
                <Tabs.Tab
                  value="active"
                  icon={<FontAwesomeIcon icon={faEnvelope} />}
                >
                  Active
                </Tabs.Tab>
                <Tabs.Tab
                  value="archived"
                  icon={<FontAwesomeIcon icon={faBoxArchive} />}
                >
                  Archived
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>

            <div className="d-flex flex-column gap-3">
              {/* Filters */}
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div style={{ minWidth: 280 }}>
                  <InputGroup>
                    <InputGroup.Addon>
                      <FontAwesomeIcon icon={faMagnifyingGlass} />
                    </InputGroup.Addon>
                    <Input
                      type="search"
                      placeholder="Search for an email or subject"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </InputGroup>
                </div>

                <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
                  <Select.Trigger className="w-auto">
                    <Select.Value>
                      {(v) => STATUS_FILTER_LABELS[v ?? ALL]}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>All Statuses</Select.Item>
                    {EMAIL_STATUSES.map((s) => (
                      <Select.Item key={s} value={s}>
                        {EMAIL_STATUS_DISPLAY[s].label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>

                <Select value={type} onValueChange={(v) => setType(v ?? ALL)}>
                  <Select.Trigger className="w-auto">
                    <Select.Value>
                      {(v) => TYPE_FILTER_LABELS[v ?? ALL]}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>All Types</Select.Item>
                    {EMAIL_TYPES.map((t) => (
                      <Select.Item key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>

                <Select value={broker} onValueChange={(v) => setBroker(v ?? ALL)}>
                  <Select.Trigger className="w-auto">
                    <Select.Value>
                      {(v) => BROKER_FILTER_LABELS[v ?? ALL]}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>All Brokers</Select.Item>
                    {EMAIL_BROKERS.map((b) => (
                      <Select.Item key={b} value={b}>
                        {b}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>

                <Select value={list} onValueChange={(v) => setList(v ?? ALL)}>
                  <Select.Trigger className="w-auto">
                    <Select.Value>
                      {(v) => LIST_FILTER_LABELS[v ?? ALL]}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>All Lists</Select.Item>
                    {EMAIL_LISTS.map((l) => (
                      <Select.Item key={l} value={l}>
                        {l}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>

                {/* Month picker + view toggle (right-aligned) */}
                <div className="d-flex align-items-center gap-2 ms-auto">
                  {viewMode === "calendar" && (
                    <div className="d-flex align-items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Previous month"
                        onClick={() => setCalMonth(prevMonth(calMonth))}
                      >
                        <FontAwesomeIcon icon={faChevronLeft} />
                      </Button>
                      <span className="fw-semibold px-1" style={{ minWidth: 110, textAlign: "center" }}>
                        {MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Next month"
                        onClick={() => setCalMonth(nextMonth(calMonth))}
                      >
                        <FontAwesomeIcon icon={faChevronRight} />
                      </Button>
                    </div>
                  )}
                  <ButtonGroup aria-label="View switcher">
                    <Tooltip>
                      <Tooltip.Trigger
                        render={
                          <Button
                            variant={viewMode === "table" ? "primary" : "outline"}
                            size="icon"
                            onClick={() => setViewMode("table")}
                            aria-pressed={viewMode === "table"}
                            aria-label="Table view"
                          >
                            <FontAwesomeIcon icon={faTableList} />
                          </Button>
                        }
                      />
                      <Tooltip.Content>Table</Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                      <Tooltip.Trigger
                        render={
                          <Button
                            variant={viewMode === "calendar" ? "primary" : "outline"}
                            size="icon"
                            onClick={() => setViewMode("calendar")}
                            aria-pressed={viewMode === "calendar"}
                            aria-label="Calendar view"
                          >
                            <FontAwesomeIcon icon={faCalendar} />
                          </Button>
                        }
                      />
                      <Tooltip.Content>Calendar</Tooltip.Content>
                    </Tooltip>
                  </ButtonGroup>
                </div>
              </div>

              {/* Table or Calendar */}
              {viewMode === "table" ? (
                <>
                  <EmailsTable emails={paged} filtersActive={filtersActive} />

                  {filtered.length > 0 && (
                    <Pagination className="d-flex justify-content-center">
                      <Pagination.Content>
                        <Pagination.Item>
                          <Pagination.Previous
                            href="#"
                            aria-disabled={current === 1}
                            onClick={(e) => {
                              e.preventDefault();
                              setPage((p) => Math.max(1, p - 1));
                            }}
                          />
                        </Pagination.Item>
                        {Array.from({ length: pageCount }, (_, i) => i + 1).map(
                          (n) => (
                            <Pagination.Item key={n}>
                              <Pagination.Link
                                href="#"
                                isActive={n === current}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setPage(n);
                                }}
                              >
                                {n}
                              </Pagination.Link>
                            </Pagination.Item>
                          ),
                        )}
                        <Pagination.Item>
                          <Pagination.Next
                            href="#"
                            aria-disabled={current === pageCount}
                            onClick={(e) => {
                              e.preventDefault();
                              setPage((p) => Math.min(pageCount, p + 1));
                            }}
                          />
                        </Pagination.Item>
                      </Pagination.Content>
                    </Pagination>
                  )}
                </>
              ) : (
                <EmailsCalendar emails={filtered} month={calMonth} />
              )}
            </div>
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
