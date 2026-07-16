import { StageGate } from "#/components/deals/StageGate";
import { useStageGate } from "#/components/deals/useStageGate";

/** The single, app-wide stage-gate modal, driven by the useStageGate store. */
export function GlobalStageGateModal() {
  const open = useStageGate((s) => s.open);
  const dealId = useStageGate((s) => s.dealId);
  const targetStage = useStageGate((s) => s.targetStage);
  const mode = useStageGate((s) => s.mode);
  const close = useStageGate((s) => s.close);

  if (!dealId || !targetStage) return null;

  return (
    <StageGate
      dealId={dealId}
      targetStage={targetStage}
      completeSetup={mode === "complete"}
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    />
  );
}
