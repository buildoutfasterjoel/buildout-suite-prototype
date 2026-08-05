import { useEffect, useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
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
 * A centered modal, not a flyout. This app reserves Offcanvas for filtering the
 * list you're already looking at — `ContactFilters` and `TaskFilters`, both
 * left-side, both titled "Filters" — while every committed decision is a Modal
 * (NewContact, CreateDeal, ShareContact, StageGate, and a dozen more). This has
 * a Save/Cancel footer and changes data, so it belongs with the latter. Sized
 * and scrolled to match `ShareContactModal`, the closest analogue: pick one
 * option from a list, see what it implies, commit.
 *
 * One role per person: the engineering plan models assignments as a
 * non-exclusive set and the resolver still unions a list, but the product rule
 * is a single role, so this is a radio group rather than checkboxes. If that
 * relaxes, the resolver needs no change — only this component.
 *
 * Picking a role shows exactly what it grants. That's the question an admin
 * actually has here ("what am I about to give them?"), and answering it here
 * avoids assigning a role, saving, and then reading the list to find out.
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
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content centered style={{ maxWidth: "33rem" }}>
        <Modal.Header>
          <Modal.Title>Assign role</Modal.Title>
        </Modal.Header>

        {/* The body scrolls rather than the page: five roles plus the selected
            role's permission list outgrows a viewport, and the footer's Save
            should stay reachable. Matches AddContactsToListModal. */}
        <Modal.Body
          className="d-flex flex-column gap-4"
          style={{ maxHeight: "60vh", overflowY: "auto" }}
        >
          <p className="text-muted mb-0">
            A role decides what {firstName} is allowed to do. Each person has
            one.
          </p>

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
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close render={<Button variant="ghost" />}>Cancel</Modal.Close>
          <Button
            variant="primary"
            disabled={!selected}
            onClick={() => selected && onSave([selected])}
          >
            Save role
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
