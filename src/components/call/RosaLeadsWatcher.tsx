import { useEffect, useRef } from "react";
import { useDataStore } from "#/data/dataStore";
import { onDelgadoDealActivated } from "./rosaLeads";

/**
 * Renders nothing. Watches the deal on Rosa's owned building and, the moment it
 * commits to Active, drops the three inbound leads onto it (see rosaLeads.ts).
 *
 * Lives in the AppShell rather than on the contact page because the stage flip
 * can come from anywhere the broker happens to be — the timeline row's
 * "Activate Listing", the card's stage chip, the deals board, the deal header —
 * and the market answering a live listing shouldn't depend on which screen was
 * open when it went live.
 */
export function RosaLeadsWatcher() {
  const contacts = useDataStore((s) => s.contacts);
  const listings = useDataStore((s) => s.listings);
  // Property ids we've already seeded this session, so the effect can re-run on
  // any store change without re-checking (seeding is idempotent regardless).
  const seeded = useRef<Set<string>>(new Set());

  useEffect(() => {
    const rosa = [...contacts.values()].find((c) => c.heroKey === "rosa");
    const propertyId = rosa?.ownedPropertyIds?.[0];
    if (!propertyId || seeded.current.has(propertyId)) return;
    const live = [...listings.values()].some(
      (l) => l.propertyId === propertyId && l.status === "active",
    );
    if (!live) return;
    seeded.current.add(propertyId);
    onDelgadoDealActivated(propertyId);
  }, [contacts, listings]);

  return null;
}
