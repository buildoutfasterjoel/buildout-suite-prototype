import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { List } from "@buildoutinc/blueprint-react/ui/List";
import { Placeholder } from "@buildoutinc/blueprint-react/ui/Placeholder";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faFaceSadSweat } from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import { hash } from "./propertyDisplay";

const ACTIVITY = [
  { title: "Property Viewing", date: "12/31/2023" },
  { title: "Open House Tour", date: "11/30/2023" },
  { title: "Virtual Property Walkthrough", date: "10/31/2023" },
  { title: "Home Inspection", date: "09/30/2023" },
  { title: "Real Estate Showcase", date: "08/31/2023" },
  { title: "Neighborhood Exploration", date: "07/31/2023" },
];

function StatTile({
  label,
  value,
  chipBg,
  chipColor,
}: {
  label: string;
  value: number;
  chipBg: string;
  chipColor: string;
}) {
  return (
    <Card>
      <Card.Body className="d-flex align-items-center gap-3">
        <span className="fw-semibold fs-large flex-grow-1">{label}</span>
        <div
          className="rounded d-flex align-items-center justify-content-center px-2 py-2"
          style={{ background: chipBg, minWidth: 120 }}
        >
          <span className="fw-bold" style={{ fontSize: 35, color: chipColor }}>
            {value.toLocaleString()}
          </span>
        </div>
      </Card.Body>
    </Card>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-100">
      <Card.Body className="d-flex flex-column gap-3">
        <span className="fw-semibold fs-large">{title}</span>
        {children}
      </Card.Body>
    </Card>
  );
}

/** "Dashboard" tab content for the property detail page. */
export function PropertyDetailDashboard({ property }: { property: Property }) {
  const seed = hash(property.id);
  const daysOnMarket = 100 + (seed % 900);
  const leadsCreated = 20 + (seed % 680);

  return (
    <div
      className="d-flex flex-column gap-4 p-4 flex-grow-1"
      style={{ minWidth: 0 }}
    >
      {/* Heading */}
      <div className="d-flex align-items-center gap-3">
        <h2 className="fs-4 mb-0 flex-grow-1">Dashboard</h2>
        <Button variant="outline">
          <FontAwesomeIcon icon={faDownload} />
          Download PDF
        </Button>
      </div>

      {/* Columns */}
      <div className="d-flex flex-column flex-xl-row gap-4 align-items-stretch">
        {/* Small column */}
        <div
          className="d-flex flex-column gap-4 flex-shrink-0"
          style={{ width: "100%", maxWidth: 360 }}
        >
          <StatTile
            label="Total Days On Market"
            value={daysOnMarket}
            chipBg="#e7d5ff"
            chipColor="#360764"
          />
          <StatTile
            label="Leads Created"
            value={leadsCreated}
            chipBg="#c0dcfd"
            chipColor="#22262f"
          />
          <Card>
            <Card.Body className="d-flex flex-column gap-2">
              <span className="fw-semibold fs-large">Email</span>
              <Empty variant="inline" className="border border-dashed rounded py-4">
                <Empty.Media>
                  <FontAwesomeIcon
                    icon={faFaceSadSweat}
                    aria-label="No data"
                    className="text-primary"
                  />
                </Empty.Media>
                <Empty.Content>
                  <Empty.Title>No Data Available</Empty.Title>
                  There&apos;s no data currently available for this module. Please
                  check again later.
                </Empty.Content>
              </Empty>
            </Card.Body>
          </Card>
        </div>

        {/* Main column */}
        <div
          className="d-flex flex-column gap-4 flex-grow-1"
          style={{ minWidth: 0 }}
        >
          <ChartCard title="Top Referral Sources">
            <Placeholder
              className="w-100 rounded"
              style={{ height: 160 }}
              aria-label="Bar chart placeholder"
            />
          </ChartCard>

          <div className="d-flex flex-column flex-md-row gap-4 align-items-stretch">
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <Card className="h-100">
                <Card.Body className="d-flex flex-column gap-3">
                  <span className="fw-semibold fs-large">Activity</span>
                  <List>
                    {ACTIVITY.map((a) => (
                      <List.Item key={a.title}>
                        <List.ItemContent>
                          <List.ItemTitle>{a.title}</List.ItemTitle>
                        </List.ItemContent>
                        <List.ItemActions>
                          <span className="text-muted fs-small">{a.date}</span>
                        </List.ItemActions>
                      </List.Item>
                    ))}
                  </List>
                </Card.Body>
              </Card>
            </div>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <ChartCard title="Document Clicks">
                <div className="d-flex align-items-center justify-content-center flex-grow-1 py-3">
                  <Placeholder
                    className="rounded-circle"
                    style={{ width: 160, height: 160 }}
                    aria-label="Donut chart placeholder"
                  />
                </div>
              </ChartCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
