import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDownload,
  faGear,
  faChartLine,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { getListingTraffic } from "#/data/listingTraffic";
import { ListingPageHeader } from "./ListingPageHeader";
import { KpiTile, Section } from "./listingWidgets";
import { WebsiteSiteSettings } from "./WebsiteSiteSettings";
import { WebsiteActivityLog } from "./WebsiteActivityLog";

const TRAFFIC_COLOR = "#8833ea";

/** Marketing-site page for a listing: site settings and traffic analytics, split into tabs. */
export function ListingWebsite({ listing }: { listing: Listing }) {
  const traffic = getListingTraffic(listing.id);

  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader
        title="Website"
        actions={
          <Button variant="outline">
            <FontAwesomeIcon icon={faDownload} />
            Download PDF
          </Button>
        }
      />

      <Tabs defaultValue="analytics">
        <Tabs.List>
          <Tabs.Tab
            value="analytics"
            icon={<FontAwesomeIcon icon={faChartLine} />}
          >
            Analytics
          </Tabs.Tab>
          <Tabs.Tab value="settings" icon={<FontAwesomeIcon icon={faGear} />}>
            Settings
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Content>
          <Tabs.Panel value="analytics" className="pt-4">
            <div className="d-flex flex-column gap-5">
              {/* Traffic KPIs */}
              <div className="row g-3">
                <div className="col-6 col-md">
                  <KpiTile
                    label="Page Views (30d)"
                    value={traffic.pageViews}
                    delta={traffic.changePct}
                  />
                </div>
                <div className="col-6 col-md">
                  <KpiTile
                    label="Unique Visitors"
                    value={traffic.uniqueVisitors}
                  />
                </div>
                <div className="col-6 col-md">
                  <KpiTile label="Leads" value={traffic.leads} />
                </div>
              </div>

              {/* Website traffic chart */}
              <Section title="Website Traffic">
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={traffic.series}
                      margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                    >
                      <defs>
                        <linearGradient
                          id="trafficFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={TRAFFIC_COLOR}
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor={TRAFFIC_COLOR}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} fontSize={12} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <ChartTooltip />
                      <Area
                        type="monotone"
                        dataKey="views"
                        name="Views"
                        stroke={TRAFFIC_COLOR}
                        strokeWidth={2}
                        fill="url(#trafficFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <WebsiteActivityLog listing={listing} />
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="settings" className="pt-4">
            <WebsiteSiteSettings listing={listing} />
          </Tabs.Panel>
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
