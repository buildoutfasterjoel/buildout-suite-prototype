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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload } from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { getListingTraffic } from "#/data/listingTraffic";
import { ListingPageHeader } from "./ListingPageHeader";
import { KpiTile, SectionCard } from "./listingWidgets";

const TRAFFIC_COLOR = "#8833ea";

/** Marketing-site analytics for a listing: traffic KPIs and the daily views trend. */
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
          <KpiTile label="Unique Visitors" value={traffic.uniqueVisitors} />
        </div>
        <div className="col-6 col-md">
          <KpiTile label="Leads" value={traffic.leads} />
        </div>
      </div>

      {/* Website traffic chart */}
      <SectionCard title="Website Traffic">
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={traffic.series}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            >
              <defs>
                <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TRAFFIC_COLOR} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={TRAFFIC_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} />
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
      </SectionCard>
    </div>
  );
}
