import { forwardRef, type ComponentProps } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleMinus,
} from "@fortawesome/pro-regular-svg-icons";
import type { PermissionScope, RoleId } from "#/data/permissions";
import { ROLE_BY_ID } from "#/data/permissions";
import type { UserStatus } from "#/data/roster";

/**
 * Role badge colors, from the Figma spec (My Sandbox → 1310-80954).
 *
 * All five are tints on Blueprint's `secondary` badge — no solid fill, so no one
 * role shouts over the others. Each pairs a Buildout token with its own family's
 * 950 for text, resolving to the spec's hex within rounding:
 *
 *   Broker                  #dcebfd / #182753  (badge/accent/secondary)
 *   Managing Director       #f2e8ff / #360764  (badge/default/secondary)
 *   Marketing Assistant     #ffe785 / #481800
 *   Transaction Coordinator #a0fad1 / #003024
 *   Office Admin            #eceef2 / #22262f  (badge/muted/secondary)
 *
 * Palette tokens rather than the matching `appearance` props because the
 * installed blueprint-theme resolves those semantic backgrounds differently from
 * this Figma file — the text colors agree, the tints don't. Worth reconciling
 * upstream; until then these hit the spec.
 */
const ROLE_PILL: Record<RoleId, string> = {
  broker: "bg-buildout-blue-100 text-buildout-blue-950",
  "managing-director": "bg-purple-heart-100 text-purple-heart-950",
  "marketing-assistant": "bg-harvest-gold-200 text-harvest-gold-950",
  "transaction-coordinator": "bg-mountain-meadow-200 text-mountain-meadow-950",
  "office-admin": "bg-storm-grey-100 text-storm-grey-950",
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
 * The two permission groups.
 *
 * The scope distinction is what the whole model hangs on, but it only needs
 * explaining once per visit — so the heading carries the name and an info icon
 * carries the rest, rather than a standing subtitle under each group.
 */
export const SCOPE_META: Record<
  PermissionScope,
  { heading: string; tooltip: string }
> = {
  record: {
    heading: "On specific listings, deals & contacts",
    tooltip:
      "Applies to records they own or that have been shared with them",
  },
  account: {
    heading: "Account-wide",
    tooltip: "Applies everywhere — no record sharing required",
  },
};

/**
 * Read-only state for one permission.
 *
 * Follows the syndication channel cards: a muted badge carrying a small colored
 * icon, never a colored fill. That's this app's status vocabulary — a filled
 * green pill on twenty rows reads as twenty things demanding attention, and
 * `syndicationDisplay` makes the same argument for its own states ("Grey, not
 * green"). The switch appears in its place once editing starts.
 */
export function StatePill({ on }: { on: boolean }) {
  return (
    <Badge
      variant="secondary"
      appearance="muted"
      className="user-select-none d-inline-flex align-items-center gap-1"
    >
      <FontAwesomeIcon
        icon={on ? faCircleCheck : faCircleMinus}
        style={{ color: on ? "var(--bp-success)" : "var(--stage-inactive)" }}
      />
      {on ? "On" : "Off"}
    </Badge>
  );
}

/**
 * Marks a permission an admin has overridden. There's no counterpart badge for
 * the untouched ones: absence of this chip already means "whatever the roles
 * say", and a `Default` badge on seventeen of twenty rows was label noise on
 * the majority to flag the minority.
 */
export function CustomChip({ custom }: { custom: boolean }) {
  if (!custom) return null;
  return (
    <Badge variant="secondary" className={`fw-semibold ${CUSTOM_PILL}`}>
      Custom
    </Badge>
  );
}
