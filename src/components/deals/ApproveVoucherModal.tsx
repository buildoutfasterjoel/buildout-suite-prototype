import { useState } from "react";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import { findTeammate, VOUCHER_APPROVER_IDS } from "#/data/teammates";

/**
 * Sign a Pending voucher off.
 *
 * **Why a dialog and not a one-click button.** Approving needs a reviewer, and
 * the signed-in user cannot be one: `CURRENT_USER` is a Broker, and
 * `VOUCHER_APPROVER_IDS` is explicit that the broker who closed the deal is the
 * one person who must not approve it. So the approver is chosen rather than
 * assumed, from the back-office roster that list names.
 *
 * The dialog is also where approving says what it does. It is the only way a
 * voucher becomes Approved, it cannot be undone from this page, and it raises
 * payables for every deposit already filed — none of which a bare button in the
 * header could state.
 *
 * This is the smallest honest version of an approver action, not the approver
 * experience: an approval inbox, a rejection path, and `reopenVoucher` finally
 * wired up are their own pass.
 */
export function ApproveVoucherModal({
  open,
  onOpenChange,
  depositCount,
  onApprove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Deposits already on the voucher — what approving will raise payables for. */
  depositCount: number;
  onApprove: (reviewerId: string) => void;
}) {
  const [reviewerId, setReviewerId] = useState<string>(VOUCHER_APPROVER_IDS[0]);

  const approve = () => {
    onApprove(reviewerId);
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content centered style={{ maxWidth: "32rem" }}>
        <Modal.Header>
          <Modal.Title>Approve Voucher</Modal.Title>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          <Field>
            <Field.Label>Approver</Field.Label>
            <Select
              value={reviewerId}
              onValueChange={(v) => setReviewerId((v as string) ?? reviewerId)}
            >
              <Select.Trigger aria-label="Approver">
                {/* The name, passed as children. `Select.Value` renders the raw
                    value, which here is a teammate id. */}
                <Select.Value>
                  {findTeammate(reviewerId)?.name ?? reviewerId}
                </Select.Value>
              </Select.Trigger>
              <Select.Content>
                {VOUCHER_APPROVER_IDS.map((id) => {
                  const person = findTeammate(id);
                  return (
                    <Select.Item key={id} value={id}>
                      {person?.name ?? id}
                      {person && (
                        <span className="text-muted ms-2">{person.role}</span>
                      )}
                    </Select.Item>
                  );
                })}
              </Select.Content>
            </Select>
            <Field.Description>
              The back-office roles only — a broker cannot sign off their own
              deal.
            </Field.Description>
          </Field>

          <Alert severity="info" withIcon>
            <FontAwesomeIcon icon={faCircleInfo} />
            <div>
              <div className="fw-semibold">Approving will:</div>
              <ul className="mb-0 ps-3">
                <li>Record the sign-off against this voucher</li>
                <li>
                  {depositCount > 0
                    ? `Create payables for the ${depositCount} deposit${depositCount === 1 ? "" : "s"} already applied`
                    : "Create payables as deposits are applied"}
                </li>
              </ul>
              <div className="mt-2">This cannot be undone here.</div>
            </div>
          </Alert>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={approve}>
            Approve Voucher
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
