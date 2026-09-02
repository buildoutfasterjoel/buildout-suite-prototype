import { useEffect, useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock, faPencil, faRotateLeft } from "@fortawesome/pro-regular-svg-icons";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import {
  resolvePermissions,
  roleName,
  summarize,
  type PermissionScope,
} from "#/data/permissions";
import type { RosterUser } from "#/data/roster";
import {
  applyCompanyCeilings,
  type EffectivePermission,
} from "#/data/contactAccess";
import { useRoster } from "./useRoster";
import { useContactAccessSettings } from "#/components/settings/useContactAccessSettings";
import { notify } from "#/lib/notify";
import { AssignRolesPanel } from "./AssignRolesPanel";
import { ManageCompanyNotice } from "./ManageCompanyNotice";
import { useCan } from "./useViewer";
import {
  CUSTOM_TEXT,
  CustomChip,
  NeutralBadge,
  SCOPE_META,
  StatePill,
} from "./roleDisplay";

const SCOPE_ORDER: PermissionScope[] = ["record", "account"];

/** "an Office Admin" but "a Broker" — every role name is spoken in a toast. */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** First name — every explainer in the mocks addresses the person directly. */
function firstNameOf(user: RosterUser): string {
  return user.name.split(" ")[0];
}

/**
 * Per-user permissions page.
 *
 * Read-only by default: an admin usually arrives to answer "what can this
 * person do, and why is that thing off?" — not to change anything. Editing is
 * behind an explicit mode, which swaps each row's state pill for a switch and
 * reveals a reset on rows that diverge from their role.
 */
