import { useMemo, useState } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faAddressBook,
  faLayerGroup,
  faListUl,
  faArrowUpArrowDown,
  faMagnifyingGlass,
  faSidebar,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import {
  CONTACT_LISTS,
  ALL_CONTACTS_ID,
  callListToContactList,
  type CallList,
} from "#/data/contactLists";

/** Label + count laid out across the full width of a pill tab. */
function TabLabel({ label, count }: { label: string; count: number }) {
  return (
    <span
      className="d-flex align-items-center justify-content-between gap-2 flex-grow-1"
      style={{ minWidth: 0 }}
    >
      <span className="text-truncate">{label}</span>
      <Badge variant="secondary" appearance="muted" className="flex-shrink-0">
        {count}
      </Badge>
    </span>
  );
}

export function ContactListsSidebar({
  contacts,
  userLists,
  topValue,
  onTopChange,
  activeListId,
  onSelectList,
}: {
  contacts: Contact[];
  /** User/AI-created call lists, rendered alongside the built-in lists. */
  userLists: CallList[];
  /** "all" | "mylists" | "" (empty when a specific list filter is active). */
  topValue: string;
  onTopChange: (value: string) => void;
  activeListId: string;
  onSelectList: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  // Built-in lists plus user/AI call lists, unified into one display shape.
  const allLists = useMemo(
    () => [...CONTACT_LISTS, ...userLists.map(callListToContactList)],
    [userLists],
  );

  // Real counts derived from the dataset.
  const counts = useMemo(() => {
    const map: Record<string, number> = { [ALL_CONTACTS_ID]: contacts.length };
    for (const list of allLists) {
      map[list.id] = contacts.filter(list.predicate).length;
    }
    return map;
  }, [contacts, allLists]);

  const visibleLists = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allLists;
    return allLists.filter((l) => l.label.toLowerCase().includes(q));
  }, [search, allLists]);

  // When collapsed, tab icons carry a native tooltip so the rail stays usable.
  const tabIcon = (
    icon: IconDefinition,
    label: string,
    className?: string,
    color?: string,
  ) =>
    collapsed ? (
      <span title={label}>
        <FontAwesomeIcon icon={icon} className={className} style={{ color }} />
      </span>
    ) : (
      <FontAwesomeIcon icon={icon} className={className} style={{ color }} />
    );

  return (
    <Card
      className={`contact-lists-sidebar d-flex flex-column flex-shrink-0 h-100 overflow-hidden${
        collapsed ? " is-collapsed" : ""
      }`}
      style={{ width: collapsed ? 64 : 288, transition: "width .15s ease" }}
    >
      {/* Header */}
      {collapsed ? (
        <div className="d-flex justify-content-center py-3 border-bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Expand panel"
            onClick={() => setCollapsed(false)}
          >
            <FontAwesomeIcon icon={faSidebar} />
          </Button>
        </div>
      ) : (
        <div className="d-flex align-items-center gap-2 px-3 py-3 border-bottom">
          <FontAwesomeIcon
            icon={faAddressBook}
            className="text-buildout-blue-700"
          />
          <span className="fw-semibold flex-grow-1">Contact Lists</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Collapse panel"
            onClick={() => setCollapsed(true)}
          >
            <FontAwesomeIcon icon={faSidebar} />
          </Button>
        </div>
      )}

      <div className="flex-grow-1 overflow-auto p-2 d-flex flex-column gap-2">
        {/* Primary tabs: All Contacts / My Lists */}
        <Tabs
          value={topValue}
          onValueChange={onTopChange}
          orientation="vertical"
        >
          <Tabs.List variant="pills" orientation="vertical">
            <Tabs.Tab
              value={ALL_CONTACTS_ID}
              icon={tabIcon(faListUl, "All Contacts")}
            >
              {!collapsed && (
                <TabLabel label="All Contacts" count={counts[ALL_CONTACTS_ID]} />
              )}
            </Tabs.Tab>
            <Tabs.Tab value="mylists" icon={tabIcon(faLayerGroup, "My Lists")}>
              {!collapsed && (
                <TabLabel label="My Lists" count={allLists.length} />
              )}
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {/* Lists filter section */}
        {!collapsed && (
          <>
            <div className="d-flex align-items-center px-2 pt-2">
              <span className="fs-small fw-semibold text-uppercase text-muted flex-grow-1">
                Lists
              </span>
              <Button variant="ghost" size="icon-sm" aria-label="Sort lists">
                <FontAwesomeIcon icon={faArrowUpArrowDown} />
              </Button>
            </div>

            <div className="px-2">
              <InputGroup>
                <InputGroup.Addon>
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </InputGroup.Addon>
                <Input
                  type="search"
                  placeholder="Search lists…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>
            </div>
          </>
        )}

        <Tabs
          value={activeListId}
          onValueChange={(v) => onSelectList(v ?? ALL_CONTACTS_ID)}
          orientation="vertical"
        >
          <Tabs.List variant="pills" orientation="vertical">
            {visibleLists.map((list) => (
              <Tabs.Tab
                key={list.id}
                value={list.id}
                icon={tabIcon(
                  list.icon,
                  list.label,
                  list.iconColor ? undefined : list.iconClass,
                  list.iconColor,
                )}
              >
                {!collapsed && (
                  <TabLabel label={list.label} count={counts[list.id]} />
                )}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
        {!collapsed && visibleLists.length === 0 && (
          <div className="text-muted fs-small px-3 pb-2">
            No lists match “{search}”.
          </div>
        )}
      </div>
    </Card>
  );
}
