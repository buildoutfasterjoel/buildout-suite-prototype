import { useRouter } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faPaperclip } from "@fortawesome/pro-regular-svg-icons";
import { useInboundEmail } from "#/components/call/useInboundEmail";
import { startUnderwriting } from "#/components/call/heroInbound";

/** The self-arriving owner email, surfaced in the sidebar flow. Shows the body + attachment
 * chips; offers to underwrite when the property is eligible. */
export function InboundEmailCard() {
  const inbound = useInboundEmail((s) => s.inbound);
  const clearInbound = useInboundEmail((s) => s.clearInbound);
  const router = useRouter();
  if (!inbound) return null;

  const underwrite = () => {
    startUnderwriting(inbound.dealId);
    const dealId = inbound.dealId;
    clearInbound();
    router.navigate({ to: "/listings/$listingId", params: { listingId: dealId } });
  };

  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-3">
      <div className="d-flex align-items-center gap-2 small text-muted text-uppercase fw-semibold">
        <FontAwesomeIcon icon={faEnvelope} />
        Email — {inbound.from}
      </div>
      <div className="fw-semibold">{inbound.subject}</div>
      <div style={{ whiteSpace: "pre-wrap" }}>{inbound.body}</div>
      <div className="d-flex flex-column gap-1">
        {inbound.attachments.map((a) => (
          <div key={a} className="small text-muted d-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faPaperclip} />
            {a}
          </div>
        ))}
      </div>
      {inbound.canUnderwrite && (
        <div className="d-flex gap-2">
          <Button variant="primary" size="sm" onClick={underwrite}>
            Underwrite this deal
          </Button>
          <Button variant="ghost" size="sm" onClick={() => clearInbound()}>
            Not now
          </Button>
        </div>
      )}
    </div>
  );
}
