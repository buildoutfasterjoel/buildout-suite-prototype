import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faEllipsisVertical,
  faCaretDown,
  faFileLines,
  faGear,
  faShareNodes,
  faEyeSlash,
  faCloudArrowUp,
  faPenToSquare,
  faTrashCan,
  faCircleInfo,
} from "@fortawesome/pro-regular-svg-icons";
import type { Property } from "#/data/types";

type Document = {
  id: string;
  name: string;
  adminBadge: boolean;
  accessLevel: "Private" | "Public" | "Restricted";
  lastModified: string;
  primary: boolean;
  viewCount: number;
};

const DOCUMENTS: Document[] = [
  {
    id: "1",
    name: "Offering Memorandum (L)",
    adminBadge: true,
    accessLevel: "Private",
    lastModified: "about 2 months ago",
    primary: false,
    viewCount: 0,
  },
  {
    id: "2",
    name: "Floor Plan",
    adminBadge: false,
    accessLevel: "Public",
    lastModified: "about 3 weeks ago",
    primary: true,
    viewCount: 14,
  },
  {
    id: "3",
    name: "Executive Summary",
    adminBadge: false,
    accessLevel: "Restricted",
    lastModified: "about 1 week ago",
    primary: false,
    viewCount: 7,
  },
];

const CHECKBOX_COL_W = 44;

export function PropertyDetailDocuments({ property }: { property: Property }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = search.trim()
    ? DOCUMENTS.filter((d) =>
        d.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : DOCUMENTS;

  const allSelected =
    filtered.length > 0 && filtered.every((d) => selected.has(d.id));
  const someSelected = filtered.some((d) => selected.has(d.id));

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const d of filtered) checked ? next.add(d.id) : next.delete(d.id);
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  return (
    <div className="d-flex flex-column gap-3 p-4" style={{ minWidth: 0 }}>
      {/* Title row */}
      <div className="d-flex align-items-center gap-3">
        <h2 className="fs-4 mb-0 flex-grow-1">Documents</h2>
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="outline">
                <FontAwesomeIcon icon={faShareNodes} />
                Share
                <FontAwesomeIcon icon={faCaretDown} />
              </Button>
            }
          />
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item>Copy Link</DropdownMenu.Item>
            <DropdownMenu.Item>Download All</DropdownMenu.Item>
            <DropdownMenu.Item>Embed</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
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
            <DropdownMenu.Item>Upload File</DropdownMenu.Item>
            <DropdownMenu.Item>Create Folder</DropdownMenu.Item>
            <DropdownMenu.Item>Request Document</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>

      {/* Filter + search row */}
      <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
        <div className="d-flex gap-2">
          <Button variant="outline">
            <FontAwesomeIcon icon={faFileLines} />
            My Documents
          </Button>
          <Button variant="outline">
            <FontAwesomeIcon icon={faGear} />
            Access Settings
          </Button>
        </div>
        <div style={{ minWidth: 240 }}>
          <InputGroup>
            <InputGroup.Addon>
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </InputGroup.Addon>
            <Input
              type="search"
              placeholder="Search documents"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
        </div>
      </div>

      {/* Drop zone */}
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={faCloudArrowUp} aria-hidden />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Drag documents here or click to add files</Empty.Title>
        </Empty.Content>
      </Empty>

      {/* Table */}
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
                  aria-label="Select all documents"
                />
              </div>
            </Table.Head>
            <Table.Head sticky style={{ left: CHECKBOX_COL_W }}>
              Name
            </Table.Head>
            <Table.Head>Access Level</Table.Head>
            <Table.Head>Last Modified</Table.Head>
            <Table.Head>
              Primary{" "}
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <span className="ms-1" style={{ cursor: "default" }}>
                      <FontAwesomeIcon icon={faCircleInfo} />
                    </span>
                  }
                />
                <Tooltip.Content>
                  The primary document is shown by default on the listing website.
                </Tooltip.Content>
              </Tooltip>
            </Table.Head>
            <Table.Head>View Count</Table.Head>
            <Table.Head sticky="end" aria-label="Actions" />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {filtered.map((doc) => (
            <Table.Row key={doc.id}>
              <Table.Cell
                sticky
                style={{ left: 0, width: CHECKBOX_COL_W, minWidth: CHECKBOX_COL_W }}
              >
                <div className="position-absolute top-0 start-0 d-flex h-100 w-100 align-items-center justify-content-center">
                  <Checkbox
                    checked={selected.has(doc.id)}
                    onCheckedChange={(c) => toggleOne(doc.id, c === true)}
                    aria-label={`Select ${doc.name}`}
                  />
                </div>
              </Table.Cell>
              <Table.Cell sticky style={{ left: CHECKBOX_COL_W }}>
                <span className="d-flex align-items-center gap-2 text-nowrap">
                  <FontAwesomeIcon icon={faFileLines} />
                  <span className="fw-semibold">{doc.name}</span>
                  {doc.adminBadge && (
                    <span className="text-muted fs-small">(admin)</span>
                  )}
                </span>
              </Table.Cell>
              <Table.Cell>
                {doc.accessLevel === "Private" ? (
                  <span className="d-flex align-items-center gap-2 text-muted text-nowrap">
                    <FontAwesomeIcon icon={faEyeSlash} />
                    Private
                  </span>
                ) : (
                  <span className="text-nowrap">{doc.accessLevel}</span>
                )}
              </Table.Cell>
              <Table.Cell className="text-nowrap">{doc.lastModified}</Table.Cell>
              <Table.Cell>{doc.primary ? "Yes" : "0"}</Table.Cell>
              <Table.Cell>{doc.viewCount}</Table.Cell>
              <Table.Cell sticky="end">
                <div className="d-flex align-items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <Link to="/editor/$listingId" params={{ listingId: property.id }} />
                    }
                  >
                    <FontAwesomeIcon icon={faPenToSquare} />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenu.Trigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`More actions for ${doc.name}`}
                        >
                          <FontAwesomeIcon icon={faEllipsisVertical} />
                        </Button>
                      }
                    />
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Item>Download</DropdownMenu.Item>
                      <DropdownMenu.Item>Rename</DropdownMenu.Item>
                      <DropdownMenu.Item>Move</DropdownMenu.Item>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item>Delete</DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
        <Table.Footer>
          <Table.Row>
            <Table.Cell colSpan={7}>
              <span className="d-flex align-items-center gap-2 text-primary">
                <FontAwesomeIcon icon={faTrashCan} />
                Recycle Bin (0)
              </span>
            </Table.Cell>
          </Table.Row>
        </Table.Footer>
      </Table>
    </div>
  );
}
