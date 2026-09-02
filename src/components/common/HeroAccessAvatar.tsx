import type { KeyboardEvent, ReactNode } from "react";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";

/**
 * One hover-tooltip avatar in a record's access cluster: photo (or a fallback)
 * plus a "Name · Access" tooltip. Clicking opens whatever manages access on
 * that record — the contact's sharing modal, the deal's Manage Access modal.
 *
 * Shared by the contact hero and the deal header, which is why it lives here
 * and wears the `hero-access__*` classes (main.scss) rather than either page's.
 */
export function HeroAccessAvatar({
  fallback,
  name,
  access,
  avatarUrl,
  isOwner,
  fallbackClassName,
  onOpenShare,
  actionLabel = "manage sharing",
}: {
  /** Undefined when the viewer can't manage access — the avatar just identifies. */
  onOpenShare?: () => void;
  /** Initials, or an icon for the company. */
  fallback: ReactNode;
  name: string;
  access: string;
  avatarUrl?: string;
  /** The owner leads the cluster with an offset ring, outside the group. */
  isOwner?: boolean;
  fallbackClassName?: string;
  /** What clicking does, for the screen-reader name — "manage access" on a deal. */
  actionLabel?: string;
}) {
  const interactive = !!onOpenShare;
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <Avatar
            role={interactive ? "button" : undefined}
            tabIndex={0}
            aria-label={`${name} · ${access}${interactive ? ` — ${actionLabel}` : ""}`}
            className={`${interactive ? "hero-access__avatar" : ""}${
              isOwner ? " hero-access__owner" : ""
            }`}
            onClick={onOpenShare}
            onKeyDown={(e: KeyboardEvent) => {
              if (interactive && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onOpenShare();
              }
            }}
          >
            {avatarUrl && <Avatar.Image src={avatarUrl} alt={name} />}
            <Avatar.Fallback className={`fw-semibold ${fallbackClassName ?? ""}`}>
              {fallback}
            </Avatar.Fallback>
          </Avatar>
        }
      />
      <Tooltip.Content>
        {name} · {access}
      </Tooltip.Content>
    </Tooltip>
  );
}
