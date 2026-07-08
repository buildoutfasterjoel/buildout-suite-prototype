import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Listing, PropertyStatus } from "#/data/types";
import { PROPERTY_STATUSES } from "../properties/propertyDisplay";
import { DealBoardColumn } from "./DealBoardColumn";
import { DealCardView } from "./DealCard";

export function DealBoard({
  listings,
  onRestage,
}: {
  listings: Listing[];
  onRestage: (listingId: string, stage: PropertyStatus) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Small drag threshold so single clicks fall through to the card's <Link>.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byStage = useMemo(() => {
    const map: Record<PropertyStatus, Listing[]> = {
      proposal: [],
      active: [],
      "under-contract": [],
      closed: [],
      inactive: [],
    };
    for (const l of listings) map[l.status]?.push(l);
    return map;
  }, [listings]);

  const active = activeId
    ? (listings.find((l) => l.id === activeId) ?? null)
    : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  // Restage on drop: the target column droppable carries its stage in `data`.
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const listingId = String(e.active.id);
    const overStage = e.over?.data.current?.stage as PropertyStatus | undefined;
    const current = listings.find((l) => l.id === listingId)?.status;
    if (!overStage || !current || current === overStage) return;
    onRestage(listingId, overStage);
  }

  return (
    <DndContext
      id="deal-board-dnd"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="d-flex h-100 overflow-x-auto overflow-y-hidden pb-1" style={{ gap: 12 }}>
        {PROPERTY_STATUSES.map((stage) => (
          <DealBoardColumn key={stage} stage={stage} listings={byStage[stage]} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div style={{ width: 240, cursor: "grabbing" }}>
            <DealCardView listing={active} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
