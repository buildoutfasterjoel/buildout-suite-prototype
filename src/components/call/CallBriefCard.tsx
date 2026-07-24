import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPhone } from "@fortawesome/pro-regular-svg-icons";
import type { CallBriefSpecT } from "#/ai/generate/schemas";

/** Signal-driven pre-call brief shown when the broker asks Otto to "brief me
 * first". A Call button starts the live call. */
export function CallBriefCard({
  brief,
  contactName,
  onCall,
}: {
  brief: CallBriefSpecT;
  contactName: string;
  onCall: () => void;
}) {
  const rows: [string, string][] = [
    ["Opener", brief.opener],
    ["Lead with", brief.leadWith],
    ["The ask", brief.ask],
    ["Voicemail", brief.voicemail],
  ];
  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-3">
      <div className="small text-muted text-uppercase fw-semibold">Call brief — {contactName}</div>
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="small text-muted fw-semibold">{label}</div>
          <div>{value}</div>
        </div>
      ))}
      <Button variant="primary" size="sm" onClick={onCall}>
        <FontAwesomeIcon icon={faPhone} /> Call {contactName}
      </Button>
    </div>
  );
}
