import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { TemplatePicker } from "./TemplatePicker";

export function NewDocumentModal({
  open,
  onOpenChange,
  onSelectTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (templateName: string) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="lg" scrollable centered style={{ maxWidth: "38rem" }}>
        <Modal.Header>
          <Modal.Title>New Document</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <TemplatePicker
            onSelect={(t) => {
              onSelectTemplate(t.name);
              onOpenChange(false);
            }}
          />
        </Modal.Body>
      </Modal.Content>
    </Modal>
  );
}
