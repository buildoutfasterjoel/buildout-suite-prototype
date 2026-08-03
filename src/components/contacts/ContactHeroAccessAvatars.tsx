import type { KeyboardEvent } from "react";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserGear } from "@fortawesome/pro-regular-svg-icons";
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
  /** The owner leads the cluster with an offset ring, outside the group. */
  isOwner?: boolean;
  onOpenShare: () => void;
}) {
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <Avatar
            role="button"
            tabIndex={0}
            aria-label={`${name} · ${access} — manage sharing`}
            className={`contact-hero__access${
              isOwner ? " contact-hero__owner-avatar" : ""
            }`}
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
 * The contact hero's access cluster, sitting next to the stage badge: the owner
 * stands alone with an offset ring — they're the one accountable for the record,
 * not one of a crowd — and everyone else with access stacks into an overlapping
 * avatar group beside them. Every avatar still reveals a name + access-level
 * tooltip on hover and opens the sharing modal on click.
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
      {shares.length > 0 && (
        <Avatar.Group className="contact-hero__access-group">
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
        </Avatar.Group>
      )}
      <Tooltip>
        <Tooltip.Trigger
          render={
            <Button
              variant="ghost"
              appearance="muted"
              size="icon-sm"
              aria-label="Manage sharing"
              onClick={onOpenShare}
              className="contact-hero__share-btn"
            >
              <FontAwesomeIcon icon={faUserGear} />
            </Button>
          }
        />
        <Tooltip.Content>Manage sharing</Tooltip.Content>
      </Tooltip>
    </div>
  );
}
