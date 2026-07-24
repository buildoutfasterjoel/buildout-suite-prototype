import type { ReactNode } from "react";
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	faArrowsUpDown,
	faChevronRight,
	faGripDotsVertical,
	faTrashCan,
} from "@fortawesome/pro-regular-svg-icons";

/**
 * A section-header toggle that flips a list between edit (collapsible cards)
 * and re-order (drag-to-sort) modes. Hidden when there's nothing to reorder.
 */
export function ReorderToggle({
	reordering,
	onToggle,
	count,
}: {
	reordering: boolean;
	onToggle: () => void;
	count: number;
}) {
	if (count < 2) return null;
	return (
		<Button
			variant={reordering ? "primary" : "ghost"}
			size="sm"
			onClick={onToggle}
		>
			<FontAwesomeIcon icon={faArrowsUpDown} />
			{reordering ? "Done" : "Re-Order"}
		</Button>
	);
}

/** One draggable row in re-order mode — a grip handle (the only drag activator) + a label. */
function SortableRow({ id, children }: { id: string; children: ReactNode }) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id });
	return (
		<div
			ref={setNodeRef}
			className="d-flex align-items-center gap-2 border rounded p-2 bg-card"
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				opacity: isDragging ? 0.5 : 1,
				borderRadius: 6,
			}}
		>
			<button
				ref={setActivatorNodeRef}
				type="button"
				aria-label="Drag to reorder"
				className="border-0 bg-transparent text-muted p-1"
				style={{ cursor: "grab" }}
				{...attributes}
				{...listeners}
			>
				<FontAwesomeIcon icon={faGripDotsVertical} />
			</button>
			{children}
		</div>
	);
}

/**
 * One collapsible card — header row (toggle trigger + optional delete) over a
 * hidden panel. Reusable for any independently-collapsing list card; when
 * `onRemove` is omitted the header shows only the trigger (e.g. lease spaces,
 * whose cards mirror fixed property units).
 */
export function CollapsibleCard<T extends { id: string }>({
	item,
	index = 0,
	onRemove,
	removeLabel = "Remove",
	renderTrigger,
	renderContent,
}: {
	item: T;
	index?: number;
	onRemove?: (id: string) => void;
	removeLabel?: string;
	renderTrigger: (item: T, index: number) => ReactNode;
	renderContent: (item: T, index: number) => ReactNode;
}) {
	return (
		<Collapsible
			defaultOpen={false}
			className="border rounded"
			style={{ borderRadius: 6 }}
		>
			<div className="d-flex align-items-center">
				<Collapsible.Trigger className="collapsible-card-trigger btn border-0 bg-transparent text-start flex-grow-1 d-flex align-items-center justify-content-start gap-2 px-3 py-2">
					<FontAwesomeIcon
						icon={faChevronRight}
						className="text-muted collapsible-card-chevron"
					/>
					{renderTrigger(item, index)}
				</Collapsible.Trigger>
				{onRemove && (
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={removeLabel}
						className="me-2 flex-shrink-0"
						onClick={() => onRemove(item.id)}
					>
						<FontAwesomeIcon icon={faTrashCan} />
					</Button>
				)}
			</div>
			<Collapsible.Content>
				<div className="d-flex flex-column gap-3 px-3 pb-3">
					{renderContent(item, index)}
				</div>
			</Collapsible.Content>
		</Collapsible>
	);
}

/**
 * A list of records rendered either as independently-collapsing cards (edit
 * mode) or a drag-to-sort list of collapsed rows (re-order mode, driven by the
 * {@link ReorderToggle} in the section header). Reordering commits through
 * `onReorder`; per-item removal is a one-click affordance on each card's header.
 */
export function ReorderableAccordion<T extends { id: string }>({
	items,
	reordering,
	onReorder,
	onRemove,
	removeLabel = "Remove",
	renderTrigger,
	renderContent,
}: {
	items: T[];
	reordering: boolean;
	onReorder: (next: T[]) => void;
	onRemove?: (id: string) => void;
	removeLabel?: string;
	renderTrigger: (item: T, index: number) => ReactNode;
	renderContent: (item: T, index: number) => ReactNode;
}) {
	// A small drag distance keeps a click on the handle from starting a drag.
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
	);

	if (reordering) {
		const onDragEnd = (e: DragEndEvent) => {
			const { active, over } = e;
			if (!over || active.id === over.id) return;
			const from = items.findIndex((it) => it.id === active.id);
			const to = items.findIndex((it) => it.id === over.id);
			if (from === -1 || to === -1) return;
			onReorder(arrayMove(items, from, to));
		};
		return (
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={onDragEnd}
			>
				<SortableContext
					items={items.map((it) => it.id)}
					strategy={verticalListSortingStrategy}
				>
					<div className="d-flex flex-column gap-2">
						{items.map((item, i) => (
							<SortableRow key={item.id} id={item.id}>
								{renderTrigger(item, i)}
							</SortableRow>
						))}
					</div>
				</SortableContext>
			</DndContext>
		);
	}

	return (
		<div className="d-flex flex-column gap-2">
			{items.map((item, i) => (
				<CollapsibleCard
					key={item.id}
					item={item}
					index={i}
					onRemove={onRemove}
					removeLabel={removeLabel}
					renderTrigger={renderTrigger}
					renderContent={renderContent}
				/>
			))}
		</div>
	);
}
