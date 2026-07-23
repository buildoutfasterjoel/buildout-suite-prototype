import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faUser,
  faHandshake,
  faSparkles,
  faMicrophone,
  faXmark,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { searchAll } from "#/data/selectors";
import { getProperty } from "#/data/store";
import { useDataStore } from "#/data/dataStore";
import type { Property, Listing, Contact } from "#/data/types";
import { useAssistant } from "#/ai/useAssistant";
import { useCreateDeal } from "#/data/useCreateDeal";
import { useOmniSearch } from "#/components/search/useOmniSearch";
import { OmniSparkleIcon } from "#/components/search/OmniSparkleIcon";

/** Max rows shown per entity group in the palette. */
const GROUP_CAP = 5;

/** Turn a PropertyStatus like "under-contract" into "Under contract". */
function statusLabel(status: string): string {
  const s = status.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Escape a user token so it can be dropped into a RegExp literal safely. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Render `text` with any occurrence of the query's whitespace-separated tokens
 * wrapped in bold, so the matched substrings stand out from the rest of the row
 * (e.g. searching "San" bolds the "San" in "Sandra Vega").
 */
function highlight(text: string, query: string): ReactNode {
  const tokens = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (tokens.length === 0) return text;
  // One capturing group → split() interleaves matches at the odd indices.
  const parts = text.split(new RegExp(`(${tokens.join("|")})`, "ig"));
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="fw-bold text-body">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** The result-scope tabs across the top of the palette. */
type TabKey = "all" | "contacts" | "properties" | "deals";
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "contacts", label: "Contacts" },
  { key: "properties", label: "Properties" },
  { key: "deals", label: "Deals" },
];

type GroupName = "Contacts" | "Properties" | "Deals";

/** Colored icon-badge treatment for a palette row. */
type IconVariant = "contact" | "property" | "deal" | "ai";

/** A selectable palette row (record) or a trailing quick action. */
type Entry = {
  kind: "record" | "ai" | "create";
  key: string;
  group?: GroupName;
  iconVariant: IconVariant;
  icon: IconDefinition;
  title: string;
  meta?: string;
  /** Right-aligned entity/action label (e.g. "Contact", "Ask AI"). */
  typeLabel: string;
  activate: () => void;
};

/** The 36px colored icon badge that leads each row. */
function OmniItemIcon({
  variant,
  icon,
}: {
  variant: IconVariant;
  icon: IconDefinition;
}) {
  return (
    <span className={`omni-item__icon omni-item__icon--${variant}`}>
      <FontAwesomeIcon icon={icon} />
    </span>
  );
}

