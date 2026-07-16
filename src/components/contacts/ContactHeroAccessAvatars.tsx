import type { KeyboardEvent } from "react";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import {
  CURRENT_USER,
  accessTierLabel,
  type ContactShare,
} from "#/data/teammates";

/**
 * A single hover-tooltip avatar: photo (or initials fallback) + "Name · Access"
 * tooltip. Clicking opens the sharing modal.
 */
function AccessAvatar({
  initials,
  name,
  access,
  avatarUrl,
  isOwner,
  onOpenShare,
}: {
  initials: string;
  name: string;
  access: string;
  avatarUrl?: string;
  isOwner?: boolean;
  onOpenShare: () => void;
}) {
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <Avatar
            size="sm"
            role="button"
            tabIndex={0}
            aria-label={`${name} · ${access} — manage sharing`}
            className={`contact-hero__access ${isOwner ? "contact-hero__owner-avatar" : "contact-access-avatar"}`}
            onClick={onOpenShare}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenShare();
              }
            }}
          >
            {avatarUrl && <Avatar.Image src={avatarUrl} alt={name} />}
            <Avatar.Fallback className="fw-semibold">
              {initials}
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

/**
 * The contact hero's access cluster: individual avatars (not a stacked group)
 * sitting next to the stage badge. The owner leads with an offset ring; each
 * avatar reveals a name + access-level tooltip on hover and opens the sharing
 * modal on click.
 */
export function ContactHeroAccessAvatars({
  shares,
  onOpenShare,
}: {
  shares: ContactShare[];
  onOpenShare: () => void;
}) {
  return (
    <div className="d-flex align-items-center" style={{ gap: 4 }}>
      <AccessAvatar
        initials={CURRENT_USER.initials}
        name={CURRENT_USER.name}
        access="Owner"
        avatarUrl={CURRENT_USER.avatarUrl}
        isOwner
        onOpenShare={onOpenShare}
      />
      {shares.map((s) => (
        <AccessAvatar
          key={s.member.id}
          initials={s.member.initials}
          name={s.member.name}
          access={accessTierLabel(s.tier)}
          avatarUrl={s.member.avatarUrl}
          onOpenShare={onOpenShare}
        />
      ))}
    </div>
  );
}
