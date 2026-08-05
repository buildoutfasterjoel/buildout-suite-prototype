import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisVertical,
  faFile,
  faUserGroup,
  faCheckToSlot,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { Listing } from "#/data/types";
import {
  getLeadsForProperty,
  getProperty,
  updateListingUnderwriting,
} from "#/data/store";
import { useDataStore } from "#/data/dataStore";
import { requestStageChange } from "#/components/deals/useStageGate";
import { UnderwritingSetupModal } from "#/components/deals/underwriting/UnderwritingSetupModal";
import {
  underwritingFromSelection,
  type UnderwritingStrategyId,
} from "#/components/deals/underwriting/strategies";
import { useBovFlow } from "#/components/contacts/useBovFlow";
import { useContactSession } from "#/components/contacts/useContactSession";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  getPhotoUrl,
} from "#/components/properties/propertyDisplay";
import { dealHeadlineLabel } from "#/components/deals/dealDisplay";
import { SIDE_DISPLAY } from "#/components/contacts/contactDisplay";
import { DealStageChip } from "#/components/deals/DealStageChip";
import { dealShape } from "#/data/dealShape";
import { ContactLinkButton } from "#/components/contacts/ContactLinkButton";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";
import {
  buildingSectionListingId,
  dealCardLinkProps,
} from "#/components/deals/dealCardLink";

function medDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The AI-suggested next action for a deal, if any. Rule-based for now (an early
 * example, to be expanded with the AI team); returns null when nothing applies.
 * For a proposal-stage deal the action tracks the Cactus underwriting run:
 * build (no run yet) → view progress → save → review. Once the BOV has gone
 * out to the owner, the underwriting step is done — the ball is in their
 * court, so the card offers no next action.
 */
function dealNextAction(
  listing: Listing,
  bovSent: boolean,
): { label: string; icon: IconDefinition } | null {
  if (listing.status !== "proposal") return null;
  switch (listing.underwriting?.status) {
    case "generating":
      return { label: "View Underwriting Progress", icon: faCheckToSlot };
    case "generated":
      return { label: "Save Underwriting", icon: faCheckToSlot };
    case "ready":
      return bovSent
        ? null
        : { label: "Review Underwriting", icon: faCheckToSlot };
    default:
      return { label: "Build Underwriting", icon: faCheckToSlot };
  }
}

/**
 * Which quick link the card offers, by stage — the one thing the broker would
 * open next on a deal at that point in its life:
 *
 *   Pitching  → Documents. Winning the business is a paperwork story (the
 *               owner's financials in, the BOV going out).
 *   Active     → Leads. It's in market; the work is the buyers answering.
 *   UC/Closed/Lost → nothing. The deal has moved past what a card shortcut
 *               helps with, so the card stays quiet rather than offering a
 *               link into a finished file.
 *
 * Only one link shows at a time, and it shows whatever its count is — a zero is
 * information too ("nobody's inquired yet"), and a link that appears only once
 * it's populated makes the card's shape jump around mid-demo. Returns null when
 * the stage offers no link at all.
 */
function dealQuickLink(status: Listing["status"]): "documents" | "leads" | null {
  switch (status) {
    case "proposal":
      return "documents";
    case "active":
      return "leads";
    case "under-contract":
    case "closed":
    case "inactive":
      return null;
  }
}

/**
 * A contact's linked deal, rendered per the Figma structure:
 * 1. high-level info (thumbnail, name, projected rev · sqft · started date),
 * 2. meta chips (stage chip, side, property type),
 * 3. a conditionally-visible quick link (Documents or Leads — see dealQuickLink),
 * 4. a conditionally-visible AI next action (e.g. "Build Underwriting").
 *
 * The whole card navigates to the deal on a plain click; interactive controls
 * (stage chip, ⋮ menu, quick link, AI action) are excluded via the shared guard.
 */
