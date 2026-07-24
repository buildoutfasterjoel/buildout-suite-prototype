import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateRight } from "@fortawesome/pro-regular-svg-icons";
import { useHeroDemo, arcCompleteText } from "#/components/call/heroDemo";

/** Loop-closing completion beat shown when the hero arc finishes (BOV sent). "Run it again"
 * is wired by the sidebar (clears the chat + resetHeroDemo). */
export function HeroDemoCard({ onRunAgain }: { onRunAgain: () => void }) {
  const arcComplete = useHeroDemo((s) => s.arcComplete);
  const clearComplete = useHeroDemo((s) => s.clearComplete);
  if (!arcComplete) return null;
  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-3">
      <div className="d-flex align-items-center gap-2 small text-muted text-uppercase fw-semibold">
        <FontAwesomeIcon icon={faRotateRight} />
        That's the loop
      </div>
      <div>{arcCompleteText()}</div>
      <div className="d-flex gap-2">
        <Button variant="primary" size="sm" onClick={onRunAgain}>Run it again</Button>
        <Button variant="ghost" size="sm" onClick={() => clearComplete()}>Done</Button>
      </div>
    </div>
  );
}
