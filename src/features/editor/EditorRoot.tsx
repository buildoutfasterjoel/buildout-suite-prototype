import { useEffect, useState } from "react";
import { Dialog } from "@buildoutinc/blueprint-react/ui/Dialog";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilePdf } from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";
import { SIDEBAR_PIN_STORAGE_KEY, useEditorStore } from "./store";
import { DocsNavRail } from "./DocsNavRail";
import { PropertiesPanel } from "./PropertiesPanel";
import { CanvasActions } from "./CanvasActions";
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
  const initDocument = useEditorStore((s) => s.initDocument);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    initDocument(listing);
  }, [listing, initDocument]);

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
        <div className="bo-editor-rail-wrap">
          <DocsNavRail />
          <PropertiesPanel />
        </div>

        <div className="bo-editor-canvas">
          <CanvasActions listingId={listingId} onExport={() => setExportOpen(true)} />
          <Canvas />
        </div>
      </div>

      {/* Mocked PDF export (Phase 3 wires the real flow). */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                <FontAwesomeIcon icon={faFilePdf} className="me-2" />
                Export to PDF
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.Description>
                This is a prototype — PDF generation isn&apos;t wired up yet. In the
                real editor this would render your document to a downloadable PDF.
              </Dialog.Description>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.Cancel variant="outline">Close</Dialog.Cancel>
              <Button variant="primary" onClick={() => setExportOpen(false)}>
                Got it
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </EditorDndProvider>
  );
}
