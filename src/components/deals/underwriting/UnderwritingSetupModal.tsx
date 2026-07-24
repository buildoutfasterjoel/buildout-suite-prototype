import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles } from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { UnderwritingDepth } from "../UnderwritingDepth";
import {
  checksFor,
  coerceStrategy,
  defaultSelectionFor,
  type UnderwritingStrategyId,
} from "./strategies";

/**
 * The Cactus underwriting setup dialog — pick a strategy and how thorough the
 * analysis should be, then Start. Shared by the deal planner's underwriting
 * row and the contact page's deal card, so kicking the flow off from either
 * place goes through the identical setup step.
 *
 * Seeds its working state from the deal's persisted run (if any) each time it
 * opens; `fallbackStrategy` sets the initial strategy for a deal with no run
 * yet (e.g. Value-Add for an existing building).
 */
export function UnderwritingSetupModal({
  open,
  onOpenChange,
  listing,
  fallbackStrategy,
  onStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: Listing;
  fallbackStrategy?: UnderwritingStrategyId;
  /** Fired with the committed choices; the modal closes itself right after. */
  onStart: (strategy: UnderwritingStrategyId, selection: Set<number>) => void;
}) {
  const initialStrategy = (): UnderwritingStrategyId =>
    listing.underwriting?.strategy
      ? coerceStrategy(listing.underwriting.strategy)
      : fallbackStrategy ?? coerceStrategy(undefined);
  const initialSelection = (strat: UnderwritingStrategyId): Set<number> => {
    const count = checksFor(strat).length;
    const persisted = listing.underwriting?.selectedChecks;
    return persisted?.length
      ? new Set(persisted.filter((i) => i >= 0 && i < count))
      : new Set(defaultSelectionFor(strat));
  };

  const [strategy, setStrategy] = useState<UnderwritingStrategyId>(initialStrategy);
  const [selection, setSelection] = useState<Set<number>>(() =>
    initialSelection(initialStrategy()),
  );

  // Re-seed from the deal's persisted run each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const strat = initialStrategy();
    setStrategy(strat);
    setSelection(initialSelection(strat));
    // Seeding depends only on the open flip; the listing is stable while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
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
            strategy={strategy}
            value={selection}
            onStrategyChange={setStrategy}
            onChange={setSelection}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={selection.size === 0}
            onClick={() => {
              onStart(strategy, selection);
              onOpenChange(false);
            }}
          >
            <FontAwesomeIcon icon={faWandMagicSparkles} />
            Start underwriting
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
