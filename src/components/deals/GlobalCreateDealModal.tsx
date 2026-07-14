import { CreateDealModal } from "#/components/deals/CreateDealModal";
import { useCreateDeal } from "#/data/useCreateDeal";

/** The single, app-wide create-deal modal, driven by the useCreateDeal store. */
export function GlobalCreateDealModal() {
  const open = useCreateDeal((s) => s.open);
  const contact = useCreateDeal((s) => s.contact);
  const property = useCreateDeal((s) => s.property);
  const initialAddress = useCreateDeal((s) => s.initialAddress);
  const close = useCreateDeal((s) => s.close);

  return (
    <CreateDealModal
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      contact={contact}
      property={property}
      initialAddress={initialAddress}
    />
  );
}
