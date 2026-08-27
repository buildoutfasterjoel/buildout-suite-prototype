import { createContext, useContext } from "react";

/**
 * Whether the enclosing {@link LockableFieldset} is switched off.
 *
 * Exists because `fieldset[disabled]` is *almost* enough on its own. It reaches
 * every native control nested under it — input, select, textarea, button — which
 * is nearly the whole widget set, at any depth, with nothing to forget at a call
 * site. What it cannot reach is a control that isn't a native element, because
 * there is no disabled state on the element for the fieldset to inherit down to.
 * The widget set has exactly two, and both stayed live inside a locked form
 * until they were made to read this:
 *
 *   - `SwitchRow` — Blueprint renders `Switch` as a `<span role="switch">`,
 *     which still toggled.
 *   - `DateField` — its calendar addon is a `Popover.Trigger` rendering an
 *     `<svg>`. That one mattered most: the field's text input is `readOnly`, so
 *     the calendar is the *only* way to set the date, and a locked field went on
 *     writing dates straight through a greyed-out input.
 *
 * So the fieldset stays the mechanism and this covers what it cannot see. Any
 * widget added here that is not a native input, button or select has to read
 * this too — check for `nativeButton={false}` and bare `role=` attributes.
 */
const FormLockContext = createContext(false);

export function useFormLocked(): boolean {
	return useContext(FormLockContext);
}

/**
 * A form's field stack, switchable off as a unit.
 *
 * `border-0 p-0 m-0` undoes the element's default chrome, and `min-width: 0`
 * undoes its `min-content` floor — a fieldset refuses to shrink below its
 * content otherwise, which pushes a form wider than the column holding it.
 */
export function LockableFieldset({
	disabled,
	className,
	children,
}: {
	disabled: boolean;
	/** Layout classes for the stack — the fieldset replaces the div that held them. */
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<FormLockContext.Provider value={disabled}>
			<fieldset
				className={`border-0 p-0 m-0${className ? ` ${className}` : ""}`}
				style={{ minWidth: 0 }}
				disabled={disabled}
			>
				{children}
			</fieldset>
		</FormLockContext.Provider>
	);
}
