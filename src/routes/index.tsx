import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardBody, CardHeader, CardTitle } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSparkles } from "@fortawesome/pro-regular-svg-icons";
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
  const sampleListingId = getStore().listings.keys().next().value ?? "";

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
          <Card className="shadow-sm h-100">
            <CardHeader>
              <CardTitle>
                <FontAwesomeIcon
                  icon={faSparkles}
                  className="text-buildout-blue-700 me-2"
                />
                AI Assistant
              </CardTitle>
            </CardHeader>
            <CardBody>
              A chat assistant available on every page from the right sidebar.
              Streams from Claude and runs tools in the browser against the live
              data — answer questions, navigate, restage deals, draft emails,
              build call lists, and generate client-report summaries.
            </CardBody>
          </Card>
        </div>

        <div className="col-md-4">
          <Link to="/suite" className="text-decoration-none">
            <Card className="shadow-sm h-100">
              <CardHeader>
                <CardTitle>Suite Home Dashboard</CardTitle>
              </CardHeader>
              <CardBody>
                Broker home dashboard — commission forecast, a
                seller-signal-to-close pipeline snapshot, an AI-surfaced focus
                signal, today's tasks, listing engagement, and recent activity.
              </CardBody>
            </Card>
          </Link>
        </div>

        <div className="col-md-4">
          <Link to="/listings" className="text-decoration-none">
            <Card className="shadow-sm h-100">
              <CardHeader>
                <CardTitle>Deals</CardTitle>
              </CardHeader>
              <CardBody>
                Browse deals in a grid or map, then open one unified workspace
                where the listing and its financials live together — overview,
                transaction, planner, contacts, activities, and back-office financials.
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
          <Link to="/backoffice/contacts" className="text-decoration-none">
            <Card className="shadow-sm h-100">
              <CardHeader>
                <CardTitle>People</CardTitle>
              </CardHeader>
              <CardBody>
                CRM relationship directory — a filterable, sortable contact table
                with source, relationship stage, deal side, deal stage, and
                inquiry tracking. Demonstrates the Blueprint table at data density.
              </CardBody>
            </Card>
          </Link>
        </div>

        <div className="col-md-4">
          <Link to="/settings/company" className="text-decoration-none">
            <Card className="shadow-sm h-100">
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
              </CardHeader>
              <CardBody>
                Admin settings shell — a grouped, collapsible section nav beside
                its own content card. Company info and brand styles, plus the
                new roles &amp; permissions model: a users roster, per-user
                effective permissions with Default/Custom attribution, additive
                role assignment, and per-permission overrides.
              </CardBody>
            </Card>
          </Link>
        </div>

        <div className="col-md-4">
          <Link to="/reports/standard" className="text-decoration-none">
            <Card className="shadow-sm h-100">
              <CardHeader>
                <CardTitle>Reports</CardTitle>
              </CardHeader>
              <CardBody>
                Reporting index — the eighteen reports Buildout ships pre-built,
                grouped by the record they read from, beside the custom reports a
                user has saved from their own filters.
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

        <div className="col-md-4">
          <Link to="/changelog" className="text-decoration-none">
            <Card className="shadow-sm h-100">
              <CardHeader>
                <CardTitle>What's New</CardTitle>
              </CardHeader>
              <CardBody>
                The prototype's own changelog — one entry per merged pull
                request, sorted into new features, refinements and fixes, each
                linking back to the PR it came from. Also reachable from the
                account menu in the top right.
              </CardBody>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
