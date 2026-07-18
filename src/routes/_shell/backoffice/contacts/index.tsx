import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Dialog } from "@buildoutinc/blueprint-react/ui/Dialog";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Pagination } from "@buildoutinc/blueprint-react/ui/Pagination";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faListUl,
  faCaretDown,
  faMagnifyingGlass,
  faEnvelope,
  faPhone,
  faPlus,
  faPen,
  faTrash,
  faUsers,
} from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { useDataStore } from "#/data/dataStore";
import {
  addContactsToCallList,
  createCallList,
  createDynamicList,
  removeCallList,
  removeContactsFromCallList,
  updateCallList,
  updateCallListFilters,
} from "#/data/actions";
import { useNewContact } from "#/data/useNewContact";
import { ContactsTable } from "#/components/contacts/ContactsTable";
import { ContactSelectionBar } from "#/components/contacts/ContactSelectionBar";
import { CreateStaticListModal } from "#/components/contacts/CreateStaticListModal";
import { AddToListModal } from "#/components/contacts/AddToListModal";
import { AddContactsToListModal } from "#/components/contacts/AddContactsToListModal";
import { EditDynamicListModal } from "#/components/contacts/EditDynamicListModal";
import { EditStaticListModal } from "#/components/contacts/EditStaticListModal";
import { ContactListsSidebar } from "#/components/contacts/ContactListsSidebar";
import { ContactListsOverview } from "#/components/contacts/ContactListsOverview";
import { getPipelineStage } from "#/components/contacts/pipelineStages";
import {
  CONTACT_LISTS,
  ALL_CONTACTS_ID,
  listPredicate,
} from "#/data/contactLists";
import { contactFullName } from "#/components/contacts/contactDisplay";
import {
  useContactListNav,
  type ContactListSource,
} from "#/components/contacts/useContactListNav";
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
  type ContactFilterState,
} from "#/components/contacts/contactFilterModel";

