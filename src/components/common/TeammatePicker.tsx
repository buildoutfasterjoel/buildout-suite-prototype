import { useMemo } from "react";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { TEAMMATES, type Teammate } from "#/data/teammates";

/** A circular avatar: photo (when available) falling back to initials. */
export function MemberAvatar({
  member,
  size,
}: {
  member: Pick<Teammate, "name" | "initials" | "avatarUrl">;
  size?: "sm" | "lg";
}) {
  return (
    <Avatar size={size} className="flex-shrink-0">
      {member.avatarUrl && <Avatar.Image src={member.avatarUrl} alt={member.name} />}
      <Avatar.Fallback className="fw-semibold">{member.initials}</Avatar.Fallback>
    </Avatar>
  );
}

/**
 * Dropdown list of teammates that can be added, shown below an add-people
 * input. Excludes anyone already on the record (and, while a contact share is
 * being staged, anyone already picked).
 *
 * Shared by the contact sharing modal and the deal's Manage Access modal, so
 * one roster search behaves the same in both.
 */
export function TeammatePicker({
  query,
  excludeIds,
  onPick,
}: {
  query: string;
  excludeIds: Set<string>;
  onPick: (member: Teammate) => void;
}) {
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEAMMATES.filter((m) => !excludeIds.has(m.id)).filter((m) =>
      q ? `${m.name} ${m.email} ${m.role}`.toLowerCase().includes(q) : true,
    );
  }, [query, excludeIds]);

  return (
    <div className="share-modal__picker shadow-sm">
      {matches.length === 0 ? (
        <div className="px-3 py-3 text-muted fs-small">No people match.</div>
      ) : (
        matches.map((m) => (
          <button
            key={m.id}
            type="button"
            className="share-modal__picker-row d-flex align-items-center gap-2 w-100 text-start border-0 bg-transparent px-3 py-2"
            // onMouseDown fires before the input's blur, so the click lands.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(m);
            }}
          >
            <MemberAvatar member={m} size="lg" />
            <span className="fw-semibold flex-grow-1 text-truncate">{m.name}</span>
            <span className="text-muted fs-small flex-shrink-0">{m.role}</span>
          </button>
        ))
      )}
    </div>
  );
}
