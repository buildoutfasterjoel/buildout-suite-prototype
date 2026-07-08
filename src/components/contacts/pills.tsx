import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import {
  RELATIONSHIP_DISPLAY,
  SIDE_DISPLAY,
  DEAL_STAGE_DISPLAY,
  LISTING_STATUS_PILL,
} from "#/data/contacts";
import type {
  RelationshipStage,
  DealSide,
  ContactDealStage,
  PropertyStatus,
} from "#/data/types";

/** A soft, borderless status pill colored by Blueprint palette utilities. */
export function Pill({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Badge
      variant="secondary"
      className={`text-nowrap fw-semibold ${className}`}
    >
      {children}
    </Badge>
  );
}

export function RelationshipPill({ value }: { value: RelationshipStage }) {
  const d = RELATIONSHIP_DISPLAY[value];
  return (
    <Pill className={d.pillClass}>
      <span className="d-inline-flex align-items-center gap-1">
        <span
          className={`rounded-circle d-inline-block ${d.dotClass}`}
          style={{ width: 6, height: 6 }}
          aria-hidden="true"
        />
        {d.label}
      </span>
    </Pill>
  );
}

export function SidePill({ value }: { value: DealSide }) {
  const d = SIDE_DISPLAY[value];
  return <Pill className={d.pillClass}>{d.label}</Pill>;
}

export function DealStagePill({ value }: { value: ContactDealStage }) {
  const d = DEAL_STAGE_DISPLAY[value];
  return <Pill className={d.pillClass}>{d.label}</Pill>;
}

export function ListingStatusPill({ value }: { value: PropertyStatus }) {
  const d = LISTING_STATUS_PILL[value];
  return <Pill className={d.pillClass}>{d.label}</Pill>;
}
