import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { List } from "@buildoutinc/blueprint-react/ui/List";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faNoteSticky, faPhone } from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { RECENT_ACTIVITY, type ActivityItem } from "./dashboardData";

const KIND_ICON: Record<ActivityItem["kind"], IconDefinition> = {
  note: faNoteSticky,
  call: faPhone,
};

const KIND_COLOR: Record<ActivityItem["kind"], string> = {
  note: "bg-buildout-blue-500",
  call: "bg-storm-grey-400",
};

/** "Jul 5 · 12:47 PM" — omits the year, unlike `formatDateTime`. */
function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <List.Item>
      <span
        className={`rounded-circle d-inline-flex align-items-center justify-content-center text-white flex-shrink-0 ${KIND_COLOR[item.kind]}`}
        style={{ width: 32, height: 32 }}
      >
        <FontAwesomeIcon icon={KIND_ICON[item.kind]} />
      </span>
      <List.ItemContent className="ps-3 flex-fill">
        <List.ItemTitle className="fw-semibold">{item.title}</List.ItemTitle>
        {item.preview && <List.ItemDescription>{item.preview}</List.ItemDescription>}
      </List.ItemContent>
      <List.ItemActions>
        <span className="text-muted fs-xs text-nowrap">
          {formatActivityTime(item.timestamp)}
        </span>
      </List.ItemActions>
    </List.Item>
  );
}

export function RecentActivitySection() {
  return (
    <Card className="shadow-sm">
      <Card.Header>
        <Card.Title className="fs-large">Recent activity</Card.Title>
      </Card.Header>

      <CardBody className="p-0">
        <List flush>
          {RECENT_ACTIVITY.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </List>
      </CardBody>
    </Card>
  );
}
