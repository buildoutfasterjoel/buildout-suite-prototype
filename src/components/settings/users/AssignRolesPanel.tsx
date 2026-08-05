import { useEffect, useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Offcanvas } from "@buildoutinc/blueprint-react/ui/Offcanvas";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/pro-regular-svg-icons";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import {
  PERMISSIONS,
  ROLES,
  ROLE_ACCESS_DETAIL,
  ROLE_ACCESS_LABELS,
  ROLE_BY_ID,
  type RoleId,
} from "#/data/permissions";
import { NeutralBadge, SCOPE_META } from "./roleDisplay";

/**
 * Assign a role to one user.
 *
 * One role per person: the engineering plan models assignments as a
 * non-exclusive set and the resolver still unions a list, but the product rule
 * is a single role, so this is a radio group rather than checkboxes. If that
 * relaxes, the resolver needs no change — only this panel.
 *
 * Picking a role shows exactly what it grants. That's the question an admin
 * actually has here ("what am I about to give them?"), and answering it in the
 * panel avoids assigning a role, saving, and then reading the list to find out.
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
  const [selected, setSelected] = useState<RoleId | null>(roleIds[0] ?? null);

  // Re-seed each time the panel opens so a cancelled edit leaves nothing behind.
  useEffect(() => {
    if (open) setSelected(roleIds[0] ?? null);
  }, [open, roleIds]);

  // The chosen role's defaults, split by scope and in registry order so the two
  // lists read the same way as the permissions page behind the panel.
  const granted = useMemo(() => {
    const role = selected ? ROLE_BY_ID.get(selected) : undefined;
    const ids = new Set(role?.defaults ?? []);
    return {
      record: PERMISSIONS.filter((p) => p.scope === "record" && ids.has(p.id)),
      account: PERMISSIONS.filter((p) => p.scope === "account" && ids.has(p.id)),
      total: ids.size,
    };
  }, [selected]);

  const selectedRole = selected ? ROLE_BY_ID.get(selected) : undefined;

  return (
    <Offcanvas open={open} onOpenChange={onOpenChange}>
      <Offcanvas.Content side="right" style={{ maxWidth: 560 }}>
        <Offcanvas.Header>
          <Offcanvas.Title className="fs-5 fw-semibold mb-0">
            Assign role
          </Offcanvas.Title>
          <Offcanvas.Description className="text-muted mb-0">
            A role decides what {firstName}&apos;s allowed to do. Each person has
            one.
          </Offcanvas.Description>
        </Offcanvas.Header>

        <Offcanvas.Body className="d-flex flex-column gap-4">
          <RadioGroup
            value={selected ?? ""}
            onValueChange={(v) => v && setSelected(v as RoleId)}
            className="d-flex flex-column gap-2"
          >
            {ROLES.map((role) => {
              const checked = role.id === selected;
              return (
                // eslint-disable-next-line jsx-a11y/label-has-associated-control
                <label
                  key={role.id}
                  className={`d-flex align-items-start gap-3 border rounded p-3 ${
                    checked ? "border-primary bg-buildout-blue-50" : ""
                  }`}
                  style={{ cursor: "pointer" }}
                >
                  <RadioGroup.Item value={role.id} className="mt-1" />
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="fw-semibold">{role.name}</div>
                    <div className="text-muted small">{role.description}</div>
                  </div>
                  <div className="d-flex flex-column align-items-end gap-1 flex-shrink-0">
                    {/* The badge says how the role relates to records; the icon
                        beside it says what that means. "Works by sharing" is the
                        one worth reading — those roles grant abilities but open
                        nothing on their own. */}
                    <span className="d-inline-flex align-items-center gap-1">
                      <NeutralBadge>
                        {ROLE_ACCESS_LABELS[role.accessKind]}
                      </NeutralBadge>
                      <Tooltip>
                        <Tooltip.Trigger
                          render={
                            <span
                              tabIndex={0}
                              className="text-muted d-inline-flex align-items-center"
                              style={{ cursor: "help" }}
                              aria-label={`What "${
                                ROLE_ACCESS_LABELS[role.accessKind]
                              }" means`}
                            />
                          }
                        >
                          <FontAwesomeIcon icon={faCircleInfo} />
                        </Tooltip.Trigger>
                        <Tooltip.Content side="left" style={{ maxWidth: 260 }}>
                          {ROLE_ACCESS_DETAIL[role.accessKind]}
                        </Tooltip.Content>
                      </Tooltip>
                    </span>
                    <span className="text-muted small">
                      {role.defaults.length} of {PERMISSIONS.length}
                    </span>
                  </div>
                </label>
              );
            })}
          </RadioGroup>

          {selectedRole && (
            <div className="border rounded p-3 d-flex flex-column gap-3">
              <div>
                <div className="fw-semibold">
                  What {selectedRole.name} turns on
                </div>
                <div className="text-muted small">
                  {granted.total} of {PERMISSIONS.length} permissions, before any
                  per-person changes.
                </div>
              </div>

              {(["record", "account"] as const).map((scope) =>
                granted[scope].length === 0 ? null : (
                  <div key={scope}>
                    <div className="text-uppercase fw-semibold small text-muted mb-1">
                      {SCOPE_META[scope].heading}
                    </div>
                    <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
                      {granted[scope].map((permission) => (
                        <li
                          key={permission.id}
                          className="d-flex align-items-start gap-2 small"
                        >
                          <FontAwesomeIcon
                            icon={faCheck}
                            className="text-mountain-meadow-700 mt-1 flex-shrink-0"
                          />
                          {permission.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          )}
        </Offcanvas.Body>

        <Offcanvas.Footer className="settings-panel__footer d-flex justify-content-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!selected}
            onClick={() => selected && onSave([selected])}
          >
            Save role
          </Button>
        </Offcanvas.Footer>
      </Offcanvas.Content>
    </Offcanvas>
  );
}
