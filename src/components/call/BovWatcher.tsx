import { useEffect, useRef } from "react";
import { useDataStore } from "#/data/dataStore";
import { getProperty } from "#/data/store";
import { useBovDraft, buildBovDraft } from "./useBovDraft";
import { useAssistant } from "#/ai/useAssistant";

/** Renders nothing. When the BOV-armed deal's underwriting result is ready, builds the BOV
 * draft once and opens the sidebar. Armed by startUnderwriting (the hero underwrite). */
export function BovWatcher() {
  const armedDealId = useBovDraft((s) => s.armedDealId);
  const listing = useDataStore((s) => (armedDealId ? s.listings.get(armedDealId) : undefined));
  const status = listing?.underwriting?.status;
  const hasResult = !!listing?.underwriting?.result;
  const builtFor = useRef<string | null>(null);

  useEffect(() => {
    if (!armedDealId) {
      builtFor.current = null;
      return;
    }
    if (builtFor.current === armedDealId) return;
    if (!listing || !hasResult || (status !== "generated" && status !== "ready")) return;
    const property = getProperty(listing.propertyId);
    if (!property) return;
    builtFor.current = armedDealId;
    void buildBovDraft(armedDealId, property, listing.underwriting!.result!).then((draft) => {
      useBovDraft.getState().setDraft(draft);
      useAssistant.getState().setOpen(true);
    });
  }, [armedDealId, listing, status, hasResult]);

  return null;
}
