import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { List } from "@buildoutinc/blueprint-react/ui/List";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarCheck,
  faReply,
  faHourglassHalf,
  faArrowTrendDown,
  faCalendarXmark,
  faUserClock,
  faChevronDown,
  faChevronUp,
  faTriangleExclamation,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type {
  ActionItem,
  ActionItemCategory,
  ActionItemUrgency,
} from "./actionItemsData";
import { formatValue } from "./pipelineData";

const URGENCY_COLOR: Record<ActionItemUrgency, string> = {
  critical: "#dc2626",
  high: "#d97706",
  medium: "#6366f1",
};

const CATEGORY_META: Record<
  ActionItemCategory,
  { label: string; icon: IconDefinition; color: string }
> = {
  "closing-soon": {
    label: "Closing soon",
    icon: faCalendarCheck,
    color: "#dc2626",
  },
  "offer-response": {
    label: "Offer response",
    icon: faReply,
    color: "#7c3aed",
  },
  "stalled-deal": {
    label: "Stalled deal",
    icon: faHourglassHalf,
    color: "#d97706",
  },
  "price-reduction": {
    label: "Price reduction",
    icon: faArrowTrendDown,
    color: "#0d9488",
  },
  "listing-expiring": {
    label: "Listing expiring",
    icon: faCalendarXmark,
    color: "#b45309",
  },
  "stale-prospect": {
    label: "Stale prospect",
    icon: faUserClock,
    color: "#6b7280",
  },
};

function ActionItemRow({ item }: { item: ActionItem }) {
  const urgencyColor = URGENCY_COLOR[item.urgency];
  const meta = CATEGORY_META[item.category];

  return (
    <List.Item
      asAction
      style={{ borderLeft: `3px solid ${urgencyColor}`, paddingLeft: 0 }}
    >
      <List.ItemContent className="ps-3 flex-fill">
        <List.ItemTitle className="fw-semibold">
          {item.propertyName}
        </List.ItemTitle>
        <List.ItemDescription>{item.detail}</List.ItemDescription>
        <div className="d-flex align-items-center gap-2 mt-2">
          <span
            className="d-flex align-items-center gap-1 fs-xs fw-medium"
            style={{ color: meta.color, whiteSpace: "nowrap" }}
          >
            <FontAwesomeIcon icon={meta.icon} />
            {meta.label}
          </span>
          {item.daysOverdue > 0 && (
            <Badge variant="secondary" appearance="muted" className="fs-xs">
              {item.daysOverdue}d overdue
            </Badge>
          )}
          <span className="ms-auto fw-semibold fs-xs">
            {formatValue(item.askingPrice)}
          </span>
          <Button variant="ghost" size="sm">
            {item.ctaLabel}
          </Button>
        </div>
      </List.ItemContent>
    </List.Item>
  );
}

interface NeedsAttentionSectionProps {
  items: ActionItem[];
  defaultVisibleCount?: number;
}

export function NeedsAttentionSection({
  items,
  defaultVisibleCount = 5,
}: NeedsAttentionSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleItems = expanded ? items : items.slice(0, defaultVisibleCount);
  const hiddenCount = items.length - defaultVisibleCount;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="d-flex align-items-center gap-2">
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            style={{ color: "#dc2626" }}
          />
          <CardTitle className="mb-0">Needs Attention</CardTitle>
          <Badge variant="secondary" appearance="muted" className="fs-xs ms-1">
            {items.length}
          </Badge>
        </div>
      </CardHeader>

      <CardBody className="p-0">
        <List flush>
          {visibleItems.map((item) => (
            <ActionItemRow key={item.id} item={item} />
          ))}
        </List>

        {hiddenCount > 0 && (
          <div className="border-top d-flex justify-content-center py-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted"
              onClick={() => setExpanded((prev) => !prev)}
            >
              <FontAwesomeIcon
                icon={expanded ? faChevronUp : faChevronDown}
                className="me-1"
              />
              {expanded ? "Show less" : `Show ${hiddenCount} more`}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
