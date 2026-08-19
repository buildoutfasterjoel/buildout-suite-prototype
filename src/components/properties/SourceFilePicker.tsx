import { useMemo, useRef, useState } from "react";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faCloudArrowUp } from "@fortawesome/pro-regular-svg-icons";
import { classifyFile, KIND_LABEL } from "#/data/documentGeneration";
import { formatBytes } from "#/lib/formatBytes";
import { fileTypeIcon } from "#/lib/fileTypeIcon";
import type { DealFileItem } from "#/data/types";

/**
 * A flat, searchable list of the deal's files for the generation screen.
 * Folders are shown as a subtitle rather than navigated into — selecting
 * across folders inside a modal loses sight of what is already checked.
 */
export function SourceFilePicker({
  items,
  selectedIds,
  onToggle,
  onUpload,
}: {
  /** Every non-deleted file on the deal, flattened. */
  items: { file: DealFileItem; folderName: string }[];
  selectedIds: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onUpload: (files: File[]) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.file.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-center justify-content-between gap-2">
        <span className="fw-semibold">Source files</span>
        <span className="text-muted fs-small">
          {selectedIds.size} of {items.length} selected
        </span>
      </div>

      <InputGroup>
        <InputGroup.Addon>
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </InputGroup.Addon>
        <Input
          type="search"
          placeholder="Search files"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>

      {filtered.length === 0 ? (
        <Empty className="py-4">
          <Empty.Content>No files match your search.</Empty.Content>
        </Empty>
      ) : (
        <div
          className="d-flex flex-column gap-1 overflow-auto border rounded p-2"
          style={{ maxHeight: 220 }}
        >
          {filtered.map(({ file, folderName }) => {
            const kind = classifyFile(file.name);
            return (
              <label
                key={file.id}
                className="d-flex align-items-center gap-2 p-2 rounded"
                style={{ cursor: "pointer" }}
              >
                <Checkbox
                  checked={selectedIds.has(file.id)}
                  onCheckedChange={(c) => onToggle(file.id, c === true)}
                  aria-label={`Use ${file.name}`}
                />
                <FontAwesomeIcon icon={fileTypeIcon(file.name)} className="text-muted" />
                <span className="flex-grow-1" style={{ minWidth: 0 }}>
                  <span className="d-block text-truncate fw-medium">{file.name}</span>
                  <span className="d-block text-muted fs-small">
                    {folderName} · {formatBytes(file.sizeBytes)}
                  </span>
                </span>
                <Badge
                  variant="secondary"
                  appearance={kind === "other" ? "muted" : "accent"}
                >
                  {KIND_LABEL[kind]}
                </Badge>
              </label>
            );
          })}
        </div>
      )}

      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <FontAwesomeIcon icon={faCloudArrowUp} />
          Upload files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="d-none"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length > 0) onUpload(picked);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
