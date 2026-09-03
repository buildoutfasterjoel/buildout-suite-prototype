import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import {
	contactOptionsFor,
	getContactOptions,
	type ContactOption,
	type ContactOptionGroup,
} from "#/data/store";
import { ContactPicker } from "./ContactPicker";

/**
 * Pick one contact — the Add behind the voucher's Buyer/Tenant and Payers
 * sections.
 *
 * Picking, not typing. A party on a voucher is a real person the company has a
 * record of; a free-text name would let a voucher bill someone the contact book
 * has never heard of, and every column beside the name — company, email, phone
 * — is read from that record and would have nowhere to come from.
 *
 * Creating a contact stays the contacts page's job. A half-filled contact made
 * in a hurry from a voucher is the kind of duplicate a CRM never recovers from.
 *
 * `title` is passed rather than derived, because the same modal opens as "Add
 * Buyer", "Add Tenant" and "Add Payer".
 */
export function AddContactModal({
	open,
	onOpenChange,
	takenIds,
	title,
	priority,
	onAdd,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Already on the section — filtered out, so nobody is added twice. */
	takenIds: string[];
	/** "Buyer", "Tenant" or "Payer" — names the modal and its confirm button. */
	title: string;
	/**
	 * A handful of contacts to float to the top under their own heading, for the
	 * section that has a likely answer before the search starts: a payer is
	 * usually the deal's buyer or tenant, so Add Payer opens with those named
	 * rather than buried alphabetically among every contact in the book.
	 *
	 * Omitted by the Buyer/Tenant section, which has no such shortlist — the
	 * people it would promote are the ones already on it.
	 */
	priority?: { label: string; ids: string[] };
	onAdd: (contactId: string) => void;
}) {
	const [selected, setSelected] = useState<ContactOption | null>(null);
	const [inputValue, setInputValue] = useState("");

	// A fresh form every time it opens — a half-filled one left over from a
	// cancelled add would be an odd thing to reopen into.
	useEffect(() => {
		if (open) {
			setSelected(null);
			setInputValue("");
		}
	}, [open]);

	const taken = new Set(takenIds);
	const promoted = contactOptionsFor(priority?.ids ?? []).filter(
		(o) => !taken.has(o.value),
	);
	// The promoted contacts are lifted OUT of the main list rather than repeated
	// in it: one contact appearing twice in one dropdown reads as two people.
	const promotedIds = new Set(promoted.map((o) => o.value));
	const rest = getContactOptions().filter(
		(o) => !taken.has(o.value) && !promotedIds.has(o.value),
	);
	const groups: ContactOptionGroup[] = [];
	if (promoted.length > 0 && priority)
		groups.push({ value: "priority", label: priority.label, items: promoted });
	if (rest.length > 0)
		groups.push({ value: "all", label: "All Contacts", items: rest });

	const add = () => {
		if (!selected) return;
		onAdd(selected.value);
		onOpenChange(false);
	};

	return (
		<Modal open={open} onOpenChange={onOpenChange}>
			<Modal.Content centered style={{ maxWidth: "30rem" }}>
				<Modal.Header>
					<Modal.Title>Add {title}</Modal.Title>
				</Modal.Header>

				<Modal.Body>
					<Field>
						<Field.Label>{title}</Field.Label>
						<ContactPicker
							groups={groups}
							value={selected}
							onChange={setSelected}
							query={inputValue}
							onQueryChange={setInputValue}
							emptyMessage={
								groups.length === 0
									? "Every contact is already on this voucher"
									: "No matching contacts"
							}
						/>
					</Field>
				</Modal.Body>

				<Modal.Footer>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button variant="primary" onClick={add} disabled={!selected}>
						Add {title}
					</Button>
				</Modal.Footer>
			</Modal.Content>
		</Modal>
	);
}
