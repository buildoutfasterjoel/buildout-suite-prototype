import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStar,
  faThumbtack,
  faComment,
  faEllipsis,
} from "@fortawesome/pro-regular-svg-icons";
import { faStar as faStarSolid } from "@fortawesome/pro-solid-svg-icons";
import {
  TYPE_CONFIG,
  UNIVERSAL_OVERFLOW,
  type TimelineEventType,
  type TypeConfig,
} from "#/components/contacts/timeline";

export type ActionDispatch = (id: string) => void;

/**
 * Tier-1 action bar — a primary action plus up to two ghosts, always visible on
 * actionable rows. Labels come from the per-type config so a call shows
 * "Call back" where an email shows "Reply".
 */
export function TimelineActionBar({
  actionBar,
  onAction,
}: {
  actionBar: NonNullable<TypeConfig["actionBar"]>;
  onAction: ActionDispatch;
}) {
  if (!actionBar.primary) return null;
  return (
    <div className="tl-actionbar">
      <Button variant="primary" size="sm" onClick={() => onAction(actionBar.primary!)}>
        {actionBar.primary}
      </Button>
      {(actionBar.ghosts ?? []).map((g) => (
        <Button key={g} variant="outline" size="sm" onClick={() => onAction(g)}>
          {g}
        </Button>
      ))}
    </div>
  );
}

/**
 * Tier-2 hover toolbar — quick secondary actions (star / pin / comment) plus the
 * Tier-3 overflow trigger. Appears on row hover/focus (see SCSS).
 */
export function TimelineHoverToolbar({
  type,
  starred,
  pinned,
  onAction,
}: {
  type: TimelineEventType;
  starred: boolean;
  pinned: boolean;
  onAction: ActionDispatch;
}) {
  return (
    <div className="tl-toolbar">
      <button
        type="button"
        className={`tl-toolbar__btn ${starred ? "is-active" : ""}`}
        aria-label={starred ? "Unstar" : "Star"}
        aria-pressed={starred}
        onClick={() => onAction("Star")}
      >
        <FontAwesomeIcon icon={starred ? faStarSolid : faStar} />
      </button>
      <button
        type="button"
        className={`tl-toolbar__btn ${pinned ? "is-active" : ""}`}
        aria-label={pinned ? "Unpin" : "Pin to top"}
        aria-pressed={pinned}
        onClick={() => onAction("Pin to top")}
      >
        <FontAwesomeIcon icon={faThumbtack} />
      </button>
      <button
        type="button"
        className="tl-toolbar__btn"
        aria-label="Comment"
        onClick={() => onAction("Comment")}
      >
        <FontAwesomeIcon icon={faComment} />
      </button>
      <TimelineOverflowMenu type={type} onAction={onAction} />
    </div>
  );
}

/**
 * Tier-3 overflow menu — type-specific items on top (e.g. "Play recording",
 * "View change log"), then the universal set. Delete is destructive.
 */
export function TimelineOverflowMenu({
  type,
  onAction,
}: {
  type: TimelineEventType;
  onAction: ActionDispatch;
}) {
  const topItems = TYPE_CONFIG[type].overflow ?? [];
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <button type="button" className="tl-toolbar__btn" aria-label="More actions">
            <FontAwesomeIcon icon={faEllipsis} />
          </button>
        }
      />
      <DropdownMenu.Content align="end" className="tl-menu">
        {topItems.map((item) => (
          <DropdownMenu.Item key={item} onClick={() => onAction(item)}>
            {item}
          </DropdownMenu.Item>
        ))}
        {topItems.length > 0 && <DropdownMenu.Separator />}
        {UNIVERSAL_OVERFLOW.map((item) => (
          <DropdownMenu.Item
            key={item}
            onClick={() => onAction(item)}
            className={item === "Delete" ? "tl-menu__danger" : undefined}
          >
            {item}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
