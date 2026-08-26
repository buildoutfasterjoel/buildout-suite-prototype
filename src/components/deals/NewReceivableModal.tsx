import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
	faDollarSign,
	faMagnifyingGlass,
} from "@fortawesome/pro-regular-svg-icons";
import { getAllContacts } from "#/data/store";
import { payerOptions, type PayerOption } from "#/data/vouchers";

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
 * The payer list is every contact in TWO forms — the person, and the company
 * they belong to — because a commission is as often invoiced to an entity as to
 * a person. Both forms name the same contact; see `billToCompany`.
 *
 * Not filtered to the voucher's existing payers. Creating a receivable is how a
 * payer joins the Billing section, so filtering to what is already there would
 * make the first receivable on a voucher impossible to create.
 */
export function NewReceivableModal({
	open,
	onOpenChange,
	onAdd,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAdd: (input: NewReceivableInput) => void;
}) {
	const [payer, setPayer] = useState<PayerOption | null>(null);
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
	// contact added since — the same reason `AddContactModal` calls its source
	// directly.
	const options = payerOptions(getAllContacts());

	const add = () => {
		if (!payer) return;
		onAdd({
			payerContactId: payer.contactId,
			billToCompany: payer.billToCompany,
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
						{/* A Combobox, not a Select: every contact appears twice here —
						    once as themselves and once as their company — so the list is
						    twice the contact book and scrolling it is not a way to find
						    anybody. Typing is. This is also why the selection is held as
						    the option OBJECT rather than its value string: a
						    `PayerOption.value` is a composite key (contact id plus which
						    form), so anything rendering the bare value renders an id. */}
						<Combobox
							items={options}
							value={payer}
							inputValue={payerQuery}
							onInputValueChange={(v: string) => setPayerQuery(v)}
							onValueChange={(v) => {
								const opt = v as PayerOption | null;
								setPayer(opt);
								setPayerQuery(opt?.label ?? "");
							}}
						>
							<Combobox.InputGroup>
								<InputGroup.Addon>
									<FontAwesomeIcon icon={faMagnifyingGlass} />
								</InputGroup.Addon>
								<Combobox.Input placeholder="Search payers..." />
							</Combobox.InputGroup>
							<Combobox.Content>
								<Combobox.Empty className="text-muted">
									No matching payers
								</Combobox.Empty>
								<Combobox.List>
									{(item: PayerOption) => (
										<Combobox.Item key={item.value} value={item}>
											{item.label}
										</Combobox.Item>
									)}
								</Combobox.List>
							</Combobox.Content>
						</Combobox>
					</Field>

					<Field>
						<Field.Label>Due Date</Field.Label>
						{/* A native date input rather than the record form's Calendar
						    popover: this modal is four short fields, not a long record
						    form, and the popover pattern carries a label gutter that has
						    nothing to line up with here. */}
						<Input
							type="date"
							value={dueDate}
							onChange={(e) => setDueDate(e.target.value)}
							style={{ maxWidth: "12rem" }}
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
