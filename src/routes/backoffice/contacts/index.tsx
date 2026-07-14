import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Dialog } from "@buildoutinc/blueprint-react/ui/Dialog";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
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
  faTrash,
} from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { useDataStore } from "#/data/dataStore";
import {
  addContactsToCallList,
  createCallList,
  createDynamicList,
  removeCallList,
  removeContactsFromCallList,
  updateCallListFilters,
} from "#/data/actions";
import { ContactsTable } from "#/components/contacts/ContactsTable";
import { ContactSelectionBar } from "#/components/contacts/ContactSelectionBar";
import { CreateStaticListModal } from "#/components/contacts/CreateStaticListModal";
import { AddToListModal } from "#/components/contacts/AddToListModal";
import { ContactListsSidebar } from "#/components/contacts/ContactListsSidebar";
import { ContactListsOverview } from "#/components/contacts/ContactListsOverview";
import {
  CONTACT_LISTS,
  ALL_CONTACTS_ID,
  listPredicate,
} from "#/data/contactLists";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { ContactFilters } from "#/components/contacts/ContactFilters";
import {
  ContactFilterBar,
  type FilterBarContext,
} from "#/components/contacts/ContactFilterBar";
import { CreateDynamicListModal } from "#/components/contacts/CreateDynamicListModal";
import {
  countActiveContactFilters,
  deserializeContactFilters,
  emptyContactFilters,
  filtersEqual,
  matchesContactFilters,
} from "#/components/contacts/contactFilterModel";

export const Route = createFileRoute("/backoffice/contacts/")({
  component: PeoplePage,
  head: () => ({
    meta: [{ title: "People | Buildout Suite" }],
  }),
});