export const Route = createFileRoute("/_shell/backoffice/contacts/")({
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

  // When a contact-detail breadcrumb sends the user back here, restore the exact
  // list/filter/search view they came from (see useContactListNav). Read once at
  // mount; a plain nav to People (no flag) falls through to the defaults.
  const restoreSource = useContactListNav.getState().restorePending
    ? useContactListNav.getState().source
    : null;

  const [view, setView] = useState<"contacts" | "lists">("contacts");
  const [activeListId, setActiveListId] = useState(
    restoreSource?.listId ?? ALL_CONTACTS_ID,
  );
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showCreateStaticList, setShowCreateStaticList] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [showEditList, setShowEditList] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [search, setSearch] = useState(restoreSource?.search ?? "");
  const [filters, setFilters] = useState(
    restoreSource?.filters ?? emptyContactFilters(),
  );

  // Consume the restore flag so a later plain visit to People starts fresh.
  useEffect(() => {
    if (useContactListNav.getState().restorePending) {
      useContactListNav.getState().clearRestore();
    }
  }, []);
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

  // A "My Pipeline" preset page, if that's what's active.
  const activePipeline = getPipelineStage(activeListId);

  const activeList =
    CONTACT_LISTS.find((l) => l.id === activeListId) ??
    userLists.find((l) => l.id === activeListId);
  const heading = activePipeline
    ? activePipeline.label
    : activeList
      ? activeList.label
      : "All Contacts";

  // The active user list (if any) + whether it's a dynamic, filter-driven list.
  const activeCallList = callListsMap.get(activeListId);
  const isDynamicList = activeCallList?.type === "dynamic";
  // The "saved" set a Revert restores: a dynamic list's stored filters, or a
  // pipeline page's fixed preset.
  const savedFilters = useMemo(
    () => {
      if (activePipeline) return activePipeline.preset();
      return isDynamicList && activeCallList?.filters
        ? deserializeContactFilters(activeCallList.filters)
        : null;
    },
    [activePipeline, isDynamicList, activeCallList],
  );
  const filterContext: FilterBarContext =
    activeListId === ALL_CONTACTS_ID
      ? "all"
      : activePipeline
        ? "pipeline"
        : isDynamicList
          ? "dynamic"
          : "other";
  const dirty = savedFilters ? !filtersEqual(filters, savedFilters) : false;

  // A user-created static list (not a built-in, not dynamic).
  const isStaticList = !!activeCallList && !isDynamicList;
  // Filters are a tool for All Contacts, Dynamic lists, and Pipeline pages, plus
  // static lists — where they only narrow that list's members (context "other"),
  // so the filter bar offers a lone Clear Filters action (no save / revert).
  const filtersEnabled =
    activeListId === ALL_CONTACTS_ID ||
    isDynamicList ||
    !!activePipeline ||
    isStaticList;

  // The primary tab value: "all" / "mylists", or "" when a specific list filters.
  const topValue =
    view === "lists"
      ? "mylists"
      : activeListId === ALL_CONTACTS_ID
        ? ALL_CONTACTS_ID
        : "";

  // Selecting a dynamic list (or pipeline page) loads its saved/preset filters
  // as the working set; any other list (or All Contacts) starts clean.
  const loadFiltersForList = (id: string) => {
    const stage = getPipelineStage(id);
    if (stage) {
      setFilters(stage.preset());
      return;
    }
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
  const handleAddContactsToActiveList = (ids: string[]) =>
    addContactsToCallList(activeListId, ids);

  const handleEditDynamic = (input: {
    name: string;
    color: string;
    description: string;
    filters: ContactFilterState;
  }) => {
    updateCallList(activeListId, {
      label: input.name,
      color: input.color,
      description: input.description,
    });
    updateCallListFilters(activeListId, input.filters);
    // Keep the live view in sync with the saved criteria (un-dirty).
    setFilters(input.filters);
  };

  const handleEditStatic = (input: {
    name: string;
    color: string;
    description: string;
    contactIds: string[];
  }) => {
    updateCallList(activeListId, {
      label: input.name,
      color: input.color,
      description: input.description,
      contactIds: input.contactIds,
    });
  };

  // A static list with no members yet — shows a "search & add" empty state.
  const emptyStaticList =
    isStaticList && (activeCallList?.contactIds.length ?? 0) === 0;

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

  // Mirror the currently-viewed list into the nav store so the contact detail
  // page's pager + breadcrumb know which set to step through and how to label
  // it. Kept in sync as the list/filters/search change.
  const setContactListNav = useContactListNav((s) => s.setList);
  useEffect(() => {
    const ids = filtered.map((c) => c.id);
    let source: ContactListSource;
    if (activeListId === ALL_CONTACTS_ID) {
      const isFiltered =
        search.trim() !== "" || countActiveContactFilters(filters) > 0;
      source = {
        variant: isFiltered ? "filtered" : "all",
        label: isFiltered ? "Contacts (Filtered)" : "Contacts",
        listId: activeListId,
        filters,
        search,
      };
    } else {
      source = {
        variant: "list",
        label: heading,
        listId: activeListId,
        filters,
        search,
      };
    }
    setContactListNav(ids, source);
  }, [filtered, activeListId, filters, search, heading, setContactListNav]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const selectAllFiltered = () =>
    setSelected(new Set(filtered.map((c) => c.id)));

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div
      className="d-flex gap-4 h-100 p-4 overflow-hidden mx-auto w-100"
      style={{ maxWidth: "96rem" }}
    >
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
                    {activePipeline && (
                      <FontAwesomeIcon
                        icon={activePipeline.icon}
                        className="fs-4"
                        style={{ color: activePipeline.color }}
                      />
                    )}
                    {activeCallList && (isDynamicList || isStaticList) && (
                      <FontAwesomeIcon
                        icon={isDynamicList ? faFilter : faListUl}
                        className="fs-4"
                        style={{ color: activeCallList.color }}
                      />
                    )}
                    <h1 className="fs-4 fw-semibold mb-0">{heading}</h1>
                    {activePipeline && (
                      <Badge variant="secondary" appearance="muted">
                        Pipeline
                      </Badge>
                    )}
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
                  {activePipeline && (
                    <p className="text-muted mb-0 mt-1">
                      {activePipeline.description}
                    </p>
                  )}
                  {(isDynamicList || isStaticList) &&
                    activeCallList?.description && (
                      <p className="text-muted mb-0 mt-1">
                        {activeCallList.description}
                      </p>
                    )}
                </div>
                {(isDynamicList || isStaticList) && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowEditList(true)}
                    >
                      <FontAwesomeIcon icon={faPen} />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Delete list"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </Button>
                  </>
                )}
                {activeListId === ALL_CONTACTS_ID && (
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
                      <DropdownMenu.Item
                        onClick={() => useNewContact.getState().openNew()}
                      >
                        New Contact
                      </DropdownMenu.Item>
                      <DropdownMenu.Item>Import Contacts</DropdownMenu.Item>
                      <DropdownMenu.Item>Export Contacts</DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                )}
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
                  {filtersEnabled &&
                    (isStaticList ? (
                      <Tooltip>
                        <Tooltip.Trigger
                          render={
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
                          }
                        />
                        <Tooltip.Content>
                          Filters only narrow the contacts in this list
                        </Tooltip.Content>
                      </Tooltip>
                    ) : (
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
                    ))}
                  <span className="text-muted">{filtered.length} contacts</span>

                  <div className="ms-auto d-flex align-items-center gap-2">
                    <Tooltip>
                      <Tooltip.Trigger
                        render={
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Email this list"
                          >
                            <FontAwesomeIcon icon={faEnvelope} />
                          </Button>
                        }
                      />
                      <Tooltip.Content>Email this list</Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                      <Tooltip.Trigger
                        render={
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Call this list"
                          >
                            <FontAwesomeIcon icon={faPhone} />
                          </Button>
                        }
                      />
                      <Tooltip.Content>Call this list</Tooltip.Content>
                    </Tooltip>
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

              {activeCallList &&
                (isDynamicList ? (
                  <EditDynamicListModal
                    open={showEditList}
                    onOpenChange={setShowEditList}
                    list={activeCallList}
                    assignees={assignees}
                    allTags={allTags}
                    onSave={handleEditDynamic}
                  />
                ) : (
                  <EditStaticListModal
                    open={showEditList}
                    onOpenChange={setShowEditList}
                    list={activeCallList}
                    contacts={contacts}
                    onSave={handleEditStatic}
                  />
                ))}

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

              <AddContactsToListModal
                open={showAddContacts}
                onOpenChange={setShowAddContacts}
                listLabel={heading}
                contacts={contacts}
                existingIds={new Set(activeCallList?.contactIds ?? [])}
                onAdd={handleAddContactsToActiveList}
              />

              {emptyStaticList ? (
                /* Empty static list — invite the user to search & add contacts. */
                <Empty className="py-6">
                  <Empty.Media>
                    <FontAwesomeIcon icon={faUsers} aria-label="Empty list" />
                  </Empty.Media>
                  <Empty.Content>
                    <Empty.Title>This list is empty</Empty.Title>
                    Add contacts to “{heading}” to start building it out.
                  </Empty.Content>
                  <Empty.Actions>
                    <Button
                      variant="primary"
                      onClick={() => setShowAddContacts(true)}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      Add Contacts
                    </Button>
                  </Empty.Actions>
                </Empty>
              ) : (
                <>
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
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
