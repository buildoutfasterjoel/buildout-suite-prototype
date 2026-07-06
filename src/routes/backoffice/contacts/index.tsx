import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { ButtonGroup } from "@buildoutinc/blueprint-react/ui/ButtonGroup";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Pagination } from "@buildoutinc/blueprint-react/ui/Pagination";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faSquareCheck,
  faCaretDown,
  faMagnifyingGlass,
  faAddressBook,
  faDiagramProject,
} from "@fortawesome/pro-regular-svg-icons";
import { listContacts } from "#/lib/contacts";
import { ContactsTable } from "#/components/contacts/ContactsTable";
import {
  RELATIONSHIP_STAGES,
  CONTACT_SOURCES,
  DEAL_SIDES,
  CONTACT_DEAL_STAGES,
  RELATIONSHIP_DISPLAY,
  SIDE_DISPLAY,
  DEAL_STAGE_DISPLAY,
  contactFullName,
} from "#/data/contacts";

export const Route = createFileRoute("/backoffice/contacts/")({
  component: PeoplePage,
  loader: () => listContacts({ data: {} }),
  head: () => ({
    meta: [{ title: "People | Buildout Suite" }],
  }),
});

const ALL = "all";
const PAGE_SIZE = 25;

const SOURCE_FILTER_LABELS: Record<string, string> = {
  [ALL]: "All Sources",
  ...Object.fromEntries(CONTACT_SOURCES.map((s) => [s, s])),
};
const RELATIONSHIP_FILTER_LABELS: Record<string, string> = {
  [ALL]: "All Relationships",
  ...Object.fromEntries(
    RELATIONSHIP_STAGES.map((s) => [s, RELATIONSHIP_DISPLAY[s].label]),
  ),
};
const SIDE_FILTER_LABELS: Record<string, string> = {
  [ALL]: "All Sides",
  ...Object.fromEntries(DEAL_SIDES.map((s) => [s, SIDE_DISPLAY[s].label])),
};
const DEAL_STAGE_FILTER_LABELS: Record<string, string> = {
  [ALL]: "All Deal Stages",
  ...Object.fromEntries(
    CONTACT_DEAL_STAGES.map((s) => [s, DEAL_STAGE_DISPLAY[s].label]),
  ),
};

