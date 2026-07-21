import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles } from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { updateListingUnderwriting } from "#/data/store";
import { PlannerRow, TaskMarker } from "../TodayPlanner";
import { UnderwritingDepth } from "../UnderwritingDepth";
import {
  defaultSelectionFor,
  underwritingFromSelection,
  coerceStrategy,
  checksFor,
  type UnderwritingStrategyId,
} from "./strategies";
import { UnderwritingProgress } from "./UnderwritingProgress";
import { UnderwritingPlacementModal } from "./UnderwritingPlacementModal";

type Phase = "idle" | "generating" | "generated" | "ready";

/** Whether a deal should render the AI-underwriting planner row at all. */
export function showsUnderwritingRow(listing: Listing): boolean {
  const hasUwTask = listing.tasks.some((t) => t.label === "Underwriting");
  return !hasUwTask && (listing.status === "proposal" || listing.underwriting != null);
}

/**
 * The AI underwriting row on the deal planner. Owns the whole flow:
 * idle (Generate button) → a depth-setup modal → inline generation progress →
 * a placement modal → "Review". A deal created with underwriting on lands here
 * already 'generating', so it kicks off automatically with no click.
 */
export function UnderwritingPlannerRow({ listing }: { listing: Listing }) {
  const navigate = useNavigate();
  const initialStrategy = (): UnderwritingStrategyId =>
    coerceStrategy(listing.underwriting?.strategy);
  const initialSelection = (strat: UnderwritingStrategyId) => {
    const count = checksFor(strat).length;
    const persisted = listing.underwriting?.selectedChecks;
    return persisted?.length
      ? new Set(persisted.filter((i) => i >= 0 && i < count))
      : new Set(defaultSelectionFor(strat));
  };

  const [phase, setPhase] = useState<Phase>(
    listing.underwriting?.status === "ready"
      ? "ready"
      : listing.underwriting?.status === "generating"
        ? "generating"
        : "idle",
  );
  const [setupOpen, setSetupOpen] = useState(false);
  const [runStrategy, setRunStrategy] = useState<UnderwritingStrategyId>(initialStrategy);
  // The selection the current run is generating against.
  const [runSelection, setRunSelection] = useState<Set<number>>(() =>
    initialSelection(initialStrategy()),
  );
  const [setupStrategy, setSetupStrategy] =
    useState<UnderwritingStrategyId>(initialStrategy);
  // The setup modal's working selection (committed on Start).
  const [setupSelection, setSetupSelection] = useState<Set<number>>(() =>
    initialSelection(initialStrategy()),
  );
  const [placementOpen, setPlacementOpen] = useState(false);
  const [placedName, setPlacedName] = useState<string | undefined>(
    listing.underwriting?.placement?.documentName,
  );

  function openSetup() {
    const strat = initialStrategy();
    setSetupStrategy(strat);
    setSetupSelection(initialSelection(strat));
    setSetupOpen(true);
  }

  function startGeneration() {
    const sel = setupSelection.size > 0 ? setupSelection : new Set([0]);
    updateListingUnderwriting(listing.id, {
      ...underwritingFromSelection(setupStrategy, sel),
      status: "generating",
    });
    setRunStrategy(setupStrategy);
    setRunSelection(sel);
    setSetupOpen(false);
    setPhase("generating");
  }

  const marker = <TaskMarker complete={phase === "ready"} onToggle={() => {}} />;

  return (
    <>
      <PlannerRow
        spine="middle"
        marker={marker}
        right={
          phase === "idle" ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0"
              onClick={openSetup}
            >
              <FontAwesomeIcon icon={faWandMagicSparkles} />
              Generate underwriting
            </Button>
          ) : phase === "generated" ? (
            <Button
              variant="primary"
              size="sm"
              className="flex-shrink-0"
              onClick={() => setPlacementOpen(true)}
            >
              Choose document
            </Button>
          ) : phase === "ready" ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0"
              onClick={() =>
                navigate({
                  to: "/editor/$listingId",
                  params: { listingId: listing.id },
                  search: { focus: "underwriting" },
                })
              }
            >
              Review
            </Button>
          ) : undefined
        }
      >
        {phase === "generating" ? (
          <div className="pe-2">
            <div className="fw-semibold mb-2">AI underwriting</div>
            <UnderwritingProgress
              strategy={runStrategy}
              selectedChecks={[...runSelection]}
              onComplete={() => {
                setPhase("generated");
                setPlacementOpen(true);
              }}
            />
          </div>
        ) : (
          <>
            <div className="fw-semibold">AI underwriting</div>
            <div className="text-muted fs-small">
              {phase === "ready"
                ? placedName
                  ? `Filed in ${placedName}`
                  : "Generated by AI"
                : phase === "generated"
                  ? "Underwriting ready — choose where to file it."
                  : "Generate an AI underwriting page for this deal."}
            </div>
          </>
        )}
      </PlannerRow>

      {/* Depth setup — reuse the create-flow thoroughness control. */}
      <Modal open={setupOpen} onOpenChange={setSetupOpen}>
        <Modal.Content centered>
          <Modal.Header>
            <Modal.Title>Generate underwriting</Modal.Title>
            <Modal.Description>
              Set how thorough the underwriting should be. More checks means a
              deeper analysis — and a little longer to generate.
            </Modal.Description>
          </Modal.Header>
          <Modal.Body>
            <UnderwritingDepth
              strategy={setupStrategy}
              value={setupSelection}
              onStrategyChange={setSetupStrategy}
              onChange={setSetupSelection}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onClick={() => setSetupOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={setupSelection.size === 0}
              onClick={startGeneration}
            >
              <FontAwesomeIcon icon={faWandMagicSparkles} />
              Start underwriting
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>

      <UnderwritingPlacementModal
        open={placementOpen}
        onOpenChange={setPlacementOpen}
        listing={listing}
        onPlaced={(placement) => {
          setPlacedName(placement.documentName);
          setPhase("ready");
        }}
      />
    </>
  );
}
