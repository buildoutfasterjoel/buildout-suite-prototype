import { Fragment, useMemo, useRef, useState } from "react";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { Dialog } from "@buildoutinc/blueprint-react/ui/Dialog";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faEllipsisVertical,
  faCaretDown,
  faCloudArrowUp,
  faFolder,
  faUpload,
  faDownload,
  faTrashCan,
  faTrashCanArrowUp,
} from "@fortawesome/pro-regular-svg-icons";
import { ListingPageHeader } from "../listings/ListingPageHeader";
import { getListing } from "#/data/store";
import { addDealFile, getDealFiles, softDeleteDealFile } from "#/data/dealFilesActions";
import { formatBytes } from "#/lib/formatBytes";
import { fileTypeIcon } from "#/lib/fileTypeIcon";
import type { DealFileItem } from "#/data/types";

const CHECKBOX_COL_W = 44;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function childrenOf(items: DealFileItem[], parentId: string | null): DealFileItem[] {
  return items.filter((i) => i.parentId === parentId && !i.deletedAt);
}

function breadcrumbPath(items: DealFileItem[], folderId: string | null): DealFileItem[] {
  const path: DealFileItem[] = [];
  let currentId = folderId;
  while (currentId) {
    const folder = items.find((i) => i.id === currentId);
    if (!folder) break;
    path.unshift(folder);
    currentId = folder.parentId;
  }
  return path;
}

/** All ids nested inside `id`, at any depth (does not include `id` itself). */
function descendantIds(items: DealFileItem[], id: string): Set<string> {
  const result = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const item of items) {
      if (item.parentId === current && !result.has(item.id)) {
        result.add(item.id);
        stack.push(item.id);
      }
    }
  }
  return result;
}

