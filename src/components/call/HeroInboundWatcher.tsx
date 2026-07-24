import { useEffect, useRef } from "react";
import { useCallStore } from "./useCallStore";
import { heroInbound } from "./heroInbound";

/** Renders nothing. Watches the hero recap completing (`heroActions` set on hang-up) and
 * arms the ~10s self-arriving owner email once per hero call. Mounted in AppShell. */
export function HeroInboundWatcher() {
  const heroActions = useCallStore((s) => s.heroActions);
  const armedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!heroActions) {
      armedFor.current = null; // reset when the recap is dismissed, so a later call re-arms
      return;
    }
    if (armedFor.current === heroActions.dealId) return; // already armed for this deal
    const contactId = useCallStore.getState().target?.contactId;
    if (!contactId) return;
    armedFor.current = heroActions.dealId;
    heroInbound.arm(heroActions.dealId, contactId);
  }, [heroActions]);

  return null;
}
