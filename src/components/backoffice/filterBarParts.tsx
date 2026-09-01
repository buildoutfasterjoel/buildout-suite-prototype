import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown, faUserGroupSimple } from "@fortawesome/pro-regular-svg-icons";

/**
 * The pieces every Back Office index toolbar shares.
 *
 * The facets themselves differ page to page — Receivables filters on a status
 * Deposits does not have — but the look of a trigger, the disabled Offices
 * control and the broker picker are the same three things on every one of
 * them, and a second copy of the Offices tooltip would be a second place to
 * update when offices are finally modelled.
 */

/**
 * What makes a facet trigger read as one of Blueprint's Selects.
 *
 * `form-select` is the class `Select.Trigger` itself carries, and
 * `hidden-indicator` is the modifier it pairs with it — that combination drops
 * the background-image caret and the padding reserved for it, leaving the
 * component's own `<FontAwesomeIcon>` to sit at the right edge under
 * `.form-select svg { margin-left: auto }`. Applied to the facet buttons so the
 * whole toolbar reads as one family rather than as Selects beside Buttons.
 *
 * `w-auto` is not optional: `.form-select` is `width: 100%`, which is right for
 * a form field in a column and wrong for a toolbar control — without it every
 * facet claims a row of its own and the bar becomes six stacked lines.
 */
export const SELECT_LOOK = "form-select hidden-indicator w-auto";

/**
 * The disabled Offices control.
 *
 * Nothing in the data model carries an office — not a deal, not a broker, not a
 * property. It renders greyed rather than being dropped because the reference
 * designs carry it and the real product has offices the prototype has not
 * modelled; a control that appears later in a different position is a worse
 * surprise than one that is visibly not ready. The tooltip says why, so it does
 * not read as broken.
 *
 * `noun` is what the page calls its rows, so the explanation is about the thing
 * the user is actually looking at.
 *
 * This and Receivables' Other Credits column are the only inert things in Back
 * Office. Nothing else may join them.
 */
export function OfficesDropdown({ noun }: { noun: string }) {
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          // A span wrapper, because a disabled button fires no pointer events
          // and would never surface the tooltip that explains it.
          <span className="d-inline-flex">
            <Button
              variant="outline"
              disabled
              className={`d-inline-flex align-items-center gap-2 text-nowrap ${SELECT_LOOK}`}
            >
              All Offices
              <FontAwesomeIcon icon={faCaretDown} />
            </Button>
          </span>
        }
      />
      <Tooltip.Content>
        Offices aren't set up yet — every {noun} is in one book.
      </Tooltip.Content>
    </Tooltip>
  );
}

/**
 * The Brokers filter — a multi-select combobox rather than a checkbox facet.
 *
 * The one facet whose options are *names drawn from the book* rather than a
 * fixed vocabulary. That list grows with the brokerage, and a popover of
 * checkboxes stops working the moment it is longer than a screen; typing to
 * narrow is the only thing that scales. The chips also state the current
 * selection in the toolbar itself, which a "2" badge on a closed dropdown
 * cannot.
 *
 * `value` is derived from the Set on every render rather than mirrored in local
 * state, so a reset from the empty state clears the chips too.
 */
export function BrokerCombobox({
  brokerNames,
  selected,
  onChange,
}: {
  brokerNames: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  // The typed text is genuinely local — it is not a filter, and it is cleared
  // on each pick so the next name starts from the whole list.
  const [inputValue, setInputValue] = useState("");

  return (
    // Grows with its chips but stops before it can push the rest of the toolbar
    // off the row; past the cap the chips wrap inside the control.
    <div style={{ minWidth: 200, maxWidth: 380, flex: "1 1 200px" }}>
      <Combobox
        multiple
        items={brokerNames}
        value={[...selected]}
        inputValue={inputValue}
        onInputValueChange={(v: string) => setInputValue(v)}
        onValueChange={(v: string[]) => {
          onChange(new Set(v));
          setInputValue("");
        }}
      >
        <Combobox.InputGroup>
          <InputGroup.Addon>
            <FontAwesomeIcon icon={faUserGroupSimple} />
          </InputGroup.Addon>
          <Combobox.Chips>
            <Combobox.Value>
              {(value: string[]) => (
                <>
                  {value.map((name) => (
                    <Combobox.Chip key={name}>{name}</Combobox.Chip>
                  ))}
                  {/* The placeholder doubles as the control's label, which is
                      why it only shows while nothing is picked — with chips in
                      the box, "All Brokers" would be contradicting them. */}
                  <Combobox.Input
                    placeholder={value.length ? "" : "All Brokers"}
                  />
                </>
              )}
            </Combobox.Value>
          </Combobox.Chips>
          <InputGroup.Addon>
            <Combobox.Trigger />
          </InputGroup.Addon>
        </Combobox.InputGroup>
        <Combobox.Content>
          <Combobox.Empty className="text-muted">
            No matching brokers
          </Combobox.Empty>
          <Combobox.List>
            {(item: string) => (
              <Combobox.Item key={item} value={item}>
                {item}
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Content>
      </Combobox>
    </div>
  );
}
