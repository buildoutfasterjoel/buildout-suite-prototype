import { useEffect, useRef } from "react";
import { useDataStore } from "#/data/dataStore";
import { advanceIngestion, finishIngestion } from "#/data/actions";
import { INGESTION_STAGES } from "#/data/ingestion";

/** How long each ingestion stage "runs" before the next one starts. */
const STAGE_MS = 1600;

/**
 * Renders nothing. Drives any deal whose ingestion run is still `processing`:
 * walks the stages on a timer, then commits via `finishIngestion`.
 *
 * Mounted in the AppShell rather than on the deal overview on purpose — that is
 * what makes the run genuinely background, so it keeps advancing (and lands)
 * even if the broker navigates away from the deal mid-run.
 */
export function IngestionWatcher() {
  // Reactive selector: the first processing deal's id, or undefined. Only one
  // run is ever in flight in the prototype (a run starts at deal creation).
  const dealId = useDataStore((s) => {
    for (const [id, listing] of s.listings) {
      if (listing.ingestion?.status === "processing") return id;
    }
    return undefined;
  });
  // Guards against re-running for a deal this mount already drove.
  const drivenFor = useRef<string | null>(null);

  useEffect(() => {
    if (!dealId) {
      drivenFor.current = null;
      return;
    }
    if (drivenFor.current === dealId) return;
    drivenFor.current = dealId;

    const timers: ReturnType<typeof setTimeout>[] = [];
    // Stage 0 is already showing; schedule the advance into each later stage,
    // then the commit one stage-length after the last one lands.
    for (let i = 1; i < INGESTION_STAGES.length; i += 1) {
      timers.push(setTimeout(() => advanceIngestion(dealId), STAGE_MS * i));
    }
    timers.push(
      setTimeout(() => finishIngestion(dealId), STAGE_MS * INGESTION_STAGES.length),
    );
    return () => timers.forEach(clearTimeout);
  }, [dealId]);

  return null;
}
