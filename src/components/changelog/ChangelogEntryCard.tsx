import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCodePullRequest } from "@fortawesome/pro-regular-svg-icons";
import {
  CHANGE_KIND_META,
  authorName,
  entryKinds,
  prUrl,
  type ChangeKind,
  type ChangelogEntry,
} from "./changelogEntries";

/**
 * The kind pill — "New", "Refined", "Fixed".
 *
 * An `outline` Badge tinted through the theme's own badge custom properties,
 * the same move `.ingestion-conflict__badge` makes: Blueprint's Badge has three
 * variants and none of them is "this is a bug fix", and three kinds need three
 * colours to be scannable down a page. The glyph changes with the colour so the
 * three stay three in a screenshot and to anyone who does not separate them.
 */
export function ChangeKindBadge({ kind }: { kind: ChangeKind }) {
  const meta = CHANGE_KIND_META[kind];
  return (
    <Badge
      variant="outline"
      className={`changelog-kind ${meta.className} d-inline-flex align-items-center gap-1`}
    >
      <FontAwesomeIcon icon={meta.icon} aria-hidden />
      {meta.short}
    </Badge>
  );
}

/**
 * One merged pull request.
 *
 * The header says the shape of the change — which kinds it contains, and where
 * it landed — and the list below says the substance. Kinds are named once, at
 * the top, rather than repeated on every bullet: at four bullets a pill per
 * line turns the list into a column of badges with sentences attached, and the
 * eye stops reading the sentences.
 *
 * `highlights` is passed in rather than read off `entry` so a filtered view can
 * hand over only the lines that matched. The pills are derived from what's
 * shown, so filtering to Fixes leaves a card that says "Fixed" and nothing else.
 */
export function ChangelogEntryCard({
  entry,
  highlights = entry.highlights,
}: {
  entry: ChangelogEntry;
  highlights?: ChangelogEntry["highlights"];
}) {
  const kinds = entryKinds({ ...entry, highlights });

  return (
    <Card className="shadow-sm changelog-entry">
      <div className="d-flex flex-column gap-3 p-4">
        <div className="d-flex align-items-start justify-content-between gap-3">
          <div style={{ minWidth: 0 }}>
            <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
              {kinds.map((kind) => (
                <ChangeKindBadge key={kind} kind={kind} />
              ))}
              {entry.area && (
                <Badge variant="secondary" appearance="muted">
                  {entry.area}
                </Badge>
              )}
            </div>
            <h3 className="fs-6 fw-semibold mb-0">{entry.title}</h3>
          </div>

          {/* The PR link is an `<a>`, not a `Link` — it leaves the app. It also
              carries the number rather than the word "GitHub", because the
              number is the thing anyone cross-referencing a review is holding. */}
          <a
            className="changelog-entry__pr flex-shrink-0 d-inline-flex align-items-center gap-2 text-decoration-none"
            href={prUrl(entry.pr)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Pull request ${entry.pr} on GitHub`}
          >
            <FontAwesomeIcon icon={faCodePullRequest} aria-hidden />
            <span className="fw-semibold">#{entry.pr}</span>
          </a>
        </div>

        <p className="text-muted mb-0">{entry.summary}</p>

        <ul className="changelog-entry__highlights mb-0">
          {highlights.map((highlight) => (
            <li key={highlight.text}>{highlight.text}</li>
          ))}
        </ul>

        <div className="small text-muted">{authorName(entry.author)}</div>
      </div>
    </Card>
  );
}
