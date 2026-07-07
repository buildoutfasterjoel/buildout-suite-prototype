import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Listing, PropertyStatus } from "#/data/types";
import { STATUS_LABELS, STATUS_COLORS } from "../properties/propertyDisplay";
import { DealCard } from "./DealCard";

export function DealBoardColumn({
  stage,
  listings,
}: {
  stage: PropertyStatus;
  listings: Listing[];
}) {
  const color = STATUS_COLORS[stage];
  const { setNodeRef, isOver } = useDroppable({ id: stage, data: { stage } });

  return (
    <div
      className="d-flex flex-column h-100"
      style={{ flex: "1 1 0", minWidth: 220 }}
    >
      {/* Column header */}
      <div className="d-flex align-items-center gap-2 px-1 pb-2">
        <span
          className="rounded-circle flex-shrink-0"
          style={{ width: 8, height: 8, backgroundColor: color }}
        />
        <span className="fw-semibold text-truncate" style={{ fontSize: 13 }}>
          {STATUS_LABELS[stage]}
        </span>
        <span className="text-muted ms-auto" style={{ fontSize: 12 }}>
          {listings.length}
        </span>
      </div>

      {/* Droppable body */}
      <div
        ref={setNodeRef}
        className="flex-grow-1 overflow-y-auto overflow-x-hidden rounded d-flex flex-column"
        style={{
          gap: 8,
          padding: 8,
          backgroundColor: isOver
            ? `color-mix(in srgb, ${color} 8%, transparent)`
            : "#f1f5f9",
          border: `1px solid ${isOver ? color : "transparent"}`,
          borderTop: `2px solid ${color}`,
        }}
      >
        <SortableContext
          items={listings.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {listings.map((listing) => (
            <DealCard key={listing.id} listing={listing} />
          ))}
        </SortableContext>
        {listings.length === 0 && (
          <div className="text-muted text-center small py-4">No deals</div>
        )}
      </div>
    </div>
  );
}
