import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/pro-regular-svg-icons";
import type { PermissionScope, RoleId } from "#/data/permissions";
import { ROLE_BY_ID } from "#/data/permissions";
import type { UserStatus } from "#/data/roster";

/**
 * Every badge here is Blueprint's `Badge` on the `secondary` variant, with a
 * Buildout token pair layered on top for hue. The component only ships
 * primary/secondary/outline, which can't cover five roles plus the state and
 * origin chips — and Bootstrap's color utilities are `!important`, so they win
 * over `.badge-secondary` cleanly without any custom CSS.
 */
const ROLE_PILL: Record<RoleId, string> = {
  broker: "bg-buildout-blue-100 text-buildout-blue-700",
  "managing-director": "bg-solid-pink-100 text-solid-pink-700",
  "marketing-assistant": "bg-seagull-100 text-seagull-700",
  "transaction-coordinator": "bg-harvest-gold-100 text-harvest-gold-700",
  "assistant-to-broker": "bg-storm-grey-100 text-storm-grey-700",
};

/** The neutral pair, for badges that carry no state of their own. */
const NEUTRAL_PILL = "bg-storm-grey-100 text-storm-grey-600";

/**
 * "Customized" is noteworthy, not wrong — so it reads in purple rather than the
 * pink/red that made a page of overrides look like a page of validation errors.
 * `purple-heart` is the one family no role badge uses, so a Custom chip can't be
 * mistaken for a role.
 */
export const CUSTOM_PILL = "bg-purple-heart-100 text-purple-heart-700";
export const CUSTOM_TEXT = "text-purple-heart-700";
/**
 * Left rule on a customized row — the whole signal, with no fill behind it.
 * A generated border utility, so the hue stays in the token system.
 */
export const CUSTOM_BORDER_CLASS = "border-purple-heart-500";

export function RoleBadge({
  roleId,
  dimmed,
}: {
  roleId: RoleId;
  /** Deactivated rows mute their badges rather than dropping the color. */
  dimmed?: boolean;
}) {
  return (
    <Badge
      variant="secondary"
      className={`fw-semibold ${ROLE_PILL[roleId]}`}
      style={dimmed ? { opacity: 0.55 } : undefined}
    >
      {ROLE_BY_ID.get(roleId)?.name ?? roleId}
    </Badge>
  );
}

/**
 * Neutral badge for labels with no status meaning — YOU, role access kind,
 * "Can't be changed".
 *
 * Forwards its ref and spreads the rest of its props because it's used as a
 * `Tooltip.Trigger` render target: Base UI passes the trigger's ref and its
 * aria/event props through, and swallowing them leaves a badge that looks right
 * but has no tooltip.
 */
export const NeutralBadge = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof Badge>
>(function NeutralBadge({ className, children, ...props }, ref) {
  return (
    <Badge
      ref={ref}
      variant="secondary"
      className={`fw-semibold ${NEUTRAL_PILL} ${className ?? ""}`}
      {...props}
    >
      {children}
    </Badge>
  );
});

/** Status dot + label, matching the roster's Active / Deactivated column. */
export function StatusIndicator({ status }: { status: UserStatus }) {
  const active = status === "active";
  return (
    <span
      className={`d-inline-flex align-items-center gap-2 ${
        active ? "text-body" : "text-muted"
      }`}
    >
      <span
        className={`rounded-circle ${
          active ? "bg-mountain-meadow-500" : "bg-storm-grey-400"
        }`}
        style={{ width: 8, height: 8 }}
        aria-hidden
      />
      {active ? "Active" : "Deactivated"}
    </span>
  );
}

/**
 * The two permission groups. Blue means "needs a record to act on", orange
 * means "applies everywhere immediately" — the distinction the whole model
 * hangs on, so it gets a color and a subtitle, not just a heading.
 */
export const SCOPE_META: Record<
  PermissionScope,
  { heading: string; blurb: (name: string) => string; dotClass: string }
> = {
  record: {
    heading: "On specific listings & deals",
    blurb: (name) =>
      `${name} can use these only on records they own or have been shared into.`,
    dotClass: "bg-buildout-blue-500",
  },
  account: {
    heading: "Account-wide",
    blurb: () => "No record to share into — these apply everywhere, right away.",
    dotClass: "bg-harvest-gold-500",
  },
};

export function ScopeDot({ scope }: { scope: PermissionScope }) {
  return (
    <span
      className={`rounded-circle flex-shrink-0 ${SCOPE_META[scope].dotClass}`}
      style={{ width: 8, height: 8 }}
      aria-hidden
    />
  );
}

/** The On/Off state pill, shown when the row isn't editable. */
export function StatePill({ on }: { on: boolean }) {
  return on ? (
    <Badge
      variant="secondary"
      className="fw-semibold bg-mountain-meadow-100 text-mountain-meadow-700 d-inline-flex align-items-center gap-1"
    >
      <FontAwesomeIcon icon={faCheck} />
      On
    </Badge>
  ) : (
    <Badge
      variant="secondary"
      className={`fw-semibold ${NEUTRAL_PILL}`}
    >
      Off
    </Badge>
  );
}

/**
 * Marks a permission an admin has overridden. There's no counterpart badge for
 * the untouched ones: absence of this chip already means "whatever the roles
 * say", and a `Default` badge on seventeen of twenty rows was label noise on
 * the majority to flag the minority. The "· from Broker" attribution beside it
 * carries the same meaning with more information.
 */
export function CustomChip({ custom }: { custom: boolean }) {
  if (!custom) return null;
  return (
    <Badge variant="secondary" className={`fw-semibold ${CUSTOM_PILL}`}>
      Custom
    </Badge>
  );
}

/**
 * Attribution line: which assigned role granted this, or that none did.
 * Reads as "· from Broker" beside the label.
 */
export function Attribution({
  grantedBy,
  custom,
}: {
  grantedBy: RoleId[];
  custom: boolean;
}): ReactNode {
  if (custom) return null;
  if (grantedBy.length === 0) {
    return (
      <span className="text-muted small">· not part of any assigned role</span>
    );
  }
  const names = grantedBy.map((id) => ROLE_BY_ID.get(id)?.name ?? id);
  return <span className="text-muted small">· from {names.join(" + ")}</span>;
}
