import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBuildingCircleExclamation } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { usePropertyDetail } from "#/components/properties/usePropertyDetail";
import { PropertyRecordHeader } from "#/components/properties/PropertyRecordHeader";
import { PropertyRecordTabs } from "#/components/properties/PropertyRecordTabs";
import { PropertyRecordRail } from "#/components/properties/PropertyRecordRail";
import { propertySectionLabel } from "#/components/properties/propertyNav";

/**
 * The Property record's layout: top rail, then a main card whose sections are
 * underline tabs across its top (Overview · Spaces) with the section beneath,
 * and a right rail of collapsible Deals / Contacts / Comps that stays put
 * whichever tab is showing. The shape Buildout's own property page uses, not the
 * deal shell's side nav — two sections do not earn a sidebar.
 *
 * The space asset page (`$propertyId_/spaces/$unitId`) is deliberately *not*
 * nested here: the trailing underscore keeps its URL under the property while
 * escaping this layout, so it paints its own header rather than a second one
 * inside this frame.
 */
export const Route = createFileRoute("/_shell/properties/$propertyId")({
  component: PropertyRecordLayout,
  head: ({ params }) => {
    const property = getStore().properties.get(params.propertyId);
    return { meta: [{ title: `${property?.name ?? "Property"} | Buildout Suite` }] };
  },
});

function PropertyNotFound() {
  return (
    <div className="container py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={faBuildingCircleExclamation} aria-label="Property not found" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Property not found</Empty.Title>
          We couldn&apos;t find that property. It may have been removed, or the link is incorrect.
        </Empty.Content>
        <Empty.Actions>
          <Button variant="primary" nativeButton={false} render={<Link to="/properties" />}>
            Back to Properties
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

function PropertyRecordLayout() {
  const { propertyId } = Route.useParams();
  const detail = usePropertyDetail(propertyId);
  // Hoisted above the not-found guard: hooks can't be called conditionally.
  const { pathname } = useLocation();
  if (!detail) return <PropertyNotFound />;

  const sectionLabel = propertySectionLabel(pathname, propertyId);

  return (
    <div className="h-100 overflow-y-auto overflow-x-hidden">
      <PropertyRecordHeader
        property={detail.property}
        deals={detail.deals}
        availability={detail.availability}
        sectionLabel={sectionLabel}
      />

      <div className="container d-flex align-items-start gap-4 py-4">
        {/* `panel-card`: the 12px corners and elevation the Contact Details and
            Contacts page cards share. `overflow-hidden` keeps the flush tab strip
            and the rail's accordion inside the rounded corners. */}
        <Card className="flex-grow-1 panel-card overflow-hidden" style={{ minWidth: 0 }}>
          <PropertyRecordTabs
            propertyId={propertyId}
            activeLabel={sectionLabel}
            counts={{ Spaces: detail.availability?.spaceCount ?? 0 }}
          />
          <Outlet />
        </Card>

        {/* The same 380px the contact page gives its side columns. */}
        <Card className="panel-card overflow-hidden flex-shrink-0 d-none d-xl-block" style={{ width: 380 }}>
          <PropertyRecordRail
            property={detail.property}
            deals={detail.deals}
            comps={detail.comps}
          />
        </Card>
      </div>
    </div>
  );
}
