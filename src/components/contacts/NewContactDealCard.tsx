import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { faAddressBook, faCheckToSlot } from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import { getLeadsForProperty } from "#/data/store";
import { leadsForSpaceDeal } from "#/data/unitScopedMarketing";
import { useDataStore } from "#/data/dataStore";
import { requestStageChange } from "#/components/deals/useStageGate";
import { dealSupportsUnderwriting } from "#/components/deals/underwriting/eligibility";
import { useBovFlow } from "#/components/contacts/useBovFlow";
import { useContactSession } from "#/components/contacts/useContactSession";
import { NewDealCard, type DealCardAction } from "#/components/deals/NewDealCard";
import { dealRelationshipFor } from "#/components/deals/newCardTokens";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";
import { dealCardLinkProps, spaceLeadsTarget } from "#/components/deals/dealCardLink";
import { useOpenLeadsRow } from "#/components/contacts/useOpenLeadsRow";

/** "Jul 27, 2026" — the date the contact's inquiry came in. */
function medDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The redesigned deal card as it appears on a contact's record: resolves the
 * contact's relationship to the deal, the stage's single call to action, and the
 * click-through, then hands the presentation to `NewDealCard`.
 *
 * The CTA rules follow the stage, same as the current card's quick link:
 * Pitching offers the underwriting step (only while there's one left to take),
 * Active offers the leads the listing has drawn, and every later stage offers
 * nothing. A contact who only *inquired* gets no CTA at all — the deal isn't
 * theirs to act on.
 */
export function NewContactDealCard({
  listingId,
  contact,
  highlight = false,
}: {
  listingId: string;
  contact: Contact;
  highlight?: boolean;
}) {
  const navigate = useNavigate();
  const listing = useDataStore((s) => s.listings.get(listingId));
  // The leads count is read off the contacts map, so track it for re-renders.
  useDataStore((s) => s.contacts);
  // The "View Leads" CTA on an active deal opens that deal's own Leads — the
  // suite's own filtered list when it's a space, not the building's unfiltered
  // one. See `spaceLeadsTarget`. Called here at the top level, not inside
  // `action()` below, because `action()` runs outside render, where hooks
  // aren't allowed.
  const openLeadsRow = useOpenLeadsRow(listingId);
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (highlight) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlight]);
  const bovSent = useContactSession((s) =>
    Object.values(s.logged).some((activities) =>
      activities.some((a) =>
        a.attachments?.some((att) => att.dealId === listingId),
      ),
    ),
  );
  if (!listing) return null;

  const relationship = dealRelationshipFor(contact, listing);
  const inquired = relationship === "inquired";

  /** The underwriting step still open on a Pitching deal, if any. */
  function underwritingAction(): DealCardAction | null {
    // Underwriting doesn't belong to a suite — see `dealSupportsUnderwriting`.
    // Without this, a space (in `proposal` status, a party contact carried
    // over from its parent via `addSpaceToDeal`) would offer "Build
    // Underwriting" and route through `BovFlow` into the same document
    // write the space's own Underwriting tab was removed for.
    if (!dealSupportsUnderwriting(listing!)) return null;
    const run = listing!.underwriting;
    // Every branch hands off to the shared flow store (see `useBovFlow`), which
    // the app shell renders. Hosting the setup dialog here instead put a modal
    // inside this card's `onClick`, and React portals bubble through the React
    // tree — so clicking the dialog navigated to the deal behind it.
    const open = () => {
      if (run == null) useBovFlow.getState().openSetup(listingId, contact.id);
      else if (run.status === "generated")
        useBovFlow.getState().openPlacement(listingId, contact.id);
      else void navigate(dealCardLinkProps(listing!));
    };
    switch (run?.status) {
      case "generating":
        return { icon: faCheckToSlot, label: "View Underwriting Progress", onClick: open };
      case "generated":
        return { icon: faCheckToSlot, label: "Save Underwriting", onClick: open };
      case "ready":
        // Once the BOV has gone to the owner the ball is in their court.
        return bovSent
          ? null
          : { icon: faCheckToSlot, label: "Review Underwriting", onClick: open };
      default:
        return { icon: faCheckToSlot, label: "Build Underwriting", onClick: open };
    }
  }

  function action(): DealCardAction | null {
    if (inquired) return null;
    if (listing!.status === "proposal") return underwritingAction();
    if (listing!.status === "active") {
      // The count must agree with what the click opens — see the comment on
      // this in ContactDealCard.tsx. `openLeadsRow` sends a suite to its own
      // filtered Leads (see `spaceLeadsTarget`), so the badge counts against
      // that same filter rather than the building's unfiltered list. Passing
      // `null` when this isn't a space leaves `leadsForSpaceDeal` a no-op, so
      // the count is unchanged for every other shape.
      const target = spaceLeadsTarget(listingId);
      return {
        icon: faAddressBook,
        label: "View Leads",
        count: leadsForSpaceDeal(
          getLeadsForProperty(listing!.propertyId),
          target ? target.spaceId : null,
        ).length,
        onClick: openLeadsRow,
      };
    }
    return null;
  }

  return (
    <div
      ref={cardRef}
      className={highlight ? "contact-deal-card--spotlight" : undefined}
      onClick={(e) => {
        if (shouldIgnoreRowClick(e)) return;
        void navigate(dealCardLinkProps(listing));
      }}
    >
      <NewDealCard
        listing={listing}
        relationship={relationship}
        contactName={contactFullName(contact)}
        inquiredOn={medDate(contact.createdAt)}
        action={action()}
        onStageChange={(next) => requestStageChange(listingId, next)}
      />
    </div>
  );
}