function PeoplePage() {
  const contacts = Route.useLoaderData();

  const [view, setView] = useState<"directory" | "relationship">("directory");
  const [showFilters, setShowFilters] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState(ALL);
  const [relationship, setRelationship] = useState(ALL);
  const [side, setSide] = useState(ALL);
  const [dealStage, setDealStage] = useState(ALL);
  const [assignee, setAssignee] = useState(ALL);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  // Assignee options come from the data so the filter always matches reality.
  const assignees = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.assignedTo))).sort(),
    [contacts],
  );
  const ASSIGNEE_FILTER_LABELS: Record<string, string> = {
    [ALL]: "All Assignees",
    ...Object.fromEntries(assignees.map((a) => [a, a])),
  };

  const filtersActive =
    search.trim() !== "" ||
    [source, relationship, side, dealStage, assignee].some((v) => v !== ALL);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = contacts.filter((c) => {
      if (source !== ALL && c.source !== source) return false;
      if (relationship !== ALL && c.relationship !== relationship) return false;
      if (side !== ALL && c.side !== side) return false;
      if (dealStage !== ALL && c.dealStage !== dealStage) return false;
      if (assignee !== ALL && c.assignedTo !== assignee) return false;
      if (q) {
        const haystack =
          `${contactFullName(c)} ${c.email} ${c.company} ${c.phone}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    rows.sort((a, b) => {
      const cmp = contactFullName(a).localeCompare(contactFullName(b));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [contacts, source, relationship, side, dealStage, assignee, search, sortDir]);

  // Any change to the active view resets to the first page.
  useEffect(() => {
    setPage(1);
  }, [source, relationship, side, dealStage, assignee, search, sortDir, view]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="d-flex flex-column h-100 overflow-auto">
      {/* Header bar */}
      <div className="bg-white border-bottom shadow-sm">
        <div className="container py-3">
          <div className="d-flex align-items-start gap-3">
            <div className="flex-grow-1">
              <h1 className="fs-4 fw-semibold mb-0">People</h1>
              <div className="text-muted">
                Your book of relationships: everyone you've claimed, from cold to
                client.
              </div>
            </div>
            <ButtonGroup aria-label="View switcher">
              <Button
                variant="outline"
                className={view === "directory" ? "active" : undefined}
                onClick={() => setView("directory")}
                aria-pressed={view === "directory"}
              >
                <FontAwesomeIcon icon={faAddressBook} />
                Directory
              </Button>
              <Button
                variant="outline"
                className={view === "relationship" ? "active" : undefined}
                onClick={() => setView("relationship")}
                aria-pressed={view === "relationship"}
              >
                <FontAwesomeIcon icon={faDiagramProject} />
                Relationship
              </Button>
            </ButtonGroup>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-4">
        <Card>
          <Card.Body className="d-flex flex-column gap-3">
            {/* Toolbar */}
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <Button
                variant={showFilters ? "primary" : "outline"}
                onClick={() => setShowFilters((v) => !v)}
              >
                <FontAwesomeIcon icon={faFilter} />
                Filters
              </Button>
              <span className="fw-semibold">{filtered.length} contacts</span>
              <Button
                variant={selectionMode ? "primary" : "outline"}
                onClick={() => setSelectionMode((v) => !v)}
                aria-pressed={selectionMode}
              >
                <FontAwesomeIcon icon={faSquareCheck} />
                Select
              </Button>

              <div className="ms-auto">
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
                    <DropdownMenu.Item>New Contact</DropdownMenu.Item>
                    <DropdownMenu.Item>Import Contacts</DropdownMenu.Item>
                    <DropdownMenu.Item>Export Contacts</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
              </div>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div style={{ minWidth: 280 }}>
                  <InputGroup>
                    <InputGroup.Addon>
                      <FontAwesomeIcon icon={faMagnifyingGlass} />
                    </InputGroup.Addon>
                    <Input
                      type="search"
                      placeholder="Search by name, email, company, or phone"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </InputGroup>
                </div>

                <Select value={source} onValueChange={(v) => setSource(v ?? ALL)}>
                  <Select.Trigger className="w-auto">
                    <Select.Value>
                      {(v) => SOURCE_FILTER_LABELS[v ?? ALL]}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>All Sources</Select.Item>
                    {CONTACT_SOURCES.map((s) => (
                      <Select.Item key={s} value={s}>
                        {s}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>

                <Select
                  value={relationship}
                  onValueChange={(v) => setRelationship(v ?? ALL)}
                >
                  <Select.Trigger className="w-auto">
                    <Select.Value>
                      {(v) => RELATIONSHIP_FILTER_LABELS[v ?? ALL]}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>All Relationships</Select.Item>
                    {RELATIONSHIP_STAGES.map((s) => (
                      <Select.Item key={s} value={s}>
                        {RELATIONSHIP_DISPLAY[s].label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>

                <Select value={side} onValueChange={(v) => setSide(v ?? ALL)}>
                  <Select.Trigger className="w-auto">
                    <Select.Value>
                      {(v) => SIDE_FILTER_LABELS[v ?? ALL]}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>All Sides</Select.Item>
                    {DEAL_SIDES.map((s) => (
                      <Select.Item key={s} value={s}>
                        {SIDE_DISPLAY[s].label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>

                <Select
                  value={dealStage}
                  onValueChange={(v) => setDealStage(v ?? ALL)}
                >
                  <Select.Trigger className="w-auto">
                    <Select.Value>
                      {(v) => DEAL_STAGE_FILTER_LABELS[v ?? ALL]}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>All Deal Stages</Select.Item>
                    {CONTACT_DEAL_STAGES.map((s) => (
                      <Select.Item key={s} value={s}>
                        {DEAL_STAGE_DISPLAY[s].label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>

                <Select value={assignee} onValueChange={(v) => setAssignee(v ?? ALL)}>
                  <Select.Trigger className="w-auto">
                    <Select.Value>
                      {(v) => ASSIGNEE_FILTER_LABELS[v ?? ALL]}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={ALL}>All Assignees</Select.Item>
                    {assignees.map((a) => (
                      <Select.Item key={a} value={a}>
                        {a}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            )}

            {/* View */}
            {view === "directory" ? (
              <>
                <ContactsTable
                  contacts={paged}
                  filtersActive={filtersActive}
                  selectionMode={selectionMode}
                  sortDir={sortDir}
                  onToggleSort={() =>
                    setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                  }
                />

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
              <Empty className="py-6">
                <Empty.Media>
                  <FontAwesomeIcon
                    icon={faDiagramProject}
                    aria-label="Relationship view"
                  />
                </Empty.Media>
                <Empty.Content>
                  <Empty.Title>Relationship view coming soon</Empty.Title>
                  Switch back to Directory to browse your contacts.
                </Empty.Content>
              </Empty>
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}
