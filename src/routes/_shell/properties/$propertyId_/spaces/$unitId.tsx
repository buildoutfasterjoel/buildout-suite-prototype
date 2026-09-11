import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRight, faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
import { getListing, getStore } from "#/data/store";
import { propertyAvailability } from "#/data/propertySpaces";
import { notify } from "#/lib/notify";
import { useOpenableSpaces } from "#/components/deals/useDealAccess";
import { RecordDetails, type DetailsSection } from "#/components/common/RecordDetails";
import { usePropertySpaceRoute } from "#/components/properties/usePropertySpaceRoute";
import { SpaceRecordHeader } from "#/components/properties/SpaceRecordHeader";
import { SpaceContextRail } from "#/components/properties/SpaceContextRail";
import { CreateSpaceModal } from "#/components/properties/CreateSpaceModal";
import { spaceDetailsSections, spaceLeaseTermsSection } from "#/components/properties/spaceDetails";
import {
  createDealBlockedReason,
  createDealFromSpace,
} from "#/components/properties/createDealFromSpace";

/**
 * A space's asset page — the property-side record for one unit, whether or not
 * anyone has started a deal on it. Distinct from the deal-side space page at
 * `/listings/{shellId}/spaces/{spaceId}`, which is the deal's marketing surface
 * and requires a child deal to exist.
 *
 * The trailing underscore on `$propertyId_` keeps the URL under the property
 * while un-nesting from `$propertyId.tsx`'s layout, so this page paints its own
 * header rather than a second one inside the property's frame — the same
 * mechanism the deal-side space page uses, for the same reason (`c8a84ca`).
 */
export const Route = createFileRoute("/_shell/properties/$propertyId_/spaces/$unitId")({
  head: ({ params }) => {
    const unit = getStore().properties.get(params.propertyId)?.units.find((u) => u.id === params.unitId);
    return { meta: [{ title: `${unit?.label ?? "Space"} | Buildout Suite` }] };
  },
  component: SpaceAssetPage,
});

function SpaceNotFound({ propertyId }: { propertyId: string }) {
  return (
    <div className="container py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={faVectorSquare} aria-label="Space not found" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Space not found</Empty.Title>
          This space is not on this property, or it has been removed.
        </Empty.Content>
        <Empty.Actions>
          <Button
            variant="primary"
            nativeButton={false}
            render={<Link to="/properties/$propertyId/spaces" params={{ propertyId }} />}
          >
            Back to Spaces
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

function SpaceAssetPage() {
  const { propertyId, unitId } = Route.useParams();
  const navigate = useNavigate();
  const record = usePropertySpaceRoute(propertyId, unitId);
  // Hooks before the guard. An empty shell id resolves to an empty set.
  const openable = useOpenableSpaces(record?.row.shellId ?? "");
  const [editOpen, setEditOpen] = useState(false);

  if (!record) return <SpaceNotFound propertyId={propertyId} />;
  const { property, unit, row } = record;
  const deal = row.dealId ? (getListing(row.dealId) ?? null) : null;
  const dealOpenable = deal != null && openable.has(deal.id);
  const availability = propertyAvailability(propertyId);
  const blockedReason = deal ? null : createDealBlockedReason(propertyId);

  // Starts a deal on this space — on the building's lease shell when it has one,
  // through the pre-scoped Create Deal modal when it does not. See the helper.
  const startDeal = () => {
    const outcome = createDealFromSpace(propertyId, unitId);
    if (outcome.kind === "started") {
      notify({ title: `Deal started on ${unit.label}` });
      void navigate({
        to: "/listings/$listingId/spaces/$spaceId/details",
        params: { listingId: outcome.shellId, spaceId: outcome.spaceId },
      });
    }
  };

  // The unit's own facts, then — when a deal exists and this viewer may open it —
  // the deal's terms, read-only, with the way to their one editable home. The
  // terms are the deal's (spec §2.1); this page shows them and points there.
  const sections: DetailsSection[] = [
    ...spaceDetailsSections(unit),
    ...(deal && row.shellId && dealOpenable
      ? [
          spaceLeaseTermsSection(
            deal,
            <Link
              to="/listings/$listingId/spaces/$spaceId/details"
              params={{ listingId: row.shellId, spaceId: deal.id }}
              className="fs-small d-inline-flex align-items-center gap-1"
            >
              Edit on deal
              <FontAwesomeIcon icon={faArrowUpRight} style={{ fontSize: 11 }} />
            </Link>,
          ),
        ]
      : []),
  ];

  return (
    <div className="h-100 overflow-y-auto overflow-x-hidden">
      <SpaceRecordHeader
        property={property}
        unit={unit}
        row={row}
        deal={deal}
        dealOpenable={dealOpenable}
        onEdit={() => setEditOpen(true)}
        onCreateDeal={startDeal}
        createDealBlockedReason={blockedReason}
      />

      <div className="container d-flex align-items-start gap-4 py-4">
        {/* `panel-card`: the same 12px corners and elevation as the property
            page and the Contact Details cards. */}
        <Card className="flex-grow-1 panel-card overflow-hidden" style={{ minWidth: 0 }}>
          <Card.Body className="p-4 d-flex flex-column gap-3">
            <RecordDetails sections={sections} filter={{ label: "Filter Space Details" }} />
            {deal && !dealOpenable && (
              <div className="text-muted fs-small">
                Lease terms are on a deal you don&apos;t have access to.
              </div>
            )}
          </Card.Body>
        </Card>
        <Card className="panel-card overflow-hidden flex-shrink-0 d-none d-xl-block" style={{ width: 380 }}>
          <SpaceContextRail
            property={property}
            unit={unit}
            availability={availability}
            deal={deal}
            dealOpenable={dealOpenable}
            onCreateDeal={blockedReason ? undefined : startDeal}
          />
        </Card>
      </div>

      <CreateSpaceModal propertyId={propertyId} unit={unit} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
