import { useEffect, useMemo, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { useRoster } from "#/components/settings/users/useRoster";
import { RoleBadge } from "#/components/settings/users/roleDisplay";
import { useCurrentUser } from "#/data/currentUser";
import type { RosterUser } from "#/data/roster";

export type AssignMode = "assign" | "transfer";

/**
 * One picker, two faces. "Assign" routes a company-owned record to the person
 * who'll work it — the current assignee steps out of the list, and an assigned
 * record can also be left unassigned. "Transfer" moves a broker-owned record
 * into another broker's book — the viewer steps out of the list, and they can
 * keep a Contributor seat on the way out. The roster is the same either way.
 */
export function AssignContactModal({
  open,
  onOpenChange,
  mode,
  /** "Andreane Daugherty", or "3 contacts" for a bulk assign. */
  subject,
  currentAssignee,
  onConfirm,
  onUnassign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AssignMode;
  subject: string;
  /** Who works it today; stepped out of the list. */
  currentAssignee?: string;
  onConfirm: (user: RosterUser, keepAsContributor: boolean) => void;
  /** Offered in assign mode when there's someone to unassign. */
  onUnassign?: () => void;
}) {
  const users = useRoster((s) => s.users);
  const me = useCurrentUser((s) => s.id);
  const [pick, setPick] = useState<string>("");
  const [keep, setKeep] = useState(true);

  useEffect(() => {
    if (open) {
      setPick("");
      setKeep(true);
    }
  }, [open]);

  const candidates = useMemo(
    () =>
      users.filter(
        (u) =>
          u.status === "active" &&
          u.name !== currentAssignee &&
          (mode === "assign" || u.id !== me),
      ),
    [users, currentAssignee, mode],
  );
  const chosen = candidates.find((u) => u.id === pick);

  const title = mode === "assign" ? `Assign ${subject}` : `Transfer ${subject}`;
  const lede =
    mode === "assign"
      ? "The company owns this contact. Assigning picks who works it — they get the full working set, and whoever had it before keeps only what's been shared with them."
      : "This contact leaves your book and becomes theirs — history, privacy setting and all. You keep nothing unless you keep a seat below.";

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content centered style={{ maxWidth: "33rem" }}>
        <Modal.Header>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          <p className="mb-0 text-muted fs-small">{lede}</p>

          <RadioGroup
            value={pick}
            onValueChange={(v) => setPick(String(v ?? ""))}
            className="d-flex flex-column"
            aria-label={mode === "assign" ? "Assign to" : "Transfer to"}
          >
            {candidates.map((u) => (
              // Blueprint's radio isn't a labelable element; the row selects.
              <label
                key={u.id}
                className="d-flex align-items-center gap-2 p-2 rounded-3 mb-0 share-modal__tier"
                style={{ cursor: "pointer" }}
                onClick={() => setPick(u.id)}
              >
                <RadioGroup.Item value={u.id} aria-label={u.name} className="flex-shrink-0" />
                <Avatar size="lg" className="flex-shrink-0">
                  {u.avatarUrl && <Avatar.Image src={u.avatarUrl} alt={u.name} />}
                  <Avatar.Fallback className="fw-semibold">{u.initials}</Avatar.Fallback>
                </Avatar>
                <span className="d-flex flex-column lh-sm flex-grow-1 min-w-0">
                  <span className="fw-semibold text-truncate">
                    {u.name}
                    {u.id === me ? " (you)" : ""}
                  </span>
                  <span className="fs-small text-muted text-truncate">{u.title}</span>
                </span>
                {u.roleIds[0] && <RoleBadge roleId={u.roleIds[0]} />}
              </label>
            ))}
          </RadioGroup>

          {mode === "transfer" && (
            <Field orientation="horizontal" className="align-items-start gap-2">
              <Checkbox checked={keep} onCheckedChange={(c) => setKeep(c === true)} />
              <div>
                <Field.Label className="mb-0">Keep me as a Contributor</Field.Label>
                <Field.Description>
                  A share, made in the same motion — you can still log activity and edit,
                  but it&apos;s their relationship now.
                </Field.Description>
              </div>
            </Field>
          )}
        </Modal.Body>
        <Modal.Footer>
          {mode === "assign" && currentAssignee && onUnassign && (
            <Button
              variant="ghost"
              className="me-auto"
              onClick={() => {
                onUnassign();
                onOpenChange(false);
              }}
            >
              Leave unassigned
            </Button>
          )}
          <Modal.Close render={<Button variant="ghost" />}>Cancel</Modal.Close>
          <Button
            variant="primary"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              onConfirm(chosen, mode === "transfer" && keep);
              onOpenChange(false);
            }}
          >
            {mode === "assign" ? "Assign" : "Transfer ownership"}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
