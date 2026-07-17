import { NewContactModal } from "#/components/contacts/NewContactModal";
import { createContact } from "#/data/actions";
import { useNewContact } from "#/data/useNewContact";

/** The single, app-wide New Contact modal, driven by the useNewContact store. */
export function GlobalNewContactModal() {
  const open = useNewContact((s) => s.open);
  const close = useNewContact((s) => s.close);

  return (
    <NewContactModal
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      onCreate={(input) => createContact(input)}
    />
  );
}
