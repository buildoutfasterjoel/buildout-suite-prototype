import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faBuilding,
  faUser,
  faHandshake,
  faSparkles,
  faChevronRight,
  faArrowTurnDownLeft,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { searchAll } from "#/data/selectors";
import { useAssistant } from "#/ai/useAssistant";
import { useCreateDeal } from "#/data/useCreateDeal";
import { useOmniSearch } from "#/components/search/useOmniSearch";

/** Max rows shown per entity group in the palette. */
const GROUP_CAP = 5;

const RELATIONSHIP_LABELS: Record<string, string> = {
  cold: "Cold",
  nurturing: "Nurturing",
  active: "Active",
  pitching: "Pitching",
  client: "Client",
  past_client: "Past client",
};

/** Turn a PropertyStatus like "under-contract" into "Under contract". */
function statusLabel(status: string): string {
  const s = status.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type GroupName = "Properties" | "People" | "Deals";

/** A selectable palette row (record) or the trailing Ask-AI action. */
type Entry =
  | {
      kind: "record";
      key: string;
      group: GroupName;
      icon: IconDefinition;
      title: string;
      meta?: string;
      badge?: string;
      activate: () => void;
    }
  | {
      kind: "ai";
      key: "ai";
      icon: IconDefinition;
      title: string;
      activate: () => void;
    }
  | {
      kind: "create";
      key: "create";
      icon: IconDefinition;
      title: string;
      activate: () => void;
    };

export function OmniSearch() {
  const open = useOmniSearch((s) => s.open);
  const setOpen = useOmniSearch((s) => s.setOpen);
  const askAssistant = useAssistant((s) => s.ask);
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setQuery("");
  }

  const navigate = (to: string) => {
    router.navigate({ to: to as never });
    close();
  };

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim();
    if (!q) return [];

    const { properties, deals, contacts } = searchAll(q);
    const list: Entry[] = [];

    for (const p of properties.slice(0, GROUP_CAP)) {
      list.push({
        kind: "record",
        key: `property-${p.id}`,
        group: "Properties",
        icon: faBuilding,
        title: p.name,
        meta: [p.street, [p.city, p.state].filter(Boolean).join(", ")]
          .filter(Boolean)
          .join(" · "),
        activate: () => navigate(`/properties/${p.id}`),
      });
    }

    for (const c of contacts.slice(0, GROUP_CAP)) {
      list.push({
        kind: "record",
        key: `contact-${c.id}`,
        group: "People",
        icon: faUser,
        title: `${c.firstName} ${c.lastName}`.trim(),
        meta: [c.title, c.company].filter(Boolean).join(" · "),
        badge: c.relationship
          ? (RELATIONSHIP_LABELS[c.relationship] ?? c.relationship)
          : undefined,
        activate: () => navigate(`/backoffice/contacts/${c.id}`),
      });
    }

    for (const d of deals.slice(0, GROUP_CAP)) {
      list.push({
        kind: "record",
        key: `deal-${d.id}`,
        group: "Deals",
        icon: faHandshake,
        title: d.name,
        meta: [d.city, d.state].filter(Boolean).join(", "),
        badge: statusLabel(d.status),
        activate: () => navigate(`/listings/${d.id}`),
      });
    }

    // A "Create deal" quick action is always available for a non-empty query,
    // seeding the create-deal modal's address field with the raw query text.
    list.push({
      kind: "create",
      key: "create",
      icon: faHandshake,
      title: `Create deal for “${q}”`,
      activate: () => {
        useCreateDeal.getState().openFor({ initialAddress: q });
        close();
      },
    });

    // The Ask-AI action is always available for a non-empty query. When there
    // are no record matches it becomes the only (and thus auto-highlighted) row.
    list.push({
      kind: "ai",
      key: "ai",
      icon: faSparkles,
      title: `Ask AI: “${q}”`,
      activate: () => {
        askAssistant(q);
        close();
      },
    });

    return list;
    // `navigate`/`askAssistant`/`close` are stable enough for this ephemeral UI;
    // recompute whenever the query changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Highlight the first row (a record if any, else the Ask-AI row) on each new query.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

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
      <Modal.Content className="p-0" scrollable centered>
        <Modal.Title className="visually-hidden">
          Search properties, people, and deals
        </Modal.Title>

        <div ref={contentRef} onKeyDown={handleKeyDown}>
          {/* Search field */}
          <div className="p-2 border-bottom">
            <InputGroup>
              <InputGroup.Addon>
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="text-muted"
                />
              </InputGroup.Addon>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search properties, people, deals — or ask a question…"
                aria-label="Search"
              />
            </InputGroup>
          </div>

          {/* Results */}
          <div className="overflow-auto py-2" style={{ maxHeight: 440 }}>
            {query.trim() === "" ? (
              <div className="text-muted small px-3 py-4 text-center">
                Search across properties, people, and deals. Ask a question and
                the assistant will take it from here.
              </div>
            ) : (
              entries.map((entry, index) => {
                const active = index === activeIndex;
                const showHeader =
                  entry.kind === "record" &&
                  (index === 0 ||
                    entries[index - 1].kind !== "record" ||
                    (entries[index - 1] as Extract<Entry, { kind: "record" }>)
                      .group !== entry.group);
                const showTopSeparator =
                  (entry.kind === "ai" || entry.kind === "create") &&
                  index > 0 &&
                  entries[index - 1].kind === "record";

                return (
                  <div key={entry.key}>
                    {showHeader && entry.kind === "record" && (
                      <div className="text-muted fs-xs text-uppercase fw-semibold px-3 pt-2 pb-1">
                        {entry.group}
                      </div>
                    )}
                    {showTopSeparator && <hr className="my-2" />}
                    <button
                      type="button"
                      data-omni-index={index}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => entry.activate()}
                      className={`btn w-100 text-start border-0 rounded-0 d-flex align-items-center gap-3 px-3 py-2 ${
                        active ? "bg-buildout-blue-50" : "bg-transparent"
                      }`}
                    >
                      <FontAwesomeIcon
                        icon={entry.icon}
                        className={
                          entry.kind === "record"
                            ? "text-muted"
                            : "text-buildout-blue-700"
                        }
                      />
                      <span className="flex-grow-1" style={{ minWidth: 0 }}>
                        <span className="d-block fw-semibold text-truncate">
                          {entry.title}
                        </span>
                        {entry.kind === "record" && entry.meta && (
                          <span className="d-block text-muted small text-truncate">
                            {entry.meta}
                          </span>
                        )}
                      </span>
                      {entry.kind === "record" && entry.badge && (
                        <Badge
                          variant="secondary"
                          appearance="muted"
                          className="flex-shrink-0"
                        >
                          {entry.badge}
                        </Badge>
                      )}
                      <FontAwesomeIcon
                        icon={active ? faArrowTurnDownLeft : faChevronRight}
                        className="text-muted flex-shrink-0"
                      />
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
