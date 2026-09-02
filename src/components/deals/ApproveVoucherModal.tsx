import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import { findTeammate } from "#/data/teammates";
import { useCurrentUser } from "#/data/currentUser";
import { useViewer } from "#/components/settings/users/useViewer";
import { MemberAvatar } from "#/components/common/TeammatePicker";

/**
 * Sign a Pending voucher off.
 *
 * **Why a dialog and not a one-click button.** Not to pick an approver — you
 * are the approver. The button behind this only renders for a holder of Approve
 * Vouchers, so by the time the dialog opens the signature is settled and the
 * field below states it rather than asking.
 *
 * The dialog earns its place by saying what approving does. It is the only way a
 * voucher becomes Approved, it cannot be undone from this page, and it raises
 * payables for every deposit already filed — none of which a bare button in the
 * header could state.
 *
 * It used to ask *who is signing*, from a hardcoded list, because the signed-in
 * user could never be one of them. The Back Office Manager role fixed that: the
 * approver is whoever is looking.
 *
 * Still not the full approver experience — an approval inbox, a rejection path,
 * and `reopenVoucher` finally wired up are their own pass.
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
  // The seat, not the roster row, is what gets stamped on the voucher: the
  // roster row carries the title to show beside the name, and its id is the
  // same seat.
  const reviewerId = useCurrentUser((s) => s.id);
  const viewer = useViewer();
  const person = findTeammate(reviewerId);

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
            {/* Read-only by design — see the note above. A control here would
                imply the signature is a choice. */}
            <div className="d-flex align-items-center gap-2 border rounded p-2 bg-card">
              {person && <MemberAvatar member={person} />}
              <span className="d-flex flex-column lh-sm">
                <span className="fw-semibold">{person?.name ?? "You"}</span>
                {viewer?.title && (
                  <span className="fs-small text-muted">{viewer.title}</span>
                )}
              </span>
            </div>
            <Field.Description>
              Your sign-off is recorded against this voucher.
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
