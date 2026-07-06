import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPenToSquare } from "@fortawesome/pro-regular-svg-icons";
import type { BuildingClass, Property } from "#/data/types";
import { PROPERTY_TYPES, TYPE_LABELS } from "#/components/properties/propertyDisplay";
import { updateProperty } from "#/data/store";
import { useEditorStore } from "./store";

const BUILDING_CLASSES: BuildingClass[] = ["A", "B", "C"];

/** The subset of `Property` fields the document's dynamic-field system can bind to. */
type FormState = Pick<
  Property,
  | "name"
  | "propertyType"
  | "buildingClass"
  | "yearBuilt"
  | "parkingSpaces"
  | "askingPrice"
  | "capRate"
  | "noi"
  | "buildingSqFt"
  | "lotSqFt"
  | "street"
  | "city"
  | "state"
  | "zip"
  | "county"
>;

function toForm(listing: Property): FormState {
  return {
    name: listing.name,
    propertyType: listing.propertyType,
    buildingClass: listing.buildingClass,
    yearBuilt: listing.yearBuilt,
    parkingSpaces: listing.parkingSpaces,
    askingPrice: listing.askingPrice,
    capRate: listing.capRate,
    noi: listing.noi,
    buildingSqFt: listing.buildingSqFt,
    lotSqFt: listing.lotSqFt,
    street: listing.street,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    county: listing.county,
  };
}

function num(v: string): number {
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** Edit the property fields behind the document's dynamic fields, from inside the editor. */
export function EditListingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const activeListing = useEditorStore((s) => s.activeListing);
  const updateActiveListing = useEditorStore((s) => s.updateActiveListing);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (open && activeListing) setForm(toForm(activeListing));
  }, [open, activeListing]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function handleSave() {
    if (!activeListing || !form) return;
    updateProperty(activeListing.id, form);
    updateActiveListing(form);
    onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="lg" scrollable centered>
        <Modal.Header>
          <Modal.Title>
            <FontAwesomeIcon icon={faPenToSquare} className="me-2" />
            Edit Listing
          </Modal.Title>
          <Modal.Description>
            Updates the property facts this document&apos;s dynamic fields pull from.
          </Modal.Description>
        </Modal.Header>

        {form && (
          <Modal.Body>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">Deal name</label>
                <Input value={form.name} onValueChange={(v: string) => set("name", v)} />
              </div>

              <div className="col-4">
                <label className="form-label">Property type</label>
                <Select
                  value={form.propertyType}
                  onValueChange={(v) => v && set("propertyType", v as never)}
                >
                  <Select.Trigger>
                    <Select.Value>
                      {(v) => TYPE_LABELS[v as keyof typeof TYPE_LABELS]}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    {PROPERTY_TYPES.map((t) => (
                      <Select.Item key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <div className="col-4">
                <label className="form-label">Building class</label>
                <Select
                  value={form.buildingClass}
                  onValueChange={(v) => v && set("buildingClass", v as never)}
                >
                  <Select.Trigger>
                    <Select.Value>{(v) => `Class ${v}`}</Select.Value>
                  </Select.Trigger>
                  <Select.Content>
                    {BUILDING_CLASSES.map((c) => (
                      <Select.Item key={c} value={c}>
                        Class {c}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              <div className="col-4">
                <label className="form-label">Year built</label>
                <Input
                  inputMode="numeric"
                  value={String(form.yearBuilt)}
                  onValueChange={(v: string) => set("yearBuilt", num(v))}
                />
              </div>

              <div className="col-4">
                <label className="form-label">Asking price</label>
                <Input
                  inputMode="numeric"
                  placeholder="$"
                  value={form.askingPrice ? String(form.askingPrice) : ""}
                  onValueChange={(v: string) => set("askingPrice", num(v))}
                />
              </div>
              <div className="col-4">
                <label className="form-label">Cap rate (%)</label>
                <Input
                  inputMode="numeric"
                  value={form.capRate ? String(form.capRate) : ""}
                  onValueChange={(v: string) => set("capRate", num(v))}
                />
              </div>
              <div className="col-4">
                <label className="form-label">Net operating income</label>
                <Input
                  inputMode="numeric"
                  placeholder="$"
                  value={form.noi ? String(form.noi) : ""}
                  onValueChange={(v: string) => set("noi", num(v))}
                />
              </div>

              <div className="col-4">
                <label className="form-label">Building SF</label>
                <Input
                  inputMode="numeric"
                  value={form.buildingSqFt ? String(form.buildingSqFt) : ""}
                  onValueChange={(v: string) => set("buildingSqFt", num(v))}
                />
              </div>
              <div className="col-4">
                <label className="form-label">Lot SF</label>
                <Input
                  inputMode="numeric"
                  value={form.lotSqFt ? String(form.lotSqFt) : ""}
                  onValueChange={(v: string) => set("lotSqFt", num(v))}
                />
              </div>
              <div className="col-4">
                <label className="form-label">Parking spaces</label>
                <Input
                  inputMode="numeric"
                  value={form.parkingSpaces ? String(form.parkingSpaces) : ""}
                  onValueChange={(v: string) => set("parkingSpaces", num(v))}
                />
              </div>

              <div className="col-12">
                <label className="form-label">Street address</label>
                <Input value={form.street} onValueChange={(v: string) => set("street", v)} />
              </div>
              <div className="col-4">
                <label className="form-label">City</label>
                <Input value={form.city} onValueChange={(v: string) => set("city", v)} />
              </div>
              <div className="col-4">
                <label className="form-label">State</label>
                <Input value={form.state} onValueChange={(v: string) => set("state", v)} />
              </div>
              <div className="col-4">
                <label className="form-label">Zip code</label>
                <Input value={form.zip} onValueChange={(v: string) => set("zip", v)} />
              </div>
              <div className="col-12">
                <label className="form-label">County</label>
                <Input value={form.county} onValueChange={(v: string) => set("county", v)} />
              </div>
            </div>
          </Modal.Body>
        )}

        <Modal.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!form}>
            <FontAwesomeIcon icon={faCheck} />
            Save changes
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
