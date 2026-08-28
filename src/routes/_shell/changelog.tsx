import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCodePullRequest } from "@fortawesome/pro-regular-svg-icons";
import {
  CHANGELOG,
  KIND_ORDER,
  REPO_URL,
  groupByDay,
  kindCounts,
  type ChangeKind,
  type ChangelogEntry,
} from "#/components/changelog/changelogEntries";
import { CHANGE_KIND_META } from "#/components/changelog/changeKindMeta";
import { ChangelogEntryCard } from "#/components/changelog/ChangelogEntryCard";
import { formatLongDate } from "#/components/deals/dealDisplay";

export const Route = createFileRoute("/_shell/changelog")({
  component: ChangelogPage,
  head: () => ({ meta: [{ title: "What's New | Buildout Suite" }] }),
});

type Filter = ChangeKind | "all";

function ChangelogPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => kindCounts(CHANGELOG), []);
  const totalChanges = KIND_ORDER.reduce((sum, k) => sum + counts[k], 0);

  /**
   * Filtering drops the lines that don't match, not just the entries — a PR
   * that shipped one fix among four features should show that fix and nothing
   * else under "Bug fixes", or the filter is only a search for cards.
   */
  const shown = useMemo<
    Array<{ entry: ChangelogEntry; highlights: ChangelogEntry["highlights"] }>
  >(() => {
    if (filter === "all") {
      return CHANGELOG.map((entry) => ({
        entry,
        highlights: entry.highlights,
      }));
    }
    return CHANGELOG.map((entry) => ({
      entry,
      highlights: entry.highlights.filter((h) => h.kind === filter),
    })).filter((row) => row.highlights.length > 0);
  }, [filter]);

  const days = useMemo(
    () => groupByDay(shown.map((row) => row.entry)),
    [shown],
  );
  const highlightsByPr = useMemo(
    () => new Map(shown.map((row) => [row.entry.pr, row.highlights])),
    [shown],
  );

  return (
    <div className="p-4 changelog">
      <header className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="fs-5 fw-semibold mb-1">What's New</h1>
          <p className="text-muted mb-0">
            Every change to the prototype, newest first. Each entry links to the
            pull request it came from.
          </p>
        </div>
        <a
          className="changelog-entry__pr d-inline-flex align-items-center gap-2 text-decoration-none"
          href={`${REPO_URL}/pulls?q=is%3Apr+is%3Amerged`}
          target="_blank"
          rel="noreferrer"
          aria-label="All merged pull requests on GitHub"
        >
          <FontAwesomeIcon icon={faCodePullRequest} aria-hidden />
          <span className="fw-semibold">All pull requests</span>
        </a>
      </header>

      {/* Toggle buttons rather than tabs: this filters one list in place, and
          tabs promise panels that swap. Counts are of *changes*, not entries,
          because that's what the filter acts on. */}
      <div
        className="d-flex align-items-center flex-wrap gap-2 mb-5"
        role="group"
        aria-label="Filter changes by type"
      >
        <FilterChip
          label="Everything"
          count={totalChanges}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        {KIND_ORDER.map((kind) => (
          <FilterChip
            key={kind}
            label={CHANGE_KIND_META[kind].label}
            count={counts[kind]}
            icon={kind}
            active={filter === kind}
            onClick={() => setFilter(kind)}
          />
        ))}
      </div>

      <div className="d-flex flex-column gap-5">
        {days.map((day) => (
          <section className="changelog__day" key={day.day}>
            {/* The date sits in a gutter beside its entries rather than as a
                heading above them, so a day's worth of work reads as one block
                and the date stays visible while you scroll through it. */}
            <div className="changelog__date">
              <div className="fw-semibold">{formatLongDate(day.day)}</div>
              <div className="small text-muted">
                {day.entries.length}{" "}
                {day.entries.length === 1 ? "release" : "releases"}
              </div>
            </div>
            <div className="d-flex flex-column gap-3">
              {day.entries.map((entry) => (
                <ChangelogEntryCard
                  key={entry.pr}
                  entry={entry}
                  highlights={highlightsByPr.get(entry.pr)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  icon,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon?: ChangeKind;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "primary" : "outline"}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
    >
      {icon && <FontAwesomeIcon icon={CHANGE_KIND_META[icon].icon} aria-hidden />}
      {label}
      <span className={active ? "opacity-75" : "text-muted"}>{count}</span>
    </Button>
  );
}
