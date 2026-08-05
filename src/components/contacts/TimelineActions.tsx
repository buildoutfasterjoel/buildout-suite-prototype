import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faThumbtack,
  faPhone,
  faEnvelope,
  faReply,
  faReplyAll,
  faShare,
  faPencil,
  faTrash,
  faEllipsisVertical,
} from "@fortawesome/pro-regular-svg-icons";
import {
  OVERFLOW_ITEMS,
  TYPE_CONFIG,
  type FabChannel,
  type TimelineEventType,
  type TypeConfig,
} from "#/components/contacts/timeline";

export type ActionDispatch = (id: string) => void;

/**
 * The needs-attention action bar: one filled primary, the type's outlined
 * seconds, then Dismiss. Labels come from the per-type config so a missed call
 * offers "Call back" where an email offers "Reply".
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
        <Button
          key={g}
          variant="outline"
          size="sm"
          className="tl-actionbar__secondary"
          onClick={() => onAction(g)}
        >
          {g}
        </Button>
      ))}
      {/* "Seen it, no response needed" — clears the attention state (greys the
          bubble, removes the bar) without logging any follow-up. Ghost, because
          it's the one action that resolves the row by doing nothing to it. */}
      <Button
        variant="ghost"
        size="sm"
        className="tl-actionbar__dismiss"
        onClick={() => onAction("Dismiss")}
      >
        Dismiss
      </Button>
    </div>
  );
}

/** The channel buttons a FAB carries, keyed by the type's channel. */
const FAB_BUTTONS: Record<
  FabChannel,
  { id: string; icon: IconDefinition; label: string }[]
> = {
  none: [],
  call: [{ id: "Call", icon: faPhone, label: "Call" }],
  email: [
    { id: "Reply", icon: faReply, label: "Reply" },
    { id: "Reply all", icon: faReplyAll, label: "Reply all" },
    { id: "Forward", icon: faShare, label: "Forward" },
  ],
  // An inquiry has no message to reply to — it's a first-contact decision, so
  // the FAB offers the two channels rather than a reply.
  inquiry: [
    { id: "Email", icon: faEnvelope, label: "Email" },
    { id: "Call", icon: faPhone, label: "Call" },
  ],
};

/**
 * One icon button inside a FAB. Tooltipped, because a bare glyph in a hover
 * overlay is the easiest place in the feed to guess wrong.
 */
function FabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: IconDefinition;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <button
            type="button"
            className={`tl-fab__btn${active ? " is-active" : ""}`}
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
          >
            <FontAwesomeIcon icon={icon} />
          </button>
        }
      />
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

/**
 * The floating action bar revealed on row hover, offset above the row's top edge.
 * Pin leads, the type's channel actions sit in the middle, and the overflow
 * trigger closes it — so the button count varies by event while the shell stays
 * identical.
 */
export function TimelineFab({
  type,
  pinned,
  onAction,
}: {
  type: TimelineEventType;
  pinned: boolean;
  onAction: ActionDispatch;
}) {
  const channel = TYPE_CONFIG[type].fab ?? "none";
  return (
    <div className="tl-fab">
      <FabButton
        icon={faThumbtack}
        label={pinned ? "Unpin" : "Pin to Top"}
        active={pinned}
        onClick={() => onAction("Pin to top")}
      />
      {FAB_BUTTONS[channel].map((b) => (
        <FabButton
          key={b.id}
          icon={b.icon}
          label={b.label}
          onClick={() => onAction(b.id)}
        />
      ))}
      <TimelineOverflowMenu pinned={pinned} onAction={onAction} />
    </div>
  );
}

/** Glyphs for the three overflow items. */
const OVERFLOW_ICONS: Record<string, IconDefinition> = {
  "Pin to Top": faThumbtack,
  Edit: faPencil,
  Delete: faTrash,
};

/**
 * The overflow menu — Pin / Edit / Delete on every row. Delete is destructive
 * and reads that way.
 */
export function TimelineOverflowMenu({
  pinned,
  onAction,
}: {
  pinned: boolean;
  onAction: ActionDispatch;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <button type="button" className="tl-fab__btn" aria-label="More actions">
            <FontAwesomeIcon icon={faEllipsisVertical} />
          </button>
        }
      />
      <DropdownMenu.Content align="end" className="tl-menu">
        {OVERFLOW_ITEMS.map((item) => (
          <DropdownMenu.Item
            key={item}
            // The menu's pin row mirrors the FAB's pin button, so it has to say
            // which way it will go — otherwise a pinned row offers "Pin to Top".
            onClick={() => onAction(item === "Pin to Top" ? "Pin to top" : item)}
            className={item === "Delete" ? "tl-menu__danger" : undefined}
          >
            <FontAwesomeIcon icon={OVERFLOW_ICONS[item]} className="tl-menu__icon" />
            {item === "Pin to Top" && pinned ? "Unpin" : item}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

/**
 * The three-button FAB on a single message inside an expanded email thread —
 * reply / reply all / forward, scoped to that message rather than the thread.
 */
export function ThreadMessageFab({ onAction }: { onAction: ActionDispatch }) {
  return (
    <div className="tl-fab tl-fab--msg">
      {FAB_BUTTONS.email.map((b) => (
        <FabButton
          key={b.id}
          icon={b.icon}
          label={b.label}
          onClick={() => onAction(b.id)}
        />
      ))}
    </div>
  );
}
