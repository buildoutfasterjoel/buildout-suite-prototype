import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog } from "@buildoutinc/blueprint-react/ui/Dialog";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClockRotateLeft } from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import { SIDEBAR_PIN_STORAGE_KEY, useEditorStore } from "./store";
import { DocsNavRail } from "./DocsNavRail";
import { PropertiesPanel } from "./PropertiesPanel";
import { CanvasActions } from "./CanvasActions";
import { EditListingDialog } from "./EditListingDialog";
import { Canvas } from "./Canvas";
import { EditorDndProvider } from "./dnd/EditorDndProvider";
import "./editor.scss";

/**
 * Full-screen document editor shell. Composes the icon rail, properties panel,
 * and canvas, and seeds the document from the bound listing.
 */
export function EditorRoot({
  listing,
  listingId,
}: {
  listing: Property | undefined;
  listingId: string;
}) {
  const navigate = useNavigate();
  const initDocument = useEditorStore((s) => s.initDocument);
  const markSaved = useEditorStore((s) => s.markSaved);
  const [editListingOpen, setEditListingOpen] = useState(false);
  const [switchToClassicOpen, setSwitchToClassicOpen] = useState(false);

  useEffect(() => {
    initDocument(listing);
  }, [listing, initDocument]);

  function handleSaveAndClose() {
    markSaved();
    void navigate({ to: "/listings/$listingId/documents", params: { listingId } });
  }

  // Sync the persisted pin preference after mount (kept out of the store's
  // initial state so server and first-render client output match).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(SIDEBAR_PIN_STORAGE_KEY);
    if (stored !== null) {
      useEditorStore.setState({ sidebarPinned: stored === "true" });
    }
  }, []);

  return (
    <EditorDndProvider>
      <div className="bo-editor">
        <CanvasActions
          onSaveAndClose={handleSaveAndClose}
          onEditListing={() => setEditListingOpen(true)}
          onSwitchToClassicEditor={() => setSwitchToClassicOpen(true)}
        />

        <div className="bo-editor-body">
          <div className="bo-editor-rail-wrap">
            <DocsNavRail />
            <PropertiesPanel />
          </div>

          <div className="bo-editor-canvas">
            <Canvas />
          </div>
        </div>
      </div>

      <EditListingDialog open={editListingOpen} onOpenChange={setEditListingOpen} />

      {/* Mocked revert to the classic editor (Phase 3 wires the real flow). */}
      <Dialog open={switchToClassicOpen} onOpenChange={setSwitchToClassicOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                <FontAwesomeIcon icon={faClockRotateLeft} className="me-2" />
                Switch to Classic Editor
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.Description>
                This is a prototype — switching editors isn&apos;t wired up yet. In
                the real app this would take you back to the classic document
                editor for this listing.
              </Dialog.Description>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.Cancel variant="outline">Cancel</Dialog.Cancel>
              <Button variant="primary" onClick={() => setSwitchToClassicOpen(false)}>
                Switch to Classic Editor
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </EditorDndProvider>
  );
}
