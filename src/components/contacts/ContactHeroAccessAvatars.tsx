import type { KeyboardEvent, ReactNode } from "react";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faLock,
  faLockOpen,
  faUserGear,
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
 * A single hover-tooltip avatar: photo (or a fallback) + "Name · Access"
 * tooltip. Clicking opens the sharing modal.
 */
function AccessAvatar({
  fallback,
  name,
  access,
  avatarUrl,
  isOwner,
  fallbackClassName,
  onOpenShare,
}: {
  /** Undefined when the viewer can't manage sharing — the avatar just identifies. */
  onOpenShare?: () => void;
  /** Initials, or an icon for the company. */
  fallback: ReactNode;
  name: string;
  access: string;
  avatarUrl?: string;
  /** The owner leads the cluster with an offset ring, outside the group. */
  isOwner?: boolean;
  fallbackClassName?: string;
}) {
  const interactive = !!onOpenShare;
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <Avatar
            role={interactive ? "button" : undefined}
            tabIndex={0}
            aria-label={`${name} · ${access}${interactive ? " — manage sharing" : ""}`}
            className={`${interactive ? "contact-hero__access" : ""}${
              isOwner ? " contact-hero__owner-avatar" : ""
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
  onOpenShare,
}: {
  ownership: ContactOwnership;
  shares: ContactShare[];
  /**
   * Whether the viewer may manage sharing. Without it the avatars still say who
   * has access on hover, but nothing opens the share modal — not the avatars,
   * not a Manage sharing button.
   */
  canShare: boolean;
  onOpenShare: () => void;
}) {
  const { owner, assignee } = ownership;
  const companyOwned = owner.kind === "company";
  const open = canShare ? onOpenShare : undefined;

  return (
    <div className="d-flex align-items-center" style={{ gap: 4 }}>
      {companyOwned ? (
        <AccessAvatar
          fallback={<FontAwesomeIcon icon={faBuilding} />}
          fallbackClassName="bg-storm-grey-100 text-storm-grey-700"
          name={owner.name}
          access="Owner"
          isOwner
          onOpenShare={open}
        />
      ) : (
        <AccessAvatar
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
          assignment isn't a share — it carries no tier. */}
      {companyOwned && assignee && (
        <AccessAvatar
          fallback={assignee.initials}
          name={assignee.name}
          access="Assigned"
          avatarUrl={assignee.avatarUrl}
          onOpenShare={open}
        />
      )}

      {shares.length > 0 && (
        <Avatar.Group className="contact-hero__access-group">
          {shares.map((s) => (
            <AccessAvatar
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
                className="contact-hero__share-btn"
              >
                <FontAwesomeIcon icon={faUserGear} />
              </Button>
            }
          />
          <Tooltip.Content>Manage sharing</Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
}
