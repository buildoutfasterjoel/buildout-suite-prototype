import { useEffect, useState } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Offcanvas } from "@buildoutinc/blueprint-react/ui/Offcanvas";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation, faXmark } from "@fortawesome/pro-regular-svg-icons";
import {
  ROLES,
  ROLE_ACCESS_LABELS,
  roleUnionCount,
  type RoleId,
} from "#/data/permissions";
import { NeutralBadge, RoleBadge } from "./roleDisplay";

/**
 * Assign roles for one user.
 *
 * Roles are additive and non-exclusive: two roles give the union of what either
 * allows, never less. The running count makes that concrete before saving,
 * since "what did adding this role actually change?" is the question an admin
 * is really asking.
 */
export function AssignRolesPanel({
  open,
  onOpenChange,
  firstName,
  roleIds,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firstName: string;
  roleIds: RoleId[];
  onSave: (next: RoleId[]) => void;
}) {
  const [selected, setSelected] = useState<RoleId[]>(roleIds);

  // Re-seed each time the panel opens so a cancelled edit leaves nothing behind.
  useEffect(() => {
    if (open) setSelected(roleIds);
  }, [open, roleIds]);

  function toggle(roleId: RoleId, checked: boolean) {
    setSelected((prev) =>
      checked ? [...prev, roleId] : prev.filter((id) => id !== roleId),
    );
  }

  // Keep chips and the summary in ROLES order rather than click order, so the
  // same pair of roles always reads the same way.
  const ordered = ROLES.filter((role) => selected.includes(role.id)).map(
    (role) => role.id,
  );
  const unionCount = roleUnionCount(ordered);

  return (
    <Offcanvas open={open} onOpenChange={onOpenChange}>
      <Offcanvas.Content side="right" style={{ maxWidth: 560 }}>
        <Offcanvas.Header>
          <Offcanvas.Title className="fs-5 fw-semibold mb-0">
            Assign roles
          </Offcanvas.Title>
          <Offcanvas.Description className="text-muted mb-0">
            A role decides what {firstName}&apos;s allowed to do. You can give
            them more than one — they just add together.
          </Offcanvas.Description>
        </Offcanvas.Header>

        <Offcanvas.Body className="d-flex flex-column gap-3">
          <div>
            <div className="text-muted small fw-semibold text-uppercase mb-2">
              Roles
            </div>
            <div className="border rounded p-2 d-flex align-items-center gap-1 flex-wrap">
              {ordered.length === 0 ? (
                <span className="text-muted px-1">No roles assigned</span>
              ) : (
                ordered.map((roleId) => (
                  <span
                    key={roleId}
                    className="d-inline-flex align-items-center gap-1"
                  >
                    <RoleBadge roleId={roleId} />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${roleId}`}
                      onClick={() => toggle(roleId, false)}
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </Button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="d-flex flex-column gap-2">
            {ROLES.map((role) => {
              const checked = selected.includes(role.id);
              return (
                // eslint-disable-next-line jsx-a11y/label-has-associated-control
                <label
                  key={role.id}
                  className={`d-flex align-items-start gap-3 border rounded p-3 ${
                    checked ? "border-primary bg-buildout-blue-50" : ""
                  }`}
                  style={{ cursor: "pointer" }}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => toggle(role.id, c)}
                    className="mt-1"
                  />
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="fw-semibold">{role.name}</div>
                    <div className="text-muted small">{role.description}</div>
                    {role.provisional && (
                      <div className="text-muted small mt-1 d-flex align-items-center gap-1">
                        <FontAwesomeIcon icon={faTriangleExclamation} />
                        Preset defaults still provisional
                      </div>
                    )}
                  </div>
                  <NeutralBadge className="flex-shrink-0">
                    {ROLE_ACCESS_LABELS[role.accessKind]}
                  </NeutralBadge>
                </label>
              );
            })}
          </div>

          <div className="border rounded p-3 d-flex flex-column gap-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {ordered.length === 0 ? (
                <span className="text-muted">No roles selected</span>
              ) : (
                ordered.map((roleId, i) => (
                  <span
                    key={roleId}
                    className="d-inline-flex align-items-center gap-2"
                  >
                    {i > 0 && <span className="text-muted">+</span>}
                    <RoleBadge roleId={roleId} />
                  </span>
                ))
              )}
              <span className="text-muted">=</span>
              <Badge
                variant="secondary"
                className="fw-semibold bg-buildout-blue-700 text-white"
              >
                {unionCount} things {firstName} can do
              </Badge>
            </div>
            <p className="text-muted small mb-0">
              {ordered.length > 1 ? (
                <>
                  With more than one role, {firstName} simply gets{" "}
                  <span className="fw-semibold">
                    everything either role allows
                  </span>{" "}
                  — never less than either one on its own. You can then turn
                  individual items on or off below.
                </>
              ) : (
                <>
                  Roles add together. Assign a second one and {firstName} gets
                  everything either role allows — never less.
                </>
              )}
            </p>
          </div>
        </Offcanvas.Body>

        <Offcanvas.Footer className="settings-panel__footer d-flex justify-content-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(ordered)}>
            Save roles
          </Button>
        </Offcanvas.Footer>
      </Offcanvas.Content>
    </Offcanvas>
  );
}
