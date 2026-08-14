/**
 * A repeatable grid of rows with add/remove — Unit Mix, Rent Roll, income and
 * expense line items.
 *
 * Reach for this only when the repeater is read DOWN a column: either many rows
 * whose values get compared to each other, or a column that carries a total —
 * a total is read downward at any row count, which is why the income and expense
 * line items are tables at one and two rows. Without one, a handful of rows does
 * not earn a header row: see `AdditionalTypesEditor` in PropertySection.tsx,
 * which carries two fields per row and stays stacked flex on purpose.
 */
import type { ReactNode } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrashCan } from "@fortawesome/pro-regular-svg-icons";

// ── Column model ─────────────────────────────────────────────────────────────
export type ColKind = "text" | "number" | "date";
export type Column<T> = { key: keyof T; label: string; kind: ColKind };

// ── Generic editable table (repeatable rows, add/remove) ─────────────────────
export function EditableTable<T extends { id: string }>({
	columns,
	rows,
	onEdit,
	onAdd,
	onRemove,
	addLabel,
	emptyLabel,
	footer,
	className,
}: {
	columns: Column<T>[];
	rows: T[];
	onEdit: (id: string, patch: Partial<T>) => void;
	onAdd: () => void;
	onRemove: (id: string) => void;
	addLabel: string;
	emptyLabel: string;
	/** Rendered as a table footer row spanning the value columns. */
	footer?: ReactNode;
	/** Extra classes on the `<table>`. A WIDE grid passes
	 *  `record-form__grid-table` for its 640px floor; a narrow one passes nothing,
	 *  because that floor inside a cluster column would push its last columns off
	 *  behind a scrollbar. */
	className?: string;
}) {
	return (
		<div className="d-flex flex-column gap-2">
			{/* `dense` is Blueprint's `table-sm`, and the root's own `.table-container`
			    supplies the overflow, border, and radius — all three were hand-rolled
			    here before. Header cells inherit `.table th` from the theme, so the
			    muted/semibold/13px overrides they used to carry are gone too. */}
			<Table dense className={`align-middle mb-0 ${className ?? ""}`}>
				<Table.Header>
					<Table.Row>
						{columns.map((c) => (
							<Table.Head key={String(c.key)}>{c.label}</Table.Head>
						))}
						{/* Remove-button column — labelled by each row's own button. */}
						<Table.Head style={{ width: 44 }} />
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{rows.length === 0 ? (
						<Table.Row>
							<Table.Cell colSpan={columns.length + 1} className="text-muted">
								{emptyLabel}
							</Table.Cell>
						</Table.Row>
					) : (
						rows.map((row) => (
							<Table.Row key={row.id}>
								{columns.map((c) => {
									const raw = row[c.key] as string | number | null | undefined;
									return (
										<Table.Cell key={String(c.key)}>
											{c.kind === "text" ? (
												<Input
													style={{ minWidth: 140 }}
													value={(raw as string | null) ?? ""}
													onChange={(e) =>
														onEdit(row.id, { [c.key]: e.target.value } as Partial<T>)
													}
												/>
											) : c.kind === "date" ? (
												<Input
													type="date"
													style={{ minWidth: 150 }}
													value={(raw as string | null) ?? ""}
													onChange={(e) =>
														onEdit(row.id, {
															[c.key]: e.target.value === "" ? null : e.target.value,
														} as Partial<T>)
													}
												/>
											) : (
												<Input
													type="number"
													style={{ minWidth: 110 }}
													value={(raw as number | null) ?? ""}
													onChange={(e) =>
														onEdit(row.id, {
															[c.key]:
																e.target.value === "" ? null : Number(e.target.value),
														} as Partial<T>)
													}
												/>
											)}
										</Table.Cell>
									);
								})}
								<Table.Cell>
									<Button
										variant="ghost"
										size="icon"
										aria-label="Remove row"
										onClick={() => onRemove(row.id)}
									>
										<FontAwesomeIcon icon={faTrashCan} />
									</Button>
								</Table.Cell>
							</Table.Row>
						))
					)}
				</Table.Body>
				{footer && (
					<Table.Footer>
						<Table.Row>
							<Table.Cell colSpan={columns.length + 1}>{footer}</Table.Cell>
						</Table.Row>
					</Table.Footer>
				)}
			</Table>
			<div>
				<Button variant="ghost" size="sm" onClick={onAdd}>
					<FontAwesomeIcon icon={faPlus} />
					{addLabel}
				</Button>
			</div>
		</div>
	);
}
