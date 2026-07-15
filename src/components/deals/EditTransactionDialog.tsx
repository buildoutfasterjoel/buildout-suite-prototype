import { useState } from "react";
import { Dialog } from "@buildoutinc/blueprint-react/ui/Dialog";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import type { Listing } from "#/data/types";
import { updateDealTransaction } from "#/data/actions";
import { commissionAmountFromPct, commissionPctFromAmount } from "#/data/commission";

interface TransactionForm {
  salePrice: number | null;
  commissionPct: number | null;
  commissionAmount: number | null;
  closeProbability: number | null;
}

/** Edit a deal's transaction terms. Sale Price anchors the commission %/$ trio. */
export function EditTransactionDialog({
  listing,
  open,
  onOpenChange,
}: {
  listing: Listing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { transaction } = listing;
  const [form, setForm] = useState<TransactionForm>({
    salePrice: transaction.salePrice || null,
    commissionPct: transaction.commissionPct || null,
    commissionAmount: transaction.commissionAmount || null,
    closeProbability: transaction.closeProbability ?? null,
  });

  // Re-seed the working copy each time the dialog (re)opens for a deal.
  const [seededFor, setSeededFor] = useState("");
  const seedKey = `${listing.id}:${open}`;
  if (open && seedKey !== seededFor) {
    setForm({
      salePrice: transaction.salePrice || null,
      commissionPct: transaction.commissionPct || null,
      commissionAmount: transaction.commissionAmount || null,
      closeProbability: transaction.closeProbability ?? null,
    });
    setSeededFor(seedKey);
  }

  const setSalePrice = (v: number | null) =>
    setForm((f) => ({
      ...f,
      salePrice: v,
      commissionAmount:
        v != null && f.commissionPct != null
          ? commissionAmountFromPct(v, f.commissionPct)
          : f.commissionAmount,
    }));
  const setCommissionPct = (v: number | null) =>
    setForm((f) => ({
      ...f,
      commissionPct: v,
      commissionAmount:
        v != null && f.salePrice != null
          ? commissionAmountFromPct(f.salePrice, v)
          : f.commissionAmount,
    }));
  const setCommissionAmount = (v: number | null) =>
    setForm((f) => ({
      ...f,
      commissionAmount: v,
      commissionPct:
        v != null && f.salePrice != null && f.salePrice > 0
          ? commissionPctFromAmount(f.salePrice, v)
          : f.commissionPct,
    }));

  const save = () => {
    updateDealTransaction(listing.id, {
      salePrice: form.salePrice ?? 0,
      commissionPct: form.commissionPct ?? 0,
      commissionAmount: form.commissionAmount ?? 0,
      closeProbability: form.closeProbability ?? 0,
    });
    onOpenChange(false);
  };

  const num = (e: React.ChangeEvent<HTMLInputElement>) =>
    e.target.value ? Number(e.target.value) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Edit Transaction</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <div className="d-flex flex-column gap-3">
              <Field>
                <Field.Label>Sale Price</Field.Label>
                <Input
                  type="number"
                  value={form.salePrice ?? ""}
                  onChange={(e) => setSalePrice(num(e))}
                />
              </Field>
              <Field>
                <Field.Label>Gross Commission %</Field.Label>
                <Input
                  type="number"
                  value={form.commissionPct ?? ""}
                  onChange={(e) => setCommissionPct(num(e))}
                />
              </Field>
              <Field>
                <Field.Label>Gross Commission ($)</Field.Label>
                <Input
                  type="number"
                  value={form.commissionAmount ?? ""}
                  onChange={(e) => setCommissionAmount(num(e))}
                />
              </Field>
              <Field>
                <Field.Label>Close Probability (%)</Field.Label>
                <Input
                  type="number"
                  value={form.closeProbability ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, closeProbability: num(e) }))
                  }
                />
              </Field>
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel variant="outline">Cancel</Dialog.Cancel>
            <Button variant="primary" onClick={save}>
              Save
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
