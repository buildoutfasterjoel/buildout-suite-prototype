import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/pro-regular-svg-icons";
import { getContactOptions, type ContactOption } from "#/data/store";

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
	onAdd,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Already on the section — filtered out, so nobody is added twice. */
	takenIds: string[];
	/** "Buyer", "Tenant" or "Payer" — names the modal and its confirm button. */
	title: string;
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
	const options = getContactOptions().filter((o) => !taken.has(o.value));

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
						<Combobox
							items={options}
							value={selected}
							inputValue={inputValue}
							onInputValueChange={(v: string) => setInputValue(v)}
							onValueChange={(v) => {
								const opt = v as ContactOption | null;
								setSelected(opt);
								setInputValue(opt?.label ?? "");
							}}
						>
							<Combobox.InputGroup>
								<InputGroup.Addon>
									<FontAwesomeIcon icon={faMagnifyingGlass} />
								</InputGroup.Addon>
								<Combobox.Input placeholder="Search contacts..." />
							</Combobox.InputGroup>
							<Combobox.Content>
								<Combobox.Empty className="text-muted">
									{options.length === 0
										? "Every contact is already on this voucher"
										: "No matching contacts"}
								</Combobox.Empty>
								<Combobox.List>
									{(item: ContactOption) => (
										<Combobox.Item key={item.value} value={item}>
											<div className="d-flex flex-column">
												<span>{item.name}</span>
												<span className="text-muted fs-small">
													{[item.title, item.company]
														.filter(Boolean)
														.join(" · ")}
												</span>
											</div>
										</Combobox.Item>
									)}
								</Combobox.List>
							</Combobox.Content>
						</Combobox>
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
