import { useMemo, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare, faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { UnitType } from "#/data/types";
import { getListing, getProperty } from "#/data/store";
import { getChildDeals, addSpaceToDeal, addPropertyUnit } from "#/data/leaseSpaces";

const UNIT_TYPE_OPTIONS: { value: UnitType; label: string }[] = [
  { value: "retail", label: "Retail" },
  { value: "office", label: "Office" },
  { value: "industrial", label: "Industrial" },
  { value: "residential", label: "Residential" },
  { value: "other", label: "Other" },
];

export function AddSpaceModal({
  parentDealId,
  open,
  onOpenChange,
  onAdded,
}: {
  parentDealId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void;
}) {
  const deal = getListing(parentDealId);
  const property = deal ? getProperty(deal.propertyId) : undefined;

  // Units already spun into a child space deal — hide them from the picker.
  const usedUnitIds = useMemo(
    () => new Set(getChildDeals(parentDealId).map((c) => c.unitId).filter(Boolean) as string[]),
    [parentDealId, open],
  );
  const availableUnits = (property?.units ?? []).filter((u) => !usedUnitIds.has(u.id));

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [newLabel, setNewLabel] = useState("");
  const [newSqft, setNewSqft] = useState<number | null>(null);
  const [newType, setNewType] = useState<UnitType>("retail");

  // Reset local state when the modal (re)opens.
  const [seededOpen, setSeededOpen] = useState(false);
  if (open && !seededOpen) {
    setChecked(new Set());
    setNewLabel("");
    setNewSqft(null);
    setNewType("retail");
    setSeededOpen(true);
  }
  if (!open && seededOpen) setSeededOpen(false);

  if (!deal || !property) return null;

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canAdd = checked.size > 0 || (newLabel.trim().length > 0 && (newSqft ?? 0) > 0);

  const commit = () => {
    // Spawn a child per checked existing unit.
    for (const unitId of checked) addSpaceToDeal(parentDealId, unitId);
    // Add a new unit to the property, then spawn its child.
    if (newLabel.trim() && (newSqft ?? 0) > 0) {
      const unit = addPropertyUnit(deal.propertyId, {
        label: newLabel.trim(),
        sqft: newSqft as number,
        unitType: newType,
      });
      if (unit) addSpaceToDeal(parentDealId, unit.id);
    }
    onOpenChange(false);
    onAdded?.();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="lg" scrollable centered>
        <Modal.Header>
          <Modal.Title>Add space</Modal.Title>
          <Modal.Description>
            Spin a space from {property.name} into its own deal.
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3">
          <div>
            <div className="fw-semibold mb-2">Property units</div>
            {availableUnits.length === 0 ? (
              <p className="text-muted mb-0">
                Every unit on this property already has a space deal. Add a new one below.
              </p>
            ) : (
              <div className="d-flex flex-column gap-2 border rounded p-2">
                {availableUnits.map((u) => (
                  <label key={u.id} className="d-flex align-items-center gap-2 mb-0">
                    <Checkbox
                      checked={checked.has(u.id)}
                      onCheckedChange={() => toggle(u.id)}
                    />
                    <FontAwesomeIcon icon={faVectorSquare} className="text-muted" />
                    <span className="fw-semibold">{u.label}</span>
                    <span className="text-muted ms-1">{u.sqft.toLocaleString()} SF</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="border-top pt-3">
            <div className="fw-semibold mb-2">
              <FontAwesomeIcon icon={faPlus} /> New space
            </div>
            <div className="d-flex gap-2">
              <Field className="flex-grow-1">
                <Field.Label>Label</Field.Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Suite 300"
                />
              </Field>
              <Field style={{ width: 140 }}>
                <Field.Label>SF</Field.Label>
                <Input
                  type="number"
                  value={newSqft ?? ""}
                  onChange={(e) => setNewSqft(e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field style={{ width: 160 }}>
                <Field.Label>Type</Field.Label>
                <Select
                  items={UNIT_TYPE_OPTIONS}
                  value={newType}
                  onValueChange={(v) => setNewType(v as UnitType)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {UNIT_TYPE_OPTIONS.map((o) => (
                      <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>
            </div>
            <div className="form-text text-muted mt-1">
              A new space is added to the property record, then spun into a deal.
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close render={<Button variant="ghost">Cancel</Button>} />
          <Button variant="primary" disabled={!canAdd} onClick={commit}>
            Add space
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