export function ContactDealCard({
  listingId,
  highlight = false,
}: {
  listingId: string;
  /** Briefly spotlight the card (just-created deal) — plays once on mount/flip. */
  highlight?: boolean;
}) {
  const navigate = useNavigate();
  // Reactive so a committed stage transition (via the shared gate) re-renders
  // the card with the new status immediately.
  const listing = useDataStore((s) => s.listings.get(listingId));
  // Leads are counted off the contacts map, so subscribe to it too — otherwise
  // leads that land after activation (see rosaLeads.ts) wouldn't surface the
  // Leads quick link until something else re-rendered the card.
  useDataStore((s) => s.contacts);
  // Bring the spotlit card into view (the overview column scrolls).
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (highlight) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [highlight]);
  // The Cactus underwriting setup dialog, hosted here so "Build Underwriting"
  // starts the flow right from the contact page.
  const [setupOpen, setSetupOpen] = useState(false);
  // Whether the BOV email has gone out this session — a logged email carrying
  // an attachment linked to this deal (the sent BOV pdf).
  const bovSent = useContactSession((s) =>
    Object.values(s.logged).some((activities) =>
      activities.some((a) =>
        a.attachments?.some((att) => att.dealId === listingId),
      ),
    ),
  );
  if (!listing) return null;

  /**
   * Kick off the Cactus run with the chosen strategy/depth — the BOV flow
   * (see ContactBovFlow) plays the generation, save, preview, and email steps
   * in modals right here on the contact page. The underwriting record is
   * written first so the deal page's planner row agrees on the run's state.
   */
  const startUnderwriting = (
    strategy: UnderwritingStrategyId,
    selection: Set<number>,
  ) => {
    updateListingUnderwriting(listingId, {
      ...underwritingFromSelection(strategy, selection),
      status: "generating",
    });
    useBovFlow.getState().start(listingId, strategy, [...selection]);
  };

  const property = getProperty(listing.propertyId);
  const price = dealHeadlineLabel(listing);
  const sqft = `${(listing.marketing.availableSqFt ?? 0).toLocaleString()} SF`;
  const side = SIDE_DISPLAY[listing.dealSide];

  // Both counts are taken the same way the page behind the link takes them, so
  // a badge and the page it opens can't disagree. For documents that means
  // AI-generated only: `listing.documents` also holds the broker's own uploads,
  // but those live on the Files page, not Documents (see PropertyDetailDocuments
  // and DealContextRail, which split the same array the other way).
  const quickLink = dealQuickLink(listing.status);
  const docsCount = (listing.documents ?? []).filter((d) => d.aiGenerated).length;
  const leadsCount =
    quickLink === "leads" ? getLeadsForProperty(listing.propertyId).length : 0;
  const nextAction = dealNextAction(listing, bovSent);

  return (
    <div
      ref={cardRef}
      className={`contact-deal-card position-relative bg-card border d-flex flex-column gap-3 p-3${
        highlight ? " contact-deal-card--spotlight" : ""
      }`}
      onClick={(e) => {
        if (shouldIgnoreRowClick(e)) return;
        void navigate(dealCardLinkProps(listing));
      }}
    >
      {/* Actions menu */}
      <div className="position-absolute" style={{ top: 6, right: 6 }}>
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Deal actions">
                <FontAwesomeIcon
                  icon={faEllipsisVertical}
                  className="text-muted"
                />
              </Button>
            }
          />
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item
              onClick={() => void navigate(dealCardLinkProps(listing))}
            >
              Open deal
            </DropdownMenu.Item>
            <DropdownMenu.Item>Edit</DropdownMenu.Item>
            <DropdownMenu.Item>Remove link</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>

      {/* High-level info */}
      <div className="d-flex align-items-center gap-3" style={{ paddingRight: 24 }}>
        <img
          src={getPhotoUrl(listing.id)}
          alt=""
          className="flex-shrink-0"
          style={{
            width: 48,
            height: 48,
            objectFit: "cover",
            borderRadius: 6,
          }}
        />
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div
            className="fw-semibold text-truncate"
            style={{ fontSize: 17, lineHeight: "26px" }}
            title={listing.name}
          >
            {listing.name}
          </div>
          <div
            className="text-muted text-truncate"
            style={{ fontSize: 14, lineHeight: "19px" }}
          >
            {price} · {sqft} · started {medDate(listing.createdAt)}
          </div>
        </div>
      </div>

      {/* Meta chips */}
      <div className="d-flex flex-wrap align-items-center gap-2">
        {/* `addSpaceToDeal` copies the parent's seller contacts onto every child,
            so a landlord's contact page lists the shell AND each space. Without
            the shape the chip would default to "sale" and offer both a full
            ladder to a shell and "Pitching" where a space reads "Inactive". */}
        <DealStageChip
          value={listing.status}
          shape={dealShape(listing)}
          onChange={(next) => requestStageChange(listing.id, next)}
          size="sm"
        />
        <Badge
          variant="secondary"
          appearance="muted"
          className="d-inline-flex align-items-center fw-semibold"
          style={{
            height: 20,
            padding: "0 4px",
            fontSize: 14,
            backgroundColor: "#eceef2",
          }}
        >
          {side.label}
        </Badge>
        {property && (
          <Badge
            variant="secondary"
            appearance="muted"
            className="d-inline-flex align-items-center gap-1 fw-semibold"
            style={{
              height: 20,
              padding: "0 4px",
              fontSize: 14,
              backgroundColor: "#eceef2",
            }}
          >
            <FontAwesomeIcon icon={TYPE_ICONS[property.propertyType]} />
            {TYPE_LABELS[property.propertyType]}
          </Badge>
        )}
      </div>

      {/* The stage's quick link, count and all — see dealQuickLink. */}
      {quickLink !== null && (
        <div className="border-top d-flex flex-column">
          {quickLink === "documents" ? (
            <ContactLinkButton
              icon={faFile}
              label="Documents"
              count={docsCount}
              onClick={() =>
                void navigate({
                  to: "/listings/$listingId/documents",
                  params: { listingId: buildingSectionListingId(listingId) },
                })
              }
            />
          ) : (
            <ContactLinkButton
              icon={faUserGroup}
              label="Leads"
              count={leadsCount}
              onClick={() =>
                void navigate({
                  to: "/listings/$listingId/leads",
                  params: { listingId: buildingSectionListingId(listingId) },
                })
              }
            />
          )}
        </div>
      )}

      {/* Conditionally-visible AI next action. No run yet → open the Cactus
          setup dialog in place; a generated-but-unsaved run → reopen the save
          step of the contact-page BOV flow; anything else → the deal itself,
          where the planner row shows that run's state (`dealCardLinkProps`, so
          a space lands on its building's roster rather than a page of its own). */}
      {nextAction && (
        <Button
          variant="outline"
          className="contact-deal-card__underwriting-btn w-100"
          onClick={() => {
            if (listing.underwriting == null) setSetupOpen(true);
            else if (listing.underwriting.status === "generated")
              useBovFlow.getState().openPlacement(listingId);
            else void navigate(dealCardLinkProps(listing));
          }}
        >
          <FontAwesomeIcon icon={nextAction.icon} />
          {nextAction.label}
        </Button>
      )}

      <UnderwritingSetupModal
        open={setupOpen}
        onOpenChange={setSetupOpen}
        listing={listing}
        // An owned, in-place building reads as a Value-Add run by default.
        fallbackStrategy="value-add"
        onStart={startUnderwriting}
      />
    </div>
  );
}