const PAGE_SIZE = 25;

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
  const [showCreateList, setShowCreateList] = useState(false);
  const [showCreateStaticList, setShowCreateStaticList] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyContactFilters());
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Assignee + tag options come from the data so the filters match reality.
  const assignees = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.assignedTo))).sort(),
    [contacts],
  );
  const allTags = useMemo(
    () => Array.from(new Set(contacts.flatMap((c) => c.tags))).sort(),
    [contacts],
  );

  const activeList =
    CONTACT_LISTS.find((l) => l.id === activeListId) ??
    userLists.find((l) => l.id === activeListId);
  const heading = activeList ? activeList.label : "All Contacts";

  // The active user list (if any) + whether it's a dynamic, filter-driven list.
  const activeCallList = callListsMap.get(activeListId);
  const isDynamicList = activeCallList?.type === "dynamic";
  const savedFilters = useMemo(
    () =>
      isDynamicList && activeCallList?.filters
        ? deserializeContactFilters(activeCallList.filters)
        : null,
    [isDynamicList, activeCallList],
  );
  const filterContext: FilterBarContext =
    activeListId === ALL_CONTACTS_ID ? "all" : isDynamicList ? "dynamic" : "other";
  const dirty = savedFilters ? !filtersEqual(filters, savedFilters) : false;

  // A user-created static list (not a built-in, not dynamic).
  const isStaticList = !!activeCallList && !isDynamicList;
  // Filters are only a tool for All Contacts and Dynamic lists.
  const filtersEnabled = activeListId === ALL_CONTACTS_ID || isDynamicList;

  // The primary tab value: "all" / "mylists", or "" when a specific list filters.
  const topValue =
    view === "lists"
      ? "mylists"
      : activeListId === ALL_CONTACTS_ID
        ? ALL_CONTACTS_ID
        : "";

  // Selecting a dynamic list loads its saved filters as the working set; any
  // other list (or All Contacts) starts from a clean filter slate.
  const loadFiltersForList = (id: string) => {
    const cl = callListsMap.get(id);
    if (cl?.type === "dynamic" && cl.filters) {
      setFilters(deserializeContactFilters(cl.filters));
    } else {
      setFilters(emptyContactFilters());
    }
  };

  const handleTopChange = (value: string) => {
    if (value === "mylists") {
      setView("lists");
    } else {
      setView("contacts");
      setActiveListId(ALL_CONTACTS_ID);
      setFilters(emptyContactFilters());
    }
  };

  const handleSelectList = (id: string) => {
    setView("contacts");
    setActiveListId(id);
    loadFiltersForList(id);
  };

  const handleCreateList = (input: {
    name: string;
    color: string;
    description: string;
  }) => {
    const { callList } = createDynamicList({ ...input, filters });
    setView("contacts");
    setActiveListId(callList.id);
    // `filters` already equals the saved set, so the list opens un-dirty.
  };

  const handleSaveFilters = () => updateCallListFilters(activeListId, filters);
  const handleRevert = () => {
    if (savedFilters) setFilters(savedFilters);
  };
  const handleClearFilters = () => setFilters(emptyContactFilters());
  const handleDeleteList = () => {
    removeCallList(activeListId);
    setActiveListId(ALL_CONTACTS_ID);
    setFilters(emptyContactFilters());
    setShowDeleteConfirm(false);
  };

  // Row selection (lifted from the table) drives the bulk-actions bar.
  const clearSelection = () => setSelected(new Set());
  const toggleOne = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  const toggleAll = (pageContacts: typeof contacts, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of pageContacts)
        if (checked) next.add(c.id);
        else next.delete(c.id);
      return next;
    });

  const handleCreateStaticList = (input: {
    name: string;
    color: string;
    description: string;
  }) => {
    const { callList } = createCallList({
      ...input,
      contactIds: [...selected],
    });
    setView("contacts");
    setActiveListId(callList.id);
    clearSelection();
  };

  // Static user lists selected contacts can be added to.
  const staticLists = useMemo(
    () => userLists.filter((l) => l.type !== "dynamic"),
    [userLists],
  );
  const handleAddToList = (listId: string) => {
    addContactsToCallList(listId, [...selected]);
    clearSelection();
  };
  const handleRemoveFromList = () => {
    removeContactsFromCallList(activeListId, [...selected]);
    clearSelection();
  };

  const filtersActive =
    activeListId !== ALL_CONTACTS_ID ||
    search.trim() !== "" ||
    countActiveContactFilters(filters) > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inList = listPredicate(activeListId, userLists);
    const rows = contacts.filter((c) => {
      // Dynamic lists ARE their working filters, so we skip the saved predicate
      // (it would AND with `filters` and hide live edits). Built-in/static lists
      // apply their predicate plus any ad-hoc filters.
      if (filterContext !== "dynamic" && !inList(c)) return false;
      if (!matchesContactFilters(c, filters)) return false;
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
  }, [contacts, userLists, activeListId, filterContext, filters, search, sortDir]);

  // Any change to the active view resets to the first page.
  useEffect(() => {
    setPage(1);
  }, [activeListId, filters, search, sortDir]);

  // Changing the active list, filters, or search drops any row selection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSelected(new Set());
  }, [activeListId, filters, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const selectAllFiltered = () =>
    setSelected(new Set(filtered.map((c) => c.id)));

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
              <div className="d-flex align-items-start gap-3">
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2">
                    <h1 className="fs-4 fw-semibold mb-0">{heading}</h1>
                    {isDynamicList && (
                      <Badge variant="primary" appearance="muted">
                        Dynamic
                      </Badge>
                    )}
                    {isStaticList && (
                      <Badge variant="secondary" appearance="muted">
                        Static
                      </Badge>
                    )}
                  </div>
                  {(isDynamicList || isStaticList) &&
                    activeCallList?.description && (
                      <p className="text-muted mb-0 mt-1">
                        {activeCallList.description}
                      </p>
                    )}
                </div>
                {(isDynamicList || isStaticList) && (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Delete list"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </Button>
                )}
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
                  {filtersEnabled && (
                    <Button
                      variant="outline"
                      onClick={() => setShowFilters((v) => !v)}
                      aria-pressed={showFilters}
                    >
                      <FontAwesomeIcon icon={faFilter} />
                      Filters
                      {countActiveContactFilters(filters) > 0 &&
                        ` (${countActiveContactFilters(filters)})`}
                    </Button>
                  )}
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

                {selected.size > 0 && (
                  <ContactSelectionBar
                    selectedCount={selected.size}
                    totalCount={filtered.length}
                    allFilteredSelected={allFilteredSelected}
                    onSelectAll={selectAllFiltered}
                    onClear={clearSelection}
                    onNewList={() => setShowCreateStaticList(true)}
                    onAddToList={() => setShowAddToList(true)}
                    canRemoveFromList={isStaticList}
                    onRemoveFromList={handleRemoveFromList}
                  />
                )}

                {filtersEnabled && (
                  <ContactFilterBar
                    filters={filters}
                    onChange={setFilters}
                    context={filterContext}
                    dirty={dirty}
                    filteredCount={filtered.length}
                    onSaveDynamic={() => setShowCreateList(true)}
                    onSaveAsNew={() => setShowCreateList(true)}
                    onSaveFilters={handleSaveFilters}
                    onRevert={handleRevert}
                    onClear={handleClearFilters}
                  />
                )}
              </div>

              <ContactFilters
                open={showFilters}
                onOpenChange={setShowFilters}
                filters={filters}
                onChange={setFilters}
                assignees={assignees}
                allTags={allTags}
              />

              <CreateDynamicListModal
                open={showCreateList}
                onOpenChange={setShowCreateList}
                filters={filters}
                onCreate={handleCreateList}
              />

              <CreateStaticListModal
                open={showCreateStaticList}
                onOpenChange={setShowCreateStaticList}
                contactCount={selected.size}
                onCreate={handleCreateStaticList}
              />

              <AddToListModal
                open={showAddToList}
                onOpenChange={setShowAddToList}
                lists={staticLists}
                contactCount={selected.size}
                onAdd={handleAddToList}
              />

              <Dialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
              >
                <Dialog.Content>
                  <Dialog.Header>
                    <Dialog.Title>Delete list?</Dialog.Title>
                    <Dialog.Description>
                      “{heading}” will be permanently deleted. The contacts on it
                      won’t be affected.
                    </Dialog.Description>
                  </Dialog.Header>
                  <Dialog.Footer>
                    <Dialog.Cancel>Cancel</Dialog.Cancel>
                    <Button variant="destructive" onClick={handleDeleteList}>
                      Delete List
                    </Button>
                  </Dialog.Footer>
                </Dialog.Content>
              </Dialog>

              {/* Table */}
              <ContactsTable
                contacts={paged}
                filtersActive={filtersActive}
                sortDir={sortDir}
                onToggleSort={() =>
                  setSortDir((d) => (d === "asc" ? "desc" : "asc"))
                }
                selected={selected}
                onToggleOne={toggleOne}
                onToggleAll={(checked) => toggleAll(paged, checked)}
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
