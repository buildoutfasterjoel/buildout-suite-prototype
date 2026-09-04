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
 * overlapping group beside them.
 *
 * `manage` is false on a space. Access to a suite is its broker team plus
 * whoever holds the building — neither is granted here, so a gear button would
 * open a modal with nothing to change. The cluster still identifies the people;
 * the avatars simply stop being buttons.
 */
export function DealHeroAccessAvatars({
  listing,
  manage = true,
}: {
  listing: Listing;
  /** False on a space: sharing lives on the building, so there is nothing to manage. */
  manage?: boolean;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const creator = dealCreator(listing);
  const team = dealTeamBrokers(listing);
  const { shares } = useDealShares(listing.id);
  // Undefined rather than a no-op: `HeroAccessAvatar` reads it to decide whether
  // the avatar is a button at all, and an avatar that looks clickable and does
  // nothing is worse than one that doesn't.
  const open = manage ? () => setManageOpen(true) : undefined;
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

      {manage && (
        <>
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
            <Tooltip.Content>
              {readOnly ? "Who has access" : "Manage access"}
            </Tooltip.Content>
          </Tooltip>

          <ManageDealAccessModal
            listing={listing}
            open={manageOpen}
            onOpenChange={setManageOpen}
            readOnly={readOnly}
          />
        </>
      )}
    </div>
  );
}
