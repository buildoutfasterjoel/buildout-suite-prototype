import { useNavigate } from "@tanstack/react-router";
import { NewContactModal } from "#/components/contacts/NewContactModal";
import { createContact } from "#/data/actions";
import { useNewContact } from "#/data/useNewContact";

/** The single, app-wide New Contact modal, driven by the useNewContact store. */
export function GlobalNewContactModal() {
  const open = useNewContact((s) => s.open);
  const close = useNewContact((s) => s.close);
  const navigate = useNavigate();

  return (
    <NewContactModal
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      onCreate={(input) => {
        // Land the user on the record they just created, whether the modal was
        // launched from the People page or the top-nav +New menu on any page.
        const { contact } = createContact(input);
        void navigate({
          to: "/backoffice/contacts/$contactId",
          params: { contactId: contact.id },
        });
      }}
    />
  );
}
