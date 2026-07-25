import { useEffect } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faFileSignature } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { requestStageChange } from "#/components/deals/useStageGate";
import { useClosingEmail } from "./useClosingEmail";
import { useHeroDemo } from "./heroDemo";
import { SIGNED_AGREEMENT_DOC } from "./rosaClosing";

const CLOSING_BODY =
  "John — Miguel never signed anything until he trusted the person across the table. " +
  "It's signed and attached. Find the operator who'll love this building the way he did. — Rosa";

/** The self-arriving signed listing agreement, surfaced in the sidebar flow. Offers to
 * activate the listing; the arc only completes once the deal actually reaches "active"
 * (a cancelled stage gate should not mark the loop closed). */
export function ClosingEmailCard() {
  const pending = useClosingEmail((s) => s.pending);
  const clear = useClosingEmail((s) => s.clear);
  const status = useDataStore((s) => s.listings.get(pending?.dealId ?? "")?.status);

  useEffect(() => {
    if (!pending) return;
    if (status === "active") {
      useHeroDemo.getState().markArcComplete();
      useClosingEmail.getState().clear();
    }
    // `pending` is read for the guard only; re-running when it changes is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!pending) return null;

  const activate = () => {
    requestStageChange(pending.dealId, "active");
  };

  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-3">
      <div className="d-flex align-items-center gap-2 small text-muted text-uppercase fw-semibold">
        <FontAwesomeIcon icon={faEnvelope} />
        Email — {pending.from}
      </div>
      <div className="fw-semibold">Signed — the listing agreement</div>
      <div style={{ whiteSpace: "pre-wrap" }}>{CLOSING_BODY}</div>
      <div className="small text-muted d-flex align-items-center gap-2">
        <FontAwesomeIcon icon={faFileSignature} />
        {SIGNED_AGREEMENT_DOC.name}
      </div>
      <div className="d-flex gap-2">
        <Button variant="primary" size="sm" onClick={activate}>
          Activate Listing
        </Button>
        <Button variant="ghost" size="sm" onClick={() => clear()}>
          Not now
        </Button>
      </div>
    </div>
  );
}