export function PropertyDetailFiles({ listingId }: { listingId: string }) {
  const listing = getListing(listingId);
  const [items, setItems] = useState<DealFileItem[]>(() => getDealFiles(listingId));
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [view, setView] = useState<"files" | "recycle-bin">("files");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [renameTarget, setRenameTarget] = useState<DealFileItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [moveTarget, setMoveTarget] = useState<DealFileItem | null>(null);
  const [moveDestination, setMoveDestination] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const path = useMemo(() => breadcrumbPath(items, currentFolderId), [items, currentFolderId]);

  const currentChildren = useMemo(
    () => childrenOf(items, currentFolderId),
    [items, currentFolderId],
  );
  const filteredChildren = search.trim()
    ? currentChildren.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()))
    : currentChildren;
  const sortedChildren = [...filteredChildren].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const allFolders = useMemo(
    () => items.filter((i) => i.kind === "folder" && !i.deletedAt),
    [items],
  );

  const trashedRoots = useMemo(() => {
    const deletedIds = new Set(items.filter((i) => i.deletedAt).map((i) => i.id));
    return items
      .filter((i) => i.deletedAt && !(i.parentId && deletedIds.has(i.parentId)))
      .sort((a, b) => (b.deletedAt! > a.deletedAt! ? 1 : -1));
  }, [items]);

  const moveOptions = useMemo(() => {
    if (!moveTarget) return allFolders;
    const excluded = descendantIds(items, moveTarget.id);
    excluded.add(moveTarget.id);
    return allFolders.filter((f) => !excluded.has(f.id));
  }, [moveTarget, allFolders, items]);
  const moveSelectItems = [
    { label: "Files (root)", value: "root" },
    ...moveOptions.map((f) => ({ label: f.name, value: f.id })),
  ];

  const allSelected =
    sortedChildren.length > 0 && sortedChildren.every((i) => selected.has(i.id));
  const someSelected = sortedChildren.some((i) => selected.has(i.id));

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of sortedChildren) checked ? next.add(i.id) : next.delete(i.id);
      return next;
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function addFiles(fileList: FileList | File[]) {
    const now = new Date().toISOString();
    const newItems: DealFileItem[] = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      kind: "file",
      parentId: currentFolderId,
      createdAt: now,
      sizeBytes: file.size,
      blob: file,
    }));
    for (const item of newItems) addDealFile(listingId, item);
    setItems((prev) => [...prev, ...newItems]);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        kind: "folder",
        parentId: currentFolderId,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewFolderName("");
    setCreateFolderOpen(false);
  }

  function openRename(item: DealFileItem) {
    setRenameTarget(item);
    setRenameValue(item.name);
  }

  function handleRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    setItems((prev) => prev.map((i) => (i.id === renameTarget.id ? { ...i, name } : i)));
    setRenameTarget(null);
  }

  function openMove(item: DealFileItem) {
    setMoveTarget(item);
    setMoveDestination(item.parentId);
  }

  function handleMove() {
    if (!moveTarget) return;
    setItems((prev) =>
      prev.map((i) => (i.id === moveTarget.id ? { ...i, parentId: moveDestination } : i)),
    );
    setMoveTarget(null);
  }

  function handleDelete(item: DealFileItem) {
    const now = new Date().toISOString();
    const ids = new Set([item.id, ...descendantIds(items, item.id)]);
    for (const id of ids) softDeleteDealFile(listingId, id);
    setItems((prev) => prev.map((i) => (ids.has(i.id) ? { ...i, deletedAt: now } : i)));
  }

  function handleRestore(item: DealFileItem) {
    const ids = new Set([item.id, ...descendantIds(items, item.id)]);
    setItems((prev) => prev.map((i) => (ids.has(i.id) ? { ...i, deletedAt: null } : i)));
  }

  function handleDeletePermanently(item: DealFileItem) {
    const ids = new Set([item.id, ...descendantIds(items, item.id)]);
    setItems((prev) => prev.filter((i) => !ids.has(i.id)));
  }

  function handleDownload(item: DealFileItem) {
    if (!item.blob) return;
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!listing) return null;

  return (
    <div className="d-flex flex-column gap-3 p-4" style={{ minWidth: 0 }}>
      <ListingPageHeader
        title="Files"
        actions={
          view === "files" ? (
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <Button variant="primary">
                    New
                    <FontAwesomeIcon icon={faCaretDown} />
                  </Button>
                }
              />
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onClick={() => fileInputRef.current?.click()}>
                  Upload File
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => setCreateFolderOpen(true)}>
                  Create Folder
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          ) : undefined
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Breadcrumb + search row */}
      <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
        <Breadcrumb>
          <Breadcrumb.List>
            <Breadcrumb.Item>
              {currentFolderId === null && view === "files" ? (
                <Breadcrumb.Page>Files</Breadcrumb.Page>
              ) : (
                <Breadcrumb.Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setView("files");
                    setCurrentFolderId(null);
                  }}
                >
                  Files
                </Breadcrumb.Link>
              )}
            </Breadcrumb.Item>
            {view === "files" &&
              path.map((folder, i) => (
                <Fragment key={folder.id}>
                  <Breadcrumb.Separator />
                  <Breadcrumb.Item>
                    {i === path.length - 1 ? (
                      <Breadcrumb.Page>{folder.name}</Breadcrumb.Page>
                    ) : (
                      <Breadcrumb.Link
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentFolderId(folder.id);
                        }}
                      >
                        {folder.name}
                      </Breadcrumb.Link>
                    )}
                  </Breadcrumb.Item>
                </Fragment>
              ))}
            {view === "recycle-bin" && (
              <>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  <Breadcrumb.Page>Recycle Bin</Breadcrumb.Page>
                </Breadcrumb.Item>
              </>
            )}
          </Breadcrumb.List>
        </Breadcrumb>

        {view === "files" && (
          <div style={{ minWidth: 240 }}>
            <InputGroup>
              <InputGroup.Addon>
                <FontAwesomeIcon icon={faMagnifyingGlass} />
              </InputGroup.Addon>
              <Input
                type="search"
                placeholder="Search this folder"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
          </div>
        )}
      </div>

      {view === "files" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          className={isDraggingOver ? "border border-primary rounded-3" : ""}
        >
          {sortedChildren.length === 0 ? (
            <Empty>
              <Empty.Media>
                <FontAwesomeIcon icon={faCloudArrowUp} aria-hidden />
              </Empty.Media>
              <Empty.Content>
                <Empty.Title>
                  {search.trim()
                    ? "No files match your search"
                    : "Drag files here or click to add files"}
                </Empty.Title>
              </Empty.Content>
              {!search.trim() && (
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <FontAwesomeIcon icon={faUpload} />
                  Upload File
                </Button>
              )}
            </Empty>
          ) : (
            <Table variant="sticky" dense>
              <Table.Header sticky>
                <Table.Row>
                  <Table.Head
                    sticky
                    style={{ left: 0, width: CHECKBOX_COL_W, minWidth: CHECKBOX_COL_W }}
                  >
                    <div className="position-absolute top-0 start-0 d-flex h-100 w-100 align-items-center justify-content-center">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={!allSelected && someSelected}
                        onCheckedChange={(c) => toggleAll(c === true)}
                        aria-label="Select all files"
                      />
                    </div>
                  </Table.Head>
                  <Table.Head sticky style={{ left: CHECKBOX_COL_W }}>
                    Name
                  </Table.Head>
                  <Table.Head>Size</Table.Head>
                  <Table.Head>Modified</Table.Head>
                  <Table.Head sticky="end" aria-label="Actions" />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sortedChildren.map((item) => (
                  <Table.Row key={item.id}>
                    <Table.Cell
                      sticky
                      style={{ left: 0, width: CHECKBOX_COL_W, minWidth: CHECKBOX_COL_W }}
                    >
                      <div className="position-absolute top-0 start-0 d-flex h-100 w-100 align-items-center justify-content-center">
                        <Checkbox
                          checked={selected.has(item.id)}
                          onCheckedChange={(c) => toggleOne(item.id, c === true)}
                          aria-label={`Select ${item.name}`}
                        />
                      </div>
                    </Table.Cell>
                    <Table.Cell sticky style={{ left: CHECKBOX_COL_W }}>
                      {item.kind === "folder" ? (
                        <button
                          type="button"
                          onClick={() => setCurrentFolderId(item.id)}
                          className="btn btn-link p-0 d-flex align-items-center gap-2 text-decoration-none text-body fw-semibold text-nowrap"
                        >
                          <FontAwesomeIcon icon={faFolder} />
                          {item.name}
                        </button>
                      ) : (
                        <span className="d-flex align-items-center gap-2 text-nowrap">
                          <FontAwesomeIcon icon={fileTypeIcon(item.name)} />
                          <span className="fw-semibold">{item.name}</span>
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell className="text-nowrap">
                      {item.kind === "file" ? formatBytes(item.sizeBytes) : "—"}
                    </Table.Cell>
                    <Table.Cell className="text-nowrap">{formatDate(item.createdAt)}</Table.Cell>
                    <Table.Cell sticky="end">
                      <div className="d-flex align-items-center gap-1">
                        {item.kind === "file" && (
                          <Tooltip>
                            <Tooltip.Trigger
                              render={
                                <span>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Download ${item.name}`}
                                    disabled={!item.blob}
                                    onClick={() => handleDownload(item)}
                                  >
                                    <FontAwesomeIcon icon={faDownload} />
                                  </Button>
                                </span>
                              }
                            />
                            <Tooltip.Content>
                              {item.blob
                                ? "Download"
                                : "Preview not available for demo files in this prototype"}
                            </Tooltip.Content>
                          </Tooltip>
                        )}
                        <DropdownMenu>
                          <DropdownMenu.Trigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`More actions for ${item.name}`}
                              >
                                <FontAwesomeIcon icon={faEllipsisVertical} />
                              </Button>
                            }
                          />
                          <DropdownMenu.Content align="end">
                            <DropdownMenu.Item onClick={() => openRename(item)}>
                              Rename
                            </DropdownMenu.Item>
                            <DropdownMenu.Item onClick={() => openMove(item)}>
                              Move
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator />
                            <DropdownMenu.Item onClick={() => handleDelete(item)}>
                              Delete
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
              <Table.Footer>
                <Table.Row>
                  <Table.Cell colSpan={5}>
                    <button
                      type="button"
                      onClick={() => setView("recycle-bin")}
                      className="btn btn-link p-0 d-flex align-items-center gap-2 text-decoration-none text-primary"
                    >
                      <FontAwesomeIcon icon={faTrashCan} />
                      Recycle Bin ({trashedRoots.length})
                    </button>
                  </Table.Cell>
                </Table.Row>
              </Table.Footer>
            </Table>
          )}
        </div>
      ) : trashedRoots.length === 0 ? (
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faTrashCan} aria-hidden />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>Recycle Bin is empty</Empty.Title>
          </Empty.Content>
        </Empty>
      ) : (
        <Table variant="sticky" dense>
          <Table.Header sticky>
            <Table.Row>
              <Table.Head sticky style={{ left: 0 }}>
                Name
              </Table.Head>
              <Table.Head>Deleted</Table.Head>
              <Table.Head sticky="end" aria-label="Actions" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {trashedRoots.map((item) => (
              <Table.Row key={item.id}>
                <Table.Cell sticky style={{ left: 0 }}>
                  <span className="d-flex align-items-center gap-2 text-nowrap">
                    <FontAwesomeIcon icon={item.kind === "folder" ? faFolder : fileTypeIcon(item.name)} />
                    <span className="fw-semibold">{item.name}</span>
                  </span>
                </Table.Cell>
                <Table.Cell className="text-nowrap">
                  {item.deletedAt ? formatDate(item.deletedAt) : "—"}
                </Table.Cell>
                <Table.Cell sticky="end">
                  <div className="d-flex align-items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleRestore(item)}>
                      <FontAwesomeIcon icon={faTrashCanArrowUp} />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${item.name} permanently`}
                      onClick={() => handleDeletePermanently(item)}
                    >
                      <FontAwesomeIcon icon={faTrashCan} />
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {/* Create Folder dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Create Folder</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Field>
              <Field.Label>Folder name</Field.Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                placeholder="Untitled Folder"
                autoFocus
              />
            </Field>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>Cancel</Dialog.Cancel>
            <Button variant="primary" onClick={handleCreateFolder}>
              Create
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>

      {/* Rename dialog */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Rename</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Field>
              <Field.Label>Name</Field.Label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                autoFocus
              />
            </Field>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>Cancel</Dialog.Cancel>
            <Button variant="primary" onClick={handleRename}>
              Save
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>

      {/* Move dialog */}
      <Dialog open={moveTarget !== null} onOpenChange={(open) => !open && setMoveTarget(null)}>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Move "{moveTarget?.name}"</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Field>
              <Field.Label>Destination folder</Field.Label>
              <Select
                items={moveSelectItems}
                value={moveDestination ?? "root"}
                onValueChange={(v) => setMoveDestination(v === "root" ? null : v)}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Choose a folder" />
                </Select.Trigger>
                <Select.Content>
                  {moveSelectItems.map((option) => (
                    <Select.Item key={option.value} value={option.value}>
                      {option.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </Field>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>Cancel</Dialog.Cancel>
            <Button variant="primary" onClick={handleMove}>
              Move
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </div>
  );
}
