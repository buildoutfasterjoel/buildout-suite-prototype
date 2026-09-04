import { useState } from "react";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserGear } from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { HeroAccessAvatar } from "#/components/common/HeroAccessAvatar";
import { ManageDealAccessModal } from "./ManageDealAccessModal";
import { useDealShares } from "./useDealAccess";
import { shareLevelLabel } from "#/data/dealShares";
import { viewerId } from "#/data/currentUser";
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
 * The group is the deal team — a deal's internal brokers — followed by anyone
 * shared into it. A shared teammate's tooltip says it is marketing and at what
 * level, so the cluster answers "who has this, and to what?" without opening
 * anything.
 */
export function DealHeroAccessAvatars({ listing }: { listing: Listing }) {
  const [manageOpen, setManageOpen] = useState(false);
  const creator = dealCreator(listing);
  const team = dealTeamBrokers(listing);
  const { shares } = useDealShares(listing.id);
  const open = () => setManageOpen(true);
  // A share row means the viewer is a guest on this deal, not on its team. Guests
  // read the access list; they don't hand it out.
  const readOnly = shares.some((s) => s.member.id === viewerId());
  const actionLabel = readOnly ? "see who has access" : "manage access";

  return (
    <div className="d-flex align-items-center" style={{ gap: 4 }}>
      <HeroAccessAvatar
        fallback={creator.initials}
        name={creator.name}
        access="Created this deal"
        avatarUrl={creator.avatarUrl}
        isOwner
        actionLabel={actionLabel}
        onOpenShare={open}
      />

      {(team.length > 0 || shares.length > 0) && (
        <Avatar.Group className="hero-access__group">
          {team.map((b) => (
            <HeroAccessAvatar
              key={b.id}
              fallback={brokerInitials(b)}
              name={b.name}
              access={b.role}
              avatarUrl={brokerTeammate(b)?.avatarUrl}
              actionLabel={actionLabel}
              onOpenShare={open}
            />
          ))}
          {shares.map((s) => (
            <HeroAccessAvatar
              key={s.member.id}
              fallback={s.member.initials}
              name={s.member.name}
              access={`Marketing · ${shareLevelLabel(s.level)}`}
              avatarUrl={s.member.avatarUrl}
              actionLabel={actionLabel}
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
              aria-label={readOnly ? "See who has access" : "Manage access"}
              onClick={open}
              className="hero-access__btn"
            >
              <FontAwesomeIcon icon={faUserGear} />
            </Button>
          }
        />
        <Tooltip.Content>{readOnly ? "Who has access" : "Manage access"}</Tooltip.Content>
      </Tooltip>

      <ManageDealAccessModal
        listing={listing}
        open={manageOpen}
        onOpenChange={setManageOpen}
        readOnly={readOnly}
      />
    </div>
  );
}