export function OmniSearch() {
  const open = useOmniSearch((s) => s.open);
  const setOpen = useOmniSearch((s) => s.setOpen);
  const askAssistant = useAssistant((s) => s.ask);
  const router = useRouter();

  // Reactive entity maps power the empty-query "browse" state (before the user
  // types), so the tabs are useful immediately.
  const properties = useDataStore((s) => s.properties);
  const contacts = useDataStore((s) => s.contacts);
  const listings = useDataStore((s) => s.listings);

  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setQuery("");
    setTab("all");
  }

  const navigate = (to: string) => {
    router.navigate({ to: to as never });
    close();
  };

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim();

    // With a query, use the fuzzy search; otherwise browse the full set so the
    // palette (and its tabs) has content before the user types.
    const matched = q
      ? searchAll(q)
      : {
          properties: [...properties.values()] as Property[],
          deals: [...listings.values()] as Listing[],
          contacts: [...contacts.values()] as Contact[],
        };

    const showGroup = (g: GroupName) =>
      tab === "all" ||
      (tab === "contacts" && g === "Contacts") ||
      (tab === "properties" && g === "Properties") ||
      (tab === "deals" && g === "Deals");

    const list: Entry[] = [];

    if (showGroup("Contacts")) {
      for (const c of matched.contacts.slice(0, GROUP_CAP)) {
        list.push({
          kind: "record",
          key: `contact-${c.id}`,
          group: "Contacts",
          iconVariant: "contact",
          icon: faUser,
          title: `${c.firstName} ${c.lastName}`.trim(),
          meta: [c.title, c.company].filter(Boolean).join(" · "),
          typeLabel: "Contact",
          activate: () => navigate(`/backoffice/contacts/${c.id}`),
        });
      }
    }

    if (showGroup("Properties")) {
      for (const p of matched.properties.slice(0, GROUP_CAP)) {
        list.push({
          kind: "record",
          key: `property-${p.id}`,
          group: "Properties",
          iconVariant: "property",
          icon: faBuilding,
          title: p.name,
          meta: [p.street, [p.city, p.state].filter(Boolean).join(", ")]
            .filter(Boolean)
            .join(" · "),
          typeLabel: "Property",
          activate: () => navigate(`/properties/${p.id}`),
        });
      }
    }

    if (showGroup("Deals")) {
      for (const d of matched.deals.slice(0, GROUP_CAP)) {
        const p = getProperty(d.propertyId);
        list.push({
          kind: "record",
          key: `deal-${d.id}`,
          group: "Deals",
          iconVariant: "deal",
          icon: faHandshake,
          title: d.name,
          meta: [statusLabel(d.status), [p?.city, p?.state].filter(Boolean).join(", ")]
            .filter(Boolean)
            .join(" · "),
          typeLabel: "Deal",
          activate: () => navigate(`/listings/${d.id}`),
        });
      }
    }

    // Quick actions only make sense once there's query text to act on. The
    // Ask-AI action leads (it's the primary fallback when nothing matches),
    // followed by Create deal.
    if (q) {
      list.push({
        kind: "ai",
        key: "ai",
        iconVariant: "ai",
        icon: faSparkles,
        title: `Ask AI: “${q}”`,
        typeLabel: "Ask AI",
        activate: () => {
          askAssistant(q);
          close();
        },
      });

      list.push({
        kind: "create",
        key: "create",
        iconVariant: "deal",
        icon: faHandshake,
        title: `Create deal for “${q}”`,
        typeLabel: "Create",
        activate: () => {
          useCreateDeal.getState().openFor({ initialAddress: q });
          close();
        },
      });
    }

    return list;
    // `navigate`/`askAssistant`/`close` are stable enough for this ephemeral
    // UI; recompute whenever the query, tab, or underlying data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tab, properties, contacts, listings]);

  // Highlight the first row on each new query or tab change.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, tab]);

  // Focus the search input when the palette opens (after the modal mounts).
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      contentRef.current?.querySelector("input")?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Keep the highlighted row scrolled into view during keyboard navigation.
  useEffect(() => {
    contentRef.current
      ?.querySelector(`[data-omni-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (entries.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(entries.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      entries[activeIndex]?.activate();
    }
  }

  return (
    <Modal open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <Modal.Content className="p-0 omni-search-popup" scrollable>
        <Modal.Title className="visually-hidden">
          Search contacts, properties, and deals
        </Modal.Title>

        <div ref={contentRef} onKeyDown={handleKeyDown}>
          {/* Search field — the gradient "AI omnibar" */}
          <div className="omni-menu__bar-wrap">
            <div className="omni-menu__bar">
              <span className="omni-menu__bar-icon">
                <OmniSparkleIcon />
              </span>
              <Input
                className="omni-menu__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search or ask AI"
                aria-label="Search"
              />
              <button
                type="button"
                className="omni-menu__icon-btn omni-menu__voice"
                aria-label="Voice search"
              >
                <FontAwesomeIcon icon={faMicrophone} />
              </button>
              <button
                type="button"
                className="omni-menu__icon-btn"
                aria-label="Close search"
                onClick={close}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          </div>

          {/* Scope tabs */}
          <Tabs
            className="omni-tabs"
            value={tab}
            onValueChange={(v) => setTab(v as TabKey)}
          >
            <Tabs.List>
              {TABS.map((t) => (
                <Tabs.Tab key={t.key} value={t.key}>
                  {t.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>

          {/* Results */}
          <div className="omni-menu__body overflow-auto" style={{ maxHeight: 440 }}>
            {entries.length === 0 ? (
              <div className="text-muted small px-3 py-4 text-center">
                No matches. Try a different search, or ask the assistant.
              </div>
            ) : (
              entries.map((entry, index) => {
                const active = index === activeIndex;
                const showHeader =
                  entry.kind === "record" &&
                  (index === 0 ||
                    entries[index - 1].kind !== "record" ||
                    entries[index - 1].group !== entry.group);
                const showTopSeparator =
                  (entry.kind === "ai" || entry.kind === "create") &&
                  index > 0 &&
                  entries[index - 1].kind === "record";

                return (
                  <div key={entry.key}>
                    {showHeader && entry.group && (
                      <div className="omni-group">{entry.group}</div>
                    )}
                    {showTopSeparator && <hr className="omni-sep" />}
                    <button
                      type="button"
                      data-omni-index={index}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => entry.activate()}
                      className={`omni-item ${active ? "is-active" : ""}`}
                    >
                      <OmniItemIcon variant={entry.iconVariant} icon={entry.icon} />
                      <span className="omni-item__label">
                        <span className="omni-item__title text-truncate">
                          {entry.kind === "record"
                            ? highlight(entry.title, query)
                            : entry.title}
                        </span>
                        {entry.meta && (
                          <span className="omni-item__meta text-truncate">
                            {highlight(entry.meta, query)}
                          </span>
                        )}
                      </span>
                      <span className="omni-item__type">{entry.typeLabel}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal.Content>
    </Modal>
  );
}
