import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Calendar } from "@buildoutinc/blueprint-react/ui/Calendar";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { faCalendar, faDollarSign } from "@fortawesome/pro-regular-svg-icons";
import { DATE_FORMAT, parseDate, toISODate } from "#/lib/isoDate";
import {
	contactOptionsFor,
	type ContactOption,
	type ContactOptionGroup,
} from "#/data/store";
import { ContactPicker } from "./ContactPicker";

/**
 * A due date, picked from a Blueprint Calendar.
 *
 * Shared by this modal and the Receivables table's own date cell, so the two
 * cannot drift into different date controls on one page. The value is carried
 * as a `yyyy-mm-dd` string — what `FinancialReceivable.dueDate` stores — and
 * `parseDate`/`toISODate` from the record-form widgets do the conversion, which
 * keeps the "no timezone drift" handling in one place rather than two.
 */
export function DueDatePicker({
	value,
	onChange,
	style,
	className,
}: {
	value: string;
	onChange: (next: string) => void;
	style?: React.CSSProperties;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const selected = parseDate(value || null);
	return (
		<InputGroup style={style} className={className}>
			<InputGroup.Addon>
				<Popover open={open} onOpenChange={setOpen}>
					<Popover.Trigger
						nativeButton={false}
						aria-label="Open date picker"
						render={<FontAwesomeIcon icon={faCalendar} />}
					/>
					<Popover.Content className="p-0" align="start">
						<Calendar
							mode="single"
							selected={selected}
							defaultMonth={selected}
							onSelect={(d) => {
								onChange(d ? toISODate(d) : "");
								setOpen(false);
							}}
						/>
					</Popover.Content>
				</Popover>
			</InputGroup.Addon>
			<Input
				type="text"
				readOnly
				placeholder="Pick a date"
				aria-label="Due date"
				value={selected ? selected.toLocaleDateString(undefined, DATE_FORMAT) : ""}
			/>
		</InputGroup>
	);
}

export interface NewReceivableInput {
	payerContactId: string;
	billToCompany: boolean;
	dueDate: string;
	billingDescription: string;
	amount: number;
}

/**
 * Bill a new line on the voucher — the Add Receivable action.
 *
 * Four fields, and only the payer is required. A receivable is often opened
 * before its amount or due date are known ("we owe them something on this
 * deal"), so requiring the rest would push the broker into typing placeholder
 * numbers that then read as real ones. Amount defaults to $0.00, which the
 * Receivables table already renders honestly.
 *
 * The payer list is NOT the whole contact book. A receivable can only be billed
 * to someone already answering for this deal: a payer the voucher lists, or the
 * buyer/tenant acquiring. Anyone else is a contact who has no part in it, and
 * offering four hundred of them turns a two-name question into a search.
 *
 * The acquiring party is offered because it is how the first receivable gets
 * billed — a new voucher has no payers at all, and the buyer is who pays.
 * Choosing them adds them to the Billing section (see `addReceivable`), so the
 * two lists agree from the moment the line exists rather than after a separate
 * Add Payer.
 *
 * One entry per person, not two. Whether the invoice carries their name or
 * their company is the row's own dropdown once the line exists — see
 * `billToCompany` — not a second thing to answer while creating it.
 */
export function NewReceivableModal({
	open,
	onOpenChange,
	payerIds,
	party,
	onAdd,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The voucher's payers — the first and likeliest group. */
	payerIds: string[];
	/** Who is acquiring, and what they are called: "Buyer" on a sale, "Tenant" on a lease. */
	party: { label: string; ids: string[] };
	onAdd: (input: NewReceivableInput) => void;
}) {
	const [payer, setPayer] = useState<ContactOption | null>(null);
	const [payerQuery, setPayerQuery] = useState("");
	const [dueDate, setDueDate] = useState("");
	const [amount, setAmount] = useState("");
	const [description, setDescription] = useState("");

	// A fresh form every time it opens — a half-filled one left over from a
	// cancelled add would be an odd thing to reopen into.
	useEffect(() => {
		if (open) {
			setPayer(null);
			setPayerQuery("");
			setDueDate("");
			setAmount("");
			setDescription("");
		}
	}, [open]);

	// Read in the render body, not memoized, so reopening the modal picks up a
	// payer added since — the same reason `AddContactModal` calls its source
	// directly.
	const payers = contactOptionsFor(payerIds);
	// A buyer who is already a payer belongs to the first group only: one contact
	// listed twice in one dropdown reads as two people.
	const payerSet = new Set(payerIds);
	const acquiring = contactOptionsFor(party.ids).filter(
		(o) => !payerSet.has(o.value),
	);
	const groups: ContactOptionGroup[] = [];
	if (payers.length > 0)
		groups.push({ value: "payers", label: "Payers on this voucher", items: payers });
	if (acquiring.length > 0)
		groups.push({
			value: "party",
			label: `${party.label}s on this deal`,
			items: acquiring,
		});

	const add = () => {
		if (!payer) return;
		onAdd({
			payerContactId: payer.value,
			// Billed to the person by default. Switching a line to their company is
			// the row's own dropdown — a question about this receivable, asked once
			// it exists, not a second thing to answer while creating it.
			billToCompany: false,
			dueDate,
			billingDescription: description,
			// An empty box means zero, not NaN — the field starts blank rather than
			// pre-filled with "0" so the broker sees an empty form, not a form
			// already answered.
			amount: Number.parseFloat(amount) || 0,
		});
		onOpenChange(false);
	};

	return (
		<Modal open={open} onOpenChange={onOpenChange}>
			<Modal.Content centered style={{ maxWidth: "34rem" }}>
				<Modal.Header>
					<Modal.Title>New Receivable</Modal.Title>
				</Modal.Header>

				<Modal.Body className="d-flex flex-column gap-4">
					<Field>
						<Field.Label>Payer</Field.Label>
						{/* The same picker the party sections use, over the two groups
						    above. */}
						<ContactPicker
							groups={groups}
							value={payer}
							onChange={setPayer}
							query={payerQuery}
							onQueryChange={setPayerQuery}
							labelSingleGroup
							emptyMessage={
								groups.length === 0
									? `Add a ${party.label.toLowerCase()} or a payer to this voucher first.`
									: "No matching contacts"
							}
						/>
					</Field>

					<Field>
						<Field.Label>Due Date</Field.Label>
						{/* The documented InputGroup + Calendar composition — a read-only
						    Input with a calendar-icon Popover trigger in an addon. A native
						    `<input type="date">` renders its own `mm/dd/yyyy` chrome, which
						    is not this design system's and reads as unfinished beside the
						    Blueprint controls around it. */}
						<DueDatePicker
							value={dueDate}
							onChange={setDueDate}
							style={{ maxWidth: "14rem" }}
						/>
					</Field>

					<Field>
						<Field.Label>Receivable Amount</Field.Label>
						<InputGroup>
							<InputGroup.Addon>
								<FontAwesomeIcon icon={faDollarSign} />
							</InputGroup.Addon>
							<Input
								type="number"
								step="0.01"
								min="0"
								className="text-end"
								placeholder="0.00"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
							/>
						</InputGroup>
					</Field>

					<Field>
						<Field.Label>Description</Field.Label>
						<Textarea
							rows={4}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</Field>
				</Modal.Body>

				<Modal.Footer>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button variant="primary" onClick={add} disabled={!payer}>
						Add Receivable
					</Button>
				</Modal.Footer>
			</Modal.Content>
		</Modal>
	);
}
