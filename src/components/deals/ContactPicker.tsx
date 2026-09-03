import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/pro-regular-svg-icons";
import type { ContactOption, ContactOptionGroup } from "#/data/store";

function ContactItem({ item }: { item: ContactOption }) {
	const meta = [item.title, item.company].filter(Boolean).join(" · ");
	return (
		<div className="d-flex flex-column">
			<span>{item.name}</span>
			{meta && <span className="text-muted fs-small">{meta}</span>}
		</div>
	);
}

/**
 * The searchable contact picker behind the voucher's party modals — Add
 * Buyer/Tenant, Add Payer, and the payer on a new receivable.
 *
 * Takes groups rather than a flat list, because two of the three sections have
 * an obvious first answer: the payer is usually the buyer, and a receivable is
 * billed to someone already on the voucher. Putting those at the top under a
 * heading is what makes the picker a confirmation rather than a search through
 * the whole contact book.
 *
 * A single group renders without its heading by default. "All Contacts" over
 * the only list on screen labels nothing, and the Add Buyer picker — which has
 * no priority group to distinguish — should read exactly as it did before this
 * took groups. `labelSingleGroup` opts back in, for the picker whose list is
 * deliberately short: there the heading is the explanation of why the rest of
 * the contact book is missing.
 */
export function ContactPicker({
	groups,
	value,
	onChange,
	query,
	onQueryChange,
	labelSingleGroup = false,
	placeholder = "Search contacts...",
	emptyMessage = "No matching contacts",
}: {
	groups: ContactOptionGroup[];
	value: ContactOption | null;
	onChange: (next: ContactOption | null) => void;
	/**
	 * What is typed in the box. Held by the modal, not here, because the modal
	 * is what clears the form when it reopens — a query left over from a
	 * cancelled add would otherwise come back with it.
	 */
	query: string;
	onQueryChange: (next: string) => void;
	/** Keep the heading on when there is only one group — see above. */
	labelSingleGroup?: boolean;
	placeholder?: string;
	/** Shown when nothing matches — or when there was nothing to offer at all. */
	emptyMessage?: string;
}) {
	const sectioned = groups.length > 1 || (labelSingleGroup && groups.length === 1);

	return (
		<Combobox
			items={sectioned ? groups : (groups[0]?.items ?? [])}
			value={value}
			inputValue={query}
			onInputValueChange={onQueryChange}
			onValueChange={(v) => {
				const opt = v as ContactOption | null;
				onChange(opt);
				// Picking writes the label into the box, so a closed picker reads as
				// an answered field rather than as a search someone abandoned.
				onQueryChange(opt?.label ?? "");
			}}
		>
			<Combobox.InputGroup>
				<InputGroup.Addon>
					<FontAwesomeIcon icon={faMagnifyingGlass} />
				</InputGroup.Addon>
				<Combobox.Input placeholder={placeholder} />
			</Combobox.InputGroup>
			<Combobox.Content>
				<Combobox.Empty className="text-muted">{emptyMessage}</Combobox.Empty>
				<Combobox.List>
					{sectioned
						? (group: ContactOptionGroup) => (
								<Combobox.Group key={group.value} items={group.items}>
									<Combobox.GroupLabel>{group.label}</Combobox.GroupLabel>
									<Combobox.Collection>
										{(item: ContactOption) => (
											<Combobox.Item key={item.value} value={item}>
												<ContactItem item={item} />
											</Combobox.Item>
										)}
									</Combobox.Collection>
								</Combobox.Group>
							)
						: (item: ContactOption) => (
								<Combobox.Item key={item.value} value={item}>
									<ContactItem item={item} />
								</Combobox.Item>
							)}
				</Combobox.List>
			</Combobox.Content>
		</Combobox>
	);
}
