import { useRef, useState } from "react";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCloudArrowUp } from "@fortawesome/pro-regular-svg-icons";
import { cn } from "@buildoutinc/blueprint-react/lib/utils";

/**
 * The generation screen's opening move: drop files here, or click to browse.
 * Leads the screen because uploading is the thing a broker arrives wanting to
 * do — the deal's existing files sit underneath as the alternative.
 *
 * Deliberately the same `Empty` + cloud-icon treatment as the Documents page's
 * own drop zone, so this reads as the surface they already know.
 */
export function FileDropZone({ onUpload }: { onUpload: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draggingOver, setDraggingOver] = useState(false);

  function take(files: FileList | null) {
    const picked = Array.from(files ?? []);
    if (picked.length > 0) onUpload(picked);
  }

  return (
    <>
      <Empty
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        className={cn("py-4", draggingOver && "border-primary bg-body-secondary")}
        style={{ cursor: "pointer" }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDraggingOver(true);
        }}
        onDragLeave={() => setDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDraggingOver(false);
          take(e.dataTransfer?.files ?? null);
        }}
      >
        <Empty.Media>
          <FontAwesomeIcon icon={faCloudArrowUp} aria-hidden />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>
            {draggingOver ? "Drop to add these files" : "Drop files here or click to browse"}
          </Empty.Title>
        </Empty.Content>
      </Empty>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="d-none"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}
