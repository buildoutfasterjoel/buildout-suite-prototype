import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Pagination } from "@buildoutinc/blueprint-react/ui/Pagination";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faCaretDown,
  faMagnifyingGlass,
  faEnvelope,
  faPhone,
  faPlus,
} from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { useDataStore } from "#/data/dataStore";
import { ContactsTable } from "#/components/contacts/ContactsTable";
import { ContactListsSidebar } from "#/components/contacts/ContactListsSidebar";
import { ContactListsOverview } from "#/components/contacts/ContactListsOverview";
import {
  CONTACT_LISTS,
  ALL_CONTACTS_ID,
  listPredicate,
} from "#/data/contactLists";
import {
  RELATIONSHIP_STAGES,
  CONTACT_SOURCES,
  DEAL_SIDES,
  CONTACT_DEAL_STAGES,
  RELATIONSHIP_DISPLAY,
  SIDE_DISPLAY,
  DEAL_STAGE_DISPLAY,
  contactFullName,
} from "#/components/contacts/contactDisplay";

export const Route = createFileRoute("/backoffice/contacts/")({
  component: PeoplePage,
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
  // Read the full contact list directly from the live client store so mutations
  // reflect (no server round-trip, no role/propertyId filters needed here).
  const contacts = Array.from(getStore().contacts.values());

  // User/AI-created call lists (reactive) — shown alongside the built-in lists.
  const callListsMap = useDataStore((s) => s.callLists);
  const userLists = useMemo(() => [...callListsMap.values()], [callListsMap]);

  const [view, setView] = useState<"contacts" | "lists">("contacts");
  const [activeListId, setActiveListId] = useState(ALL_CONTACTS_ID);
  const [showFilters, setShowFilters] = useState(false);
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

  const activeList =
    CONTACT_LISTS.find((l) => l.id === activeListId) ??
    userLists.find((l) => l.id === activeListId);
  const heading = activeList ? activeList.label : "All Contacts";

  // The primary tab value: "all" / "mylists", or "" when a specific list filters.
  const topValue =
    view === "lists"
      ? "mylists"
      : activeListId === ALL_CONTACTS_ID
        ? ALL_CONTACTS_ID
        : "";

  const handleTopChange = (value: string) => {
    if (value === "mylists") {
      setView("lists");
    } else {
      setView("contacts");
      setActiveListId(ALL_CONTACTS_ID);
    }
  };

  const handleSelectList = (id: string) => {
    setView("contacts");
    setActiveListId(id);
  };

  const filtersActive =
    activeListId !== ALL_CONTACTS_ID ||
    search.trim() !== "" ||
    [source, relationship, side, dealStage, assignee].some((v) => v !== ALL);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inList = listPredicate(activeListId, userLists);
    const rows = contacts.filter((c) => {
      if (!inList(c)) return false;
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
  }, [
    contacts,
    userLists,
    activeListId,
    source,
    relationship,
    side,
    dealStage,
    assignee,
    search,
    sortDir,
  ]);

  // Any change to the active view resets to the first page.
  useEffect(() => {
    setPage(1);
  }, [
    activeListId,
    source,
    relationship,
    side,
    dealStage,
    assignee,
    search,
    sortDir,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="d-flex gap-4 h-100 p-4 overflow-hidden">
      <ContactListsSidebar
        contacts={contacts}
        userLists={userLists}
        topValue={topValue}
        onTopChange={handleTopChange}
        activeListId={activeListId}
        onSelectList={handleSelectList}
      />

      {/* Main card */}
      <Card className="flex-grow-1 d-flex flex-column overflow-hidden">
        <Card.Body className="overflow-auto d-flex flex-column gap-4">
          {view === "lists" ? (
            <>
              <div className="d-flex align-items-center gap-3">
                <h1 className="fs-4 fw-semibold mb-0 flex-grow-1">My Lists</h1>
                <DropdownMenu>
                  <DropdownMenu.Trigger
                    render={
                      <Button variant="primary">
                        <FontAwesomeIcon icon={faPlus} />
                        New List
                        <FontAwesomeIcon icon={faCaretDown} />
                      </Button>
                    }
                  />
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Item>New dynamic list</DropdownMenu.Item>
                    <DropdownMenu.Item>New static list</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
              </div>
              <ContactListsOverview
                contacts={contacts}
                userLists={userLists}
                onOpenList={handleSelectList}
              />
            </>
          ) : (
            <>
              {/* Header */}
              <div className="d-flex align-items-center gap-3">
                <h1 className="fs-4 fw-semibold mb-0 flex-grow-1">{heading}</h1>
                <DropdownMenu>
                  <DropdownMenu.Trigger
                    render={
                      <Button variant="primary">
                        <FontAwesomeIcon icon={faPlus} />
                        Add Contacts
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

              {/* Toolbar */}
              <div className="d-flex flex-column gap-3">
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <div style={{ minWidth: 280 }}>
                    <InputGroup>
                      <InputGroup.Addon>
                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                      </InputGroup.Addon>
                      <Input
                        type="search"
                        placeholder="Search by name, email, and company"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </InputGroup>
                  </div>
                  <Button
                    variant={showFilters ? "primary" : "outline"}
                    onClick={() => setShowFilters((v) => !v)}
                    aria-pressed={showFilters}
                  >
                    <FontAwesomeIcon icon={faFilter} />
                    Filters
                  </Button>
                  <span className="text-muted">{filtered.length} contacts</span>

                  <div className="ms-auto d-flex align-items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Email contacts"
                    >
                      <FontAwesomeIcon icon={faEnvelope} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Call contacts"
                    >
                      <FontAwesomeIcon icon={faPhone} />
                    </Button>
                  </div>
                </div>

                {/* Filters */}
                {showFilters && (
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <Select
                      value={source}
                      onValueChange={(v) => setSource(v ?? ALL)}
                    >
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

                    <Select
                      value={assignee}
                      onValueChange={(v) => setAssignee(v ?? ALL)}
                    >
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
              </div>

              {/* Table */}
              <ContactsTable
                contacts={paged}
                filtersActive={filtersActive}
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
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
