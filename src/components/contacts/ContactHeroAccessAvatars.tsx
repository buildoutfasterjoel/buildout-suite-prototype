import type { KeyboardEvent } from "react";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { HeroAccessAvatar } from "#/components/common/HeroAccessAvatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightArrowLeft,
  faBuilding,
  faLock,
  faLockOpen,
  faUserGear,
  faUserPlus,
} from "@fortawesome/pro-regular-svg-icons";
import { accessTierLabel, type ContactShare } from "#/data/teammates";
import type { ContactOwnership } from "#/data/contactOwnership";

/**
 * Visible / Private, beside the stage badge (Figma 3262:116003 / 3262:116012).
 *
 * Shown only when this record *could* be private — its owner holds the grant
 * under an open ceiling — so "Visible" is a real state and not a default label:
 * it says the owner could hide this and hasn't. Company-owned records, which
 * can never be hidden, carry no badge. "Visible" rather than the Figma's
 * "Public": in this product "public" means published outward (public listings,
 * public documents), and a contact badge shouldn't read as "on the website".
 * Visible takes the default secondary tint (the same purple the Managing
 * Director pill uses), Private the muted one — the visible state is the one
 * that reads, the hidden one recedes.
 */
export function ContactPrivacyBadge({ isPrivate }: { isPrivate: boolean }) {
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <Badge
            variant="secondary"
            appearance={isPrivate ? "muted" : undefined}
            tabIndex={0}
            className={`d-inline-flex align-items-center gap-1 fw-semibold text-nowrap${
              isPrivate ? "" : " bg-purple-heart-100 text-purple-heart-950"
            }`}
            style={{ cursor: "help" }}
          />
        }
      >
        <FontAwesomeIcon icon={isPrivate ? faLock : faLockOpen} />
        {isPrivate ? "Private" : "Visible"}
      </Tooltip.Trigger>
      <Tooltip.Content style={{ maxWidth: 260 }}>
        {isPrivate
          ? "Hidden from the firm, search included. Only the owner and the people it's shared with can see it."
          : "Everyone at the firm can find and open this contact."}
      </Tooltip.Content>
    </Tooltip>
  );
}

/**
 * The contact hero's access cluster, sitting next to the stage badge.
 *
 * The owner stands alone with an offset ring — they're the one accountable for
 * the record, not one of a crowd. When the company owns the record (Model A, or
 * a person without the Own Contacts grant) the ring goes on a building, and the
 * assignee follows it as the person working the record on the company's behalf.
 * Everyone shared in stacks into an overlapping group beside them.
 *
 * Privacy itself lives elsewhere: the state is the `ContactPrivacyBadge` beside
 * the stage, and the owner's control is the Make Private switch in the details
 * panel — not a lock in this cluster, which is about who, not whether.
 */
export function ContactHeroAccessAvatars({
  ownership,
  shares,
  canShare,
  canAssign = false,
  canTransfer = false,
  onOpenShare,
  onAssign,
  onTransfer,
}: {
  ownership: ContactOwnership;
  shares: ContactShare[];
  /**
   * Whether the viewer may manage sharing. Without it the avatars still say who
   * has access on hover, but nothing opens the share modal — not the avatars,
   * not a Manage sharing button.
   */
  canShare: boolean;
  /** Company-owned only: the viewer may route this record to someone. */
  canAssign?: boolean;
  /** Broker-owned only: the viewer owns it and may move it to another book. */
  canTransfer?: boolean;
  onOpenShare: () => void;
  onAssign?: () => void;
  onTransfer?: () => void;
}) {
  const { owner, assignee } = ownership;
  const companyOwned = owner.kind === "company";
  const open = canShare ? onOpenShare : undefined;

  return (
    <div className="d-flex align-items-center" style={{ gap: 4 }}>
      {companyOwned ? (
        <HeroAccessAvatar
          fallback={<FontAwesomeIcon icon={faBuilding} />}
          fallbackClassName="bg-storm-grey-100 text-storm-grey-700"
          name={owner.name}
          access="Owner"
          isOwner
          onOpenShare={open}
        />
      ) : (
        <HeroAccessAvatar
          fallback={owner.user.initials}
          name={owner.user.name}
          access="Owner"
          avatarUrl={owner.user.avatarUrl}
          isOwner
          onOpenShare={open}
        />
      )}

      {/* Company-owned: the assignee is the accountable person, working it on
          the company's behalf. Shown apart from the shared-in group because
          assignment isn't a share — it carries no tier. Where the viewer may
          assign, the avatar is the way to reassign; otherwise it just says who. */}
      {companyOwned && assignee && (
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Avatar
                role={canAssign ? "button" : undefined}
                tabIndex={0}
                aria-label={`${assignee.name} · Assigned${canAssign ? " — reassign" : ""}`}
                className={canAssign ? "hero-access__avatar" : ""}
                onClick={canAssign ? onAssign : undefined}
                onKeyDown={(e: KeyboardEvent) => {
                  if (canAssign && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onAssign?.();
                  }
                }}
              >
                {assignee.avatarUrl && <Avatar.Image src={assignee.avatarUrl} alt={assignee.name} />}
                <Avatar.Fallback className="fw-semibold">{assignee.initials}</Avatar.Fallback>
              </Avatar>
            }
          />
          <Tooltip.Content>
            {assignee.name} · Assigned{canAssign ? " — click to reassign" : ""}
          </Tooltip.Content>
        </Tooltip>
      )}

      {/* Company-owned and nobody works it yet: say so, and offer the verb to
          anyone who holds it. An unassigned record is visible to the firm under
          the open-book reading — it just has no accountable person. */}
      {companyOwned && !assignee && (
        canAssign ? (
          <Button variant="outline" size="sm" onClick={onAssign} className="text-nowrap">
            <FontAwesomeIcon icon={faUserPlus} />
            Assign
          </Button>
        ) : (
          <Badge variant="secondary" appearance="muted" className="fw-semibold text-nowrap">
            Unassigned
          </Badge>
        )
      )}

      {shares.length > 0 && (
        <Avatar.Group className="hero-access__group">
          {shares.map((s) => (
            <HeroAccessAvatar
              key={s.member.id}
              fallback={s.member.initials}
              name={s.member.name}
              access={accessTierLabel(s.tier)}
              avatarUrl={s.member.avatarUrl}
              onOpenShare={open}
            />
          ))}
        </Avatar.Group>
      )}

      {canShare && (
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                appearance="muted"
                size="icon-sm"
                aria-label="Manage sharing"
                onClick={onOpenShare}
                className="hero-access__btn"
              >
                <FontAwesomeIcon icon={faUserGear} />
              </Button>
            }
          />
          <Tooltip.Content>Manage sharing</Tooltip.Content>
        </Tooltip>
      )}

      {/* Broker-owned and the viewer owns it: the record can change books.
          Assign has no meaning here — ownership already did the routing. */}
      {canTransfer && (
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                appearance="muted"
                size="icon-sm"
                aria-label="Transfer ownership"
                onClick={onTransfer}
                className="hero-access__btn"
              >
                <FontAwesomeIcon icon={faArrowRightArrowLeft} />
              </Button>
            }
          />
          <Tooltip.Content>Transfer ownership to another broker</Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
}
