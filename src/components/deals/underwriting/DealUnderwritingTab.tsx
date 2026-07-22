import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles, faCalculator, faFileLines } from "@fortawesome/pro-regular-svg-icons";
import type { Listing, UnderwritingResult, UnderwritingResultSection } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import {
  updateListingUnderwriting,
  generateUnderwritingResult,
} from "#/data/store";
import { notify } from "#/lib/notify";
import { UnderwritingDepth } from "../UnderwritingDepth";
import { UnderwritingProgress } from "./UnderwritingProgress";
import { UnderwritingPlacementModal } from "./UnderwritingPlacementModal";
import {
  defaultSelectionFor,
  underwritingFromSelection,
  coerceStrategy,
  checksFor,
  strategyLabel,
  type UnderwritingStrategyId,
} from "./strategies";

type Phase = "idle" | "generating" | "generated" | "ready";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString();
}

export function DealUnderwritingTab({ listing: initial }: { listing: Listing }) {
  const navigate = useNavigate();
  // Reactive: reflect generation triggered from any entry point.
  const listing = useDataStore((s) => s.listings.get(initial.id)) ?? initial;
  const uw = listing.underwriting;

  const initialStrategy = (): UnderwritingStrategyId => coerceStrategy(uw?.strategy);
  const initialSelection = (strat: UnderwritingStrategyId) => {
    const count = checksFor(strat).length;
    const persisted = uw?.selectedChecks;
    return persisted?.length
      ? new Set(persisted.filter((i) => i >= 0 && i < count))
      : new Set(defaultSelectionFor(strat));
  };

  const [phase, setPhase] = useState<Phase>(
    uw?.status === "ready" ? "ready" : uw?.status === "generated" ? "generated" : uw?.status === "generating" ? "generating" : "idle",
  );
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStrategy, setSetupStrategy] = useState<UnderwritingStrategyId>(initialStrategy);
  const [setupSelection, setSetupSelection] = useState<Set<number>>(() => initialSelection(initialStrategy()));
  const [runStrategy, setRunStrategy] = useState<UnderwritingStrategyId>(initialStrategy);
  const [runSelection, setRunSelection] = useState<Set<number>>(() => initialSelection(initialStrategy()));
  const [placementOpen, setPlacementOpen] = useState(false);

  // Compute-on-read fallback: a deal marked ready/generated with no stored
  // result (older data) gets one built + persisted once, so the breakdown shows.
  useEffect(() => {
    if ((uw?.status === "ready" || uw?.status === "generated") && !uw.result) {
      generateUnderwritingResult(listing.id);
    }
  }, [uw?.status, uw?.result, listing.id]);

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

  const result = uw?.result;

  return (
    <div className="p-4">
      {phase === "idle" && (
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faCalculator} aria-label="Underwriting" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No underwriting yet</Empty.Title>
            Generate an AI underwriting breakdown for this deal — figures are
            estimated from property, market, and financial data for your review.
          </Empty.Content>
          <Empty.Actions>
            <Button variant="primary" onClick={openSetup}>
              <FontAwesomeIcon icon={faWandMagicSparkles} />
              Generate underwriting
            </Button>
          </Empty.Actions>
        </Empty>
      )}

      {phase === "generating" && (
        <div>
          <div className="fw-semibold mb-2">AI underwriting</div>
          <UnderwritingProgress
            strategy={runStrategy}
            selectedChecks={[...runSelection]}
            onComplete={() => {
              generateUnderwritingResult(listing.id);
              updateListingUnderwriting(listing.id, { status: "generated" });
              setPhase("generated");
              notify({ title: "Underwriting ready", description: "Save it to a document to finish." });
            }}
          />
        </div>
      )}

      {(phase === "generated" || phase === "ready") && result && (
        <UnderwritingBreakdown
          result={result}
          strategyLabel={strategyLabel(coerceStrategy(uw?.strategy))}
          generatedAt={uw?.generatedAt}
          saved={phase === "ready"}
          onRegenerate={openSetup}
          onSave={() => setPlacementOpen(true)}
          onViewInDocument={() =>
            navigate({
              to: "/editor/$listingId",
              params: { listingId: listing.id },
              search: { focus: "underwriting" },
            })
          }
        />
      )}

      {/* Depth setup — reuse the create-flow thoroughness control. */}
      <Modal open={setupOpen} onOpenChange={setSetupOpen}>
        <Modal.Content centered>
          <Modal.Header>
            <Modal.Title>Generate underwriting</Modal.Title>
            <Modal.Description>
              Set how thorough the underwriting should be. More checks means a deeper analysis — and a little longer to generate.
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
            <Button variant="ghost" onClick={() => setSetupOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={setupSelection.size === 0} onClick={startGeneration}>
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
        onPlaced={() => setPhase("ready")}
      />
    </div>
  );
}

function UnderwritingBreakdown({
  result,
  strategyLabel,
  generatedAt,
  saved,
  onRegenerate,
  onSave,
  onViewInDocument,
}: {
  result: UnderwritingResult;
  strategyLabel: string;
  generatedAt?: string;
  saved: boolean;
  onRegenerate: () => void;
  onSave: () => void;
  onViewInDocument: () => void;
}) {
  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div className="h5 mb-1">{strategyLabel}</div>
          <div className="text-muted fs-small">
            {result.sections.length} {result.sections.length === 1 ? "analysis" : "analyses"}
            {generatedAt ? ` · Generated ${relativeTime(generatedAt)}` : ""} · reflects data for {result.inputs.address}
          </div>
        </div>
        <div className="d-flex gap-2 flex-shrink-0">
          {!saved && (
            <Button variant="primary" size="sm" onClick={onSave}>Save to document</Button>
          )}
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            <FontAwesomeIcon icon={faWandMagicSparkles} />
            Re-generate
          </Button>
          <Button variant="ghost" size="sm" onClick={onViewInDocument}>
            <FontAwesomeIcon icon={faFileLines} />
            View in document
          </Button>
        </div>
      </div>

      {/* Metrics grid — all addressable metrics, body-size bold figures. */}
      <div>
        <div className="fw-semibold mb-2">Key metrics</div>
        <div className="d-flex flex-wrap gap-4">
          {result.metrics.map((m) => (
            <div key={m.key} style={{ minWidth: 140 }}>
              <div className="text-muted fs-small">{m.label}</div>
              <div className="fw-bold">{m.display}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown tables — one per selected check. */}
      {result.sections.map((s) => (
        <SectionTable key={s.key} section={s} />
      ))}
    </div>
  );
}

function SectionTable({ section }: { section: UnderwritingResultSection }) {
  return (
    <div>
      <div className="fw-semibold mb-2">{section.name}</div>
      <Table>
        {section.kind === "matrix" && section.columns && (
          <Table.Header>
            <Table.Row>
              {section.columns.map((col, i) => (
                <Table.Head key={col} className={i === 0 ? undefined : "text-end"}>{col}</Table.Head>
              ))}
            </Table.Row>
          </Table.Header>
        )}
        <Table.Body>
          {section.rows.map((r, ri) => (
            <Table.Row key={ri}>
              {r.cells.map((cell, ci) => (
                <Table.Cell
                  key={ci}
                  className={[ci === 0 ? "" : "text-end", r.emphasis || (section.kind === "keyValue" && ci === 0) ? "fw-semibold" : ""].join(" ").trim() || undefined}
                >
                  {cell}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
