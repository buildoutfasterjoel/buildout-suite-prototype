import { useState } from "react";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserGear } from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { HeroAccessAvatar } from "#/components/common/HeroAccessAvatar";
import { ManageDealAccessModal } from "./ManageDealAccessModal";
import {
  brokerInitials,
  brokerTeammate,
  dealCreator,
  dealTeamBrokers,
} from "./dealAccess";

/**
 * The deal header's access cluster — the same shape the contact hero uses.
 *
 * The creator stands alone with an offset ring: they opened the deal, and that
 * doesn't change hands. Everyone else who can open it stacks into an
 * overlapping group beside them, and the user-gear button opens the modal that
 * says who they are. Every avatar is also a way into that modal, so the whole
 * cluster answers "who has this?" on hover and "change it" on click.
 *
 * Access is the deal team today (see `dealAccess.ts`), so the group is a deal's
 * internal brokers. When roles beyond brokers can be granted access, they join
 * the group here without this component changing shape.
 */
export function DealHeroAccessAvatars({ listing }: { listing: Listing }) {
  const [manageOpen, setManageOpen] = useState(false);
  const creator = dealCreator(listing);
  const team = dealTeamBrokers(listing);
  const open = () => setManageOpen(true);

  return (
    <div className="d-flex align-items-center" style={{ gap: 4 }}>
      <HeroAccessAvatar
        fallback={creator.initials}
        name={creator.name}
        access="Created this deal"
        avatarUrl={creator.avatarUrl}
        isOwner
        actionLabel="manage access"
        onOpenShare={open}
      />

      {team.length > 0 && (
        <Avatar.Group className="hero-access__group">
          {team.map((b) => (
            <HeroAccessAvatar
              key={b.id}
              fallback={brokerInitials(b)}
              name={b.name}
              access={b.role}
              avatarUrl={brokerTeammate(b)?.avatarUrl}
              actionLabel="manage access"
              onOpenShare={open}
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
              aria-label="Manage access"
              onClick={open}
              className="hero-access__btn"
            >
              <FontAwesomeIcon icon={faUserGear} />
            </Button>
          }
        />
        <Tooltip.Content>Manage access</Tooltip.Content>
      </Tooltip>

      <ManageDealAccessModal
        listing={listing}
        open={manageOpen}
        onOpenChange={setManageOpen}
      />
    </div>
  );
}