export function UserPermissions({ user }: { user: RosterUser }) {
  const setRoles = useRoster((s) => s.setRoles);
  const setOverride = useRoster((s) => s.setOverride);
  const clearOverrides = useRoster((s) => s.clearOverrides);

  // This page is gated by Manage Company — the same permission it can grant.
  // Without it, the notice replaces the whole page (see the early return below).
  const canManage = useCan("manage-company");
  const [editing, setEditing] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);

  // Losing the permission mid-session (by switching seats) must not leave the
  // page in edit mode with live switches.
  useEffect(() => {
    if (!canManage) {
      setEditing(false);
      setRolesOpen(false);
    }
  }, [canManage]);

  const firstName = firstNameOf(user);
  // Roles and overrides first, then the company's contact-ownership ceilings on
  // top: a row under a closed ceiling reads Off and locks, and a grant the
  // company hands out per person reads Off until someone grants it. Both leave
  // the role default and override untouched underneath, so the count reflects
  // what the person can actually do today.
  const accessSettings = useContactAccessSettings((s) => s.settings);
  const resolved = useMemo(
    () =>
      applyCompanyCeilings(
        resolvePermissions(user.roleIds, user.overrides),
        user.overrides,
        accessSettings,
      ),
    [user.roleIds, user.overrides, accessSettings],
  );
  const summary = summarize(resolved);
  const byScope = useMemo(
    () =>
      Object.fromEntries(
        SCOPE_ORDER.map((scope) => [
          scope,
          resolved.filter((r) => r.permission.scope === scope),
        ]),
      ) as Record<PermissionScope, EffectivePermission[]>,
    [resolved],
  );

  /**
   * Flipping a switch back to what the roles already say clears the override
   * rather than storing a redundant one, so the row resumes tracking the role
   * and stops counting as a customization.
   */
  function toggle(row: EffectivePermission, next: boolean) {
    setOverride(
      user.id,
      row.permission.id,
      next === row.roleDefault ? undefined : next,
    );
  }

  // Without Manage Company there's nothing here to read or act on, so the notice
  // stands alone rather than heading a list the viewer can't touch.
  if (!canManage) {
    return (
      <ManageCompanyNotice
        what={`change ${user.isYou ? "your own" : `${firstName}'s`} permissions`}
      />
    );
  }

  return (
    // No breadcrumb or identity block here — those live in the tab layout, so
    // they stay put as you move between a user's tabs. This tab owns only its
    // own actions.
    <div className="d-flex flex-column gap-4">
      {/* Summary line, with the mode controls riding on its right. The count is
          what an admin reads first and the button is what they reach for next,
          so pairing them saves a line and keeps the action next to its subject. */}
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <span>
          <span className="fw-bold">{summary.onCount}</span> of {summary.total}{" "}
          permissions turned on
        </span>
        <span className="text-muted" aria-hidden>
          ·
        </span>
        {summary.customCount === 0 ? (
          <span className="text-mountain-meadow-700 fw-semibold">
            No custom changes
          </span>
        ) : (
          <span className={`${CUSTOM_TEXT} fw-semibold`}>
            {summary.customCount} changed from the role default
          </span>
        )}
        {summary.customCount > 0 && editing && (
          <>
            <span className="text-muted" aria-hidden>
              ·
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearOverrides(user.id);
                notify({
                  title: "Customizations cleared",
                  description: `${firstName} is back to pure role defaults.`,
                });
              }}
            >
              <FontAwesomeIcon icon={faRotateLeft} />
              Reset all to role defaults
            </Button>
          </>
        )}

        <div className="ms-auto d-flex align-items-center gap-2">
          {/* The model explained on demand rather than in a standing banner:
              it's the same two sentences every visit, and an admin who already
              knows how roles and sharing relate doesn't need re-telling. */}
          <Tooltip>
            <Tooltip.Trigger
              render={
                <span
                  tabIndex={0}
                  className="text-muted d-inline-flex align-items-center me-1"
                  style={{ cursor: "help" }}
                  aria-label="How roles and sharing decide access"
                />
              }
            >
              <FontAwesomeIcon icon={faCircleInfo} />
            </Tooltip.Trigger>
            <Tooltip.Content side="bottom" align="end" style={{ maxWidth: 320 }}>
              <div className="fw-semibold mb-1">
                Roles decide what {firstName} can do — sharing decides which
                records
              </div>
              {user.roleIds.length === 0 ? (
                <>
                  {firstName} has no role assigned, so nothing is on yet. Assign
                  one to give them a starting set.
                </>
              ) : (
                <>
                  Everything here comes from the{" "}
                  {user.roleIds.map(roleName).join(" + ")}{" "}
                  {user.roleIds.length === 1 ? "role" : "roles"} unless it&apos;s
                  marked Custom.
                </>
              )}{" "}
              Being allowed to edit a listing doesn&apos;t open any listing —
              the record still has to be shared with {firstName}.
            </Tooltip.Content>
          </Tooltip>

          {/* Assigning a role and hand-tuning permissions are alternative
              answers to the same question, so only one is offered at a time. */}
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRolesOpen(true)}
            >
              Assign role
            </Button>
          )}
          <Button
            variant={editing ? "primary" : "outline"}
            size="sm"
            onClick={() => setEditing((v) => !v)}
          >
            <FontAwesomeIcon icon={faPencil} />
            {editing ? "Done editing" : "Edit permissions"}
          </Button>
        </div>
      </div>

      {/* The Managing Director "private records stay name-only" rule used to sit
          here as an immutable-constraint row. Hidden for now — it's a rule about
          record visibility rather than a permission, so it wants its own home
          once record-level sharing exists. */}

      {/* Permission groups, side by side from lg up. Two narrower columns keep
          each label within a short glance of its own switch — one full-width
          column made the eye travel the page's whole width per row. The groups
          are uneven (15 vs 5), which is fine: they're independent lists, and
          pairing them halves the scroll. */}
      <div className="row g-4">
        {SCOPE_ORDER.map((scope) => (
          <div key={scope} className="col-lg-6">
            {/* The icon leads the heading: at this size it reads as the group's
                marker — the job the coloured dot used to do — and carries the
                scope explanation on hover rather than in a standing subtitle. */}
            <div className="d-flex align-items-center gap-2 mb-2">
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <span
                      tabIndex={0}
                      className="text-muted d-inline-flex align-items-center"
                      style={{ cursor: "help", fontSize: "1.25rem" }}
                      aria-label={`What "${SCOPE_META[scope].heading}" means`}
                    />
                  }
                >
                  <FontAwesomeIcon icon={faCircleInfo} />
                </Tooltip.Trigger>
                <Tooltip.Content side="top" style={{ maxWidth: 300 }}>
                  {SCOPE_META[scope].tooltip}
                </Tooltip.Content>
              </Tooltip>
              <span className="fs-6 fw-semibold">
                {SCOPE_META[scope].heading}
              </span>
            </div>

            <div className="border rounded overflow-hidden">
              {byScope[scope].map((row) => (
                <PermissionRow
                  key={row.permission.id}
                  row={row}
                  firstName={firstName}
                  editing={editing}
                  onToggle={(next) => toggle(row, next)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <AssignRolesPanel
        open={rolesOpen}
        onOpenChange={setRolesOpen}
        firstName={firstName}
        roleIds={user.roleIds}
        onSave={(next) => {
          setRoles(user.id, next);
          setRolesOpen(false);
          notify({
            title: "Role saved",
            description: next[0]
              ? `${firstName} is now ${article(roleName(next[0]))} ${roleName(
                  next[0],
                )}.`
              : `${firstName} has no role assigned.`,
          });
        }}
      />
    </div>
  );
}

/**
 * One permission. The label, its origin, and its effective state are always
 * visible. In edit mode the state pill becomes a switch.
 */
function PermissionRow({
  row,
  firstName,
  editing,
  onToggle,
}: {
  row: EffectivePermission;
  firstName: string;
  editing: boolean;
  onToggle: (next: boolean) => void;
}) {
  const { permission, custom, on, locked, perPerson, gate } = row;

  return (
    // A left rule plus the Custom chip carry the whole signal — no fill behind
    // the row. Borders live in `.permission-row` because they differ per side,
    // which Bootstrap's all-sides border utilities can't express.
    <div
      className={`permission-row d-flex align-items-center gap-3 px-3 py-2 ${
        custom ? "permission-row--custom" : ""
      }`}
    >
      {/* One line. The label carries the meaning, the chips carry where the
          value came from, and anything left over hides behind the info icon —
          a second line of prose per row was most of this page's bulk. */}
      <div
        className="flex-grow-1 d-flex align-items-center gap-2 flex-wrap"
        style={{ minWidth: 0 }}
      >
        <span className="fw-semibold">{permission.label}</span>
        {permission.detail && (
          <Tooltip>
            {/* A bare icon, not a ghost button: the button's padding and hit
                area made every row with detail sit wider than its neighbours.
                `tabIndex` keeps it reachable without the chrome. */}
            <Tooltip.Trigger
              render={
                <span
                  tabIndex={0}
                  className="text-muted d-inline-flex align-items-center"
                  style={{ cursor: "help" }}
                  aria-label={`About ${permission.label}`}
                />
              }
            >
              <FontAwesomeIcon icon={faCircleInfo} />
            </Tooltip.Trigger>
            <Tooltip.Content side="top" style={{ maxWidth: 280 }}>
              {permission.detail}
            </Tooltip.Content>
          </Tooltip>
        )}
        <CustomChip custom={custom} />
        {/* Under a closed ceiling the row is Off no matter what the roles say,
            and the Custom chip goes quiet: the override is preserved but isn't
            deciding anything. */}
        {locked && gate && (
          <Tooltip>
            <Tooltip.Trigger
              render={<NeutralBadge tabIndex={0} style={{ cursor: "help" }} />}
            >
              <FontAwesomeIcon icon={faLock} className="me-1" />
              Off for the company
            </Tooltip.Trigger>
            <Tooltip.Content side="top" style={{ maxWidth: 300 }}>
              Turned off by &ldquo;{gate.settingLabel}&rdquo; in Company
              settings. {firstName}&apos;s own setting is kept and comes back
              when the company turns it on.
            </Tooltip.Content>
          </Tooltip>
        )}
        {/* The company hands this one out one person at a time, so a Broker
            reads Off here without anything being wrong — this says why. */}
        {perPerson && !on && (
          <Tooltip>
            <Tooltip.Trigger
              render={<NeutralBadge tabIndex={0} style={{ cursor: "help" }} />}
            >
              Granted per person
            </Tooltip.Trigger>
            <Tooltip.Content side="top" style={{ maxWidth: 300 }}>
              The company hands this out to specific people rather than every
              Broker — see Contact Ownership in Company settings. Turn it on
              here to grant it to {firstName}.
            </Tooltip.Content>
          </Tooltip>
        )}
      </div>

      {/* Controls. A muted status badge while reading, a live switch while
          editing — this app's own convention (see the syndication channel
          cards), and the reason neither a disabled nor a read-only switch works
          here: Blueprint's disabled switch drops the checked fill, so twenty
          rows would render identically, and a read-only switch invites a click
          that does nothing. No per-row reset: flipping the switch back already
          clears the override, so a second control for the same move was noise.
          "Reset all to role defaults" above still clears the page at once. */}
      <div className="flex-shrink-0 d-flex align-items-center gap-2">
        {editing && !locked ? (
          <Switch
            checked={on}
            onCheckedChange={onToggle}
            aria-label={`${permission.label} for ${firstName}`}
          />
        ) : (
          <StatePill on={on} />
        )}
      </div>
    </div>
  );
}
