import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardBody, CardHeader, CardTitle } from "@buildoutinc/blueprint-react/ui/Card";
import { getStore } from "#/data/store";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      {
        title: "Buildout Prototypes",
      },
    ],
  }),
});

function Home() {
  // A stable sample listing for the document-editor prototype.
  const sampleListingId = getStore().properties.keys().next().value ?? "";

  return (
    <div className="p-8 container">
      <Card className="shadow">
        <CardBody className="p-6">
          <h1 className="fs-display2 lh-display2 fw-bold">
            Buildout Prototypes
          </h1>
          <p className="fs-large text-muted m-0">
            Start your prompt for a Buildout prototype.
          </p>
        </CardBody>
      </Card>

      <div className="row g-4 mt-2">
        <div className="col-md-4">
          <Link to="/suite" className="text-decoration-none">
            <Card className="shadow-sm h-100">
              <CardHeader>
                <CardTitle>Suite Pipeline Dashboard</CardTitle>
              </CardHeader>
              <CardBody>
                Broker-facing deal lifecycle pipeline with 7 stages, sub-stage
                drilldown, and deal list. Demonstrates the overarching brokerage
                workflow from Prospect through Close &amp; Press.
              </CardBody>
            </Card>
          </Link>
        </div>

        <div className="col-md-4">
          <Link to="/listings" className="text-decoration-none">
            <Card className="shadow-sm h-100">
              <CardHeader>
                <CardTitle>Property Listings</CardTitle>
              </CardHeader>
              <CardBody>
                Browse properties in a grid or interactive map view, with
                search and filters by type, city, and status.
              </CardBody>
            </Card>
          </Link>
        </div>

        <div className="col-md-4">
          <Link to="/email" className="text-decoration-none">
            <Card className="shadow-sm h-100">
              <CardHeader>
                <CardTitle>Email Campaigns</CardTitle>
              </CardHeader>
              <CardBody>
                Email campaign landing page with performance stats, Active /
                Archived tabs, searchable and filterable message list, and
                pagination.
              </CardBody>
            </Card>
          </Link>
        </div>

        <div className="col-md-4">
          <Link
            to="/editor/$listingId"
            params={{ listingId: sampleListingId }}
            className="text-decoration-none"
          >
            <Card className="shadow-sm h-100">
              <CardHeader>
                <CardTitle>Document Editor</CardTitle>
              </CardHeader>
              <CardBody>
                Canva-style editor for building listing PDFs — pages, blocks, a
                contextual style panel, and dynamic data pulled live from a
                listing.
              </CardBody>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
