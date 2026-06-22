import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";

const AVATAR_INITIALS = ["AE", "MK", "JL", "RS", "TC", "DP"];

/**
 * Stacked team avatars with a trailing "+N" count, rendered inside a white pill.
 * Counts are derived from `seed` so they stay stable across renders. Used on the
 * property card (sm) and the property detail header (default size).
 */
export function AvatarGroup({
  seed,
  size = "sm",
}: {
  seed: number;
  size?: "sm" | "default";
}) {
  const shown = 2 + (seed % 2); // 2–3 avatars
  const more = 2 + (seed % 7);

  return (
    <div
      className="d-inline-flex align-items-center bg-white rounded-pill shadow-sm"
      style={{ padding: "2px 8px 2px 2px", gap: 4 }}
    >
      <Avatar.Group size={size === "sm" ? "sm" : undefined}>
        {Array.from({ length: shown }, (_, i) => (
          <Avatar key={i}>
            <Avatar.Fallback>
              {AVATAR_INITIALS[(seed + i) % AVATAR_INITIALS.length]}
            </Avatar.Fallback>
          </Avatar>
        ))}
        <Avatar.More count={more - shown} />
      </Avatar.Group>
    </div>
  );
}
