import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { CURRENT_USER, type ContactShare, type Teammate } from "#/data/teammates";

/** One avatar with a photo (when available) falling back to initials. */
function MemberAvatar({ member, className }: { member: Teammate; className?: string }) {
  return (
    <Avatar className={className}>
      {member.avatarUrl && <Avatar.Image src={member.avatarUrl} alt={member.name} />}
      <Avatar.Fallback className="fw-semibold">{member.initials}</Avatar.Fallback>
    </Avatar>
  );
}

/**
 * Stacked avatars of everyone with access to a contact: the owner first, then
 * shared collaborators, capped with a "+N" overflow. Used inside the Share
 * button in the detail top bar.
 */
export function ContactAccessAvatars({
  shares,
  className,
  max = 3,
}: {
  shares: ContactShare[];
  className?: string;
  max?: number;
}) {
  const shown = shares.slice(0, max);
  const overflow = shares.length - shown.length;

  return (
    <Avatar.Group size="sm" className={className}>
      <MemberAvatar member={CURRENT_USER} />
      {shown.map((s) => (
        <MemberAvatar key={s.member.id} member={s.member} />
      ))}
      {overflow > 0 && <Avatar.More count={overflow} />}
    </Avatar.Group>
  );
}
