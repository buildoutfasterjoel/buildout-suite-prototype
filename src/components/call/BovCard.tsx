import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileInvoiceDollar, faTriangleExclamation } from "@fortawesome/pro-regular-svg-icons";
import { useBovDraft } from "#/components/call/useBovDraft";
import { addDealDocument, addDealActivity } from "#/data/store";
import { CURRENT_USER } from "#/data/teammates";

const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

/** The drafted BOV, surfaced in the sidebar flow. Shows the grounded value range +
 * headline + rationale (+ an occupancy-mismatch flag when relevant); offers to
 * send it or dismiss. */
export function BovCard() {
  const draft = useBovDraft((s) => s.draft);
  const clear = useBovDraft((s) => s.clear);
  if (!draft) return null;
  const range = `${money(draft.valueLow)}–${money(draft.valueHigh)}`;

  const send = () => {
    const now = new Date().toISOString();
    addDealDocument(draft.dealId, {
      id: crypto.randomUUID(),
      name: "Palmetto Court — BOV.pdf",
      uploadedAt: now,
      size: "0.4 MB",
      aiGenerated: true,
    });
    addDealActivity(draft.dealId, {
      type: "bov",
      note: `Sent BOV to Marcus — ${range}`,
      actor: CURRENT_USER.name,
    });
    clear();
  };

  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-3">
      <div className="d-flex align-items-center gap-2 small text-muted text-uppercase fw-semibold">
        <FontAwesomeIcon icon={faFileInvoiceDollar} />
        Broker Opinion of Value
      </div>
      <div className="fw-bold fs-5">{range}</div>
      <div>{draft.spec.headline}</div>
      <div className="text-muted">{draft.spec.rationale}</div>
      {draft.mismatch.isMismatch && draft.spec.occupancyNote && (
        <div className="d-flex align-items-start gap-2 text-warning-emphasis">
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <div className="small">{draft.spec.occupancyNote}</div>
        </div>
      )}
      <div className="d-flex gap-2">
        <Button variant="primary" size="sm" onClick={send}>
          Send BOV
        </Button>
        <Button variant="ghost" size="sm" onClick={() => clear()}>
          Not now
        </Button>
      </div>
    </div>
  );
}
