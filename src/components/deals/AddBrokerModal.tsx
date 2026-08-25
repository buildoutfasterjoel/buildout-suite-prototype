import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/pro-regular-svg-icons";
import { TEAMMATES, type Teammate } from "#/data/teammates";
import { TRANSACTION_SIDES } from "#/data/vouchers";
import type { DealBroker, TransactionSide } from "#/data/types";

interface BrokerOption {
  value: string;
  label: string;
  teammate: Teammate;
}

/**
 * Add Broker on the voucher's Internal Commissions section: pick one of the
 * firm's people, say which side they worked, and they appear in both tables.
 *
 * The broker comes from the company roster rather than a free-text name — an
 * internal broker is one of the firm's own, and a typed name would let a
 * voucher pay someone who does not work here. Whoever is already on the voucher
 * is filtered out, so the same person cannot be added twice.
 *
 * Side is optional. A row with no side is a real state — the table shows
 * "Select..." and the broker can be placed later — so requiring it here would
 * be stricter than the thing it writes into.
 */
export function AddBrokerModal({
  open,
  onOpenChange,
  brokers,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Who is already on the voucher — filtered out of the picker. */
  brokers: DealBroker[];
  onAdd: (broker: DealBroker) => void;
}) {
  const [selected, setSelected] = useState<BrokerOption | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [side, setSide] = useState<TransactionSide | "">("");

  // A fresh form every time it opens — a half-filled one left over from a
  // cancelled add would be an odd thing to reopen into.
  useEffect(() => {
    if (open) {
      setSelected(null);
      setInputValue("");
      setSide("");
    }
  }, [open]);

  const taken = new Set(brokers.map((b) => b.name));
  const options: BrokerOption[] = TEAMMATES.filter(
    (t) => !taken.has(t.name),
  ).map((t) => ({ value: t.id, label: t.name, teammate: t }));

  const add = () => {
    if (!selected) return;
    const t = selected.teammate;
    // Everything but their identity starts empty: no gross, no split, "No
    // Plan". Whoever added them is the one who knows the rest.
    onAdd({
      id: crypto.randomUUID(),
      name: t.name,
      role: t.role,
      email: t.email,
      side: "internal",
      commissionSplitPct: 0,
      grossCommission: 0,
      commissionPlan: "No Plan",
      personalSplitPct: 0,
      transactionSide: side === "" ? undefined : side,
    });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content centered style={{ maxWidth: "30rem" }}>
        <Modal.Header>
          <Modal.Title>Add Broker</Modal.Title>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          <Field>
            <Field.Label>Broker</Field.Label>
            <Combobox
              items={options}
              value={selected}
              inputValue={inputValue}
              onInputValueChange={(v: string) => setInputValue(v)}
              onValueChange={(v) => {
                const opt = v as BrokerOption | null;
                setSelected(opt);
                setInputValue(opt?.label ?? "");
              }}
            >
              <Combobox.InputGroup>
                <InputGroup.Addon>
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </InputGroup.Addon>
                <Combobox.Input placeholder="Search brokers..." />
              </Combobox.InputGroup>
              <Combobox.Content>
                <Combobox.Empty className="text-muted">
                  {options.length === 0
                    ? "Everyone is already on this voucher"
                    : "No matching brokers"}
                </Combobox.Empty>
                <Combobox.List>
                  {(item: BrokerOption) => (
                    <Combobox.Item key={item.value} value={item}>
                      <div className="d-flex flex-column">
                        <span>{item.label}</span>
                        <span className="text-muted fs-small">
                          {item.teammate.role}
                        </span>
                      </div>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Content>
            </Combobox>
          </Field>

          <Field>
            <Field.Label>Transaction Side</Field.Label>
            <Select
              value={side}
              onValueChange={(v) => setSide((v as TransactionSide) ?? "")}
            >
              <Select.Trigger>
                <Select.Value placeholder="Select..." />
              </Select.Trigger>
              <Select.Content>
                {TRANSACTION_SIDES.map((s) => (
                  <Select.Item key={s} value={s}>
                    {s}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={add} disabled={!selected}>
            Add Broker
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
