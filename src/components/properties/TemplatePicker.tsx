import { useMemo, useState } from "react";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { List } from "@buildoutinc/blueprint-react/ui/List";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/pro-regular-svg-icons";

/**
 * A *document* template — a whole deliverable (brochure, OM, proposal) in a
 * fixed page size. Distinct from the editor's page templates in
 * `features/editor/templates`, which are single pages inside a document.
 */
export type DocumentTemplate = {
  id: string;
  name: string;
  orientation: "landscape" | "portrait";
};

const ORIENTATION_LABEL: Record<DocumentTemplate["orientation"], string> = {
  landscape: 'Landscape 11"x8.5"',
  portrait: 'Portrait 8.5"x11"',
};

/** Landscape templates carry an "(L)" suffix, matching how Buildout names them. */
function template(
  id: string,
  name: string,
  orientation: DocumentTemplate["orientation"],
): DocumentTemplate {
  return {
    id,
    name: orientation === "landscape" ? `${name} (L)` : name,
    orientation,
  };
}

/** Templates this user has saved — duplicate names are real: same doc, different setup. */
const YOUR_TEMPLATES: DocumentTemplate[] = [
  template("yours-1", "Brochure", "landscape"),
  template("yours-2", "Offering Memorandum", "landscape"),
  template("yours-3", "Owner's Report", "landscape"),
  template("yours-4", "Proposal", "landscape"),
  template("yours-5", "Brochure", "portrait"),
  template("yours-6", "Offering Memorandum", "portrait"),
  template("yours-7", "Owner's Report", "portrait"),
  template("yours-8", "Proposal", "portrait"),
  template("yours-9", "Proposal", "landscape"),
  template("yours-10", "Brochure", "portrait"),
];

const DEFAULT_TEMPLATE_NAMES = [
  "Brochure",
  "Offering Memorandum",
  "Owner's Report",
  "Proposal",
  "Flyer",
  "Tour Book",
  "Executive Summary",
  "Market Report",
  "Property Report",
  "Investment Summary",
  "Lease Comparables",
  "Sale Comparables",
  "Broker Opinion of Value",
  "Availability Report",
  "Tenant Profile",
  "Rent Roll Summary",
  "Aerial Overview",
  "Site Plan Summary",
];

/** Every default ships in both orientations. */
const DEFAULT_TEMPLATES: DocumentTemplate[] = DEFAULT_TEMPLATE_NAMES.flatMap(
  (name, i) => [
    template(`default-${i}-l`, name, "landscape"),
    template(`default-${i}-p`, name, "portrait"),
  ],
);

const COMPANY_TEMPLATES: DocumentTemplate[] = [
  template("company-1", "Meridian Brochure", "landscape"),
  template("company-2", "Meridian Brochure", "portrait"),
  template("company-3", "Meridian Offering Memorandum", "landscape"),
  template("company-4", "Meridian Offering Memorandum", "portrait"),
  template("company-5", "Meridian Proposal", "landscape"),
  template("company-6", "Meridian Proposal", "portrait"),
  template("company-7", "Investment Sales Package", "landscape"),
  template("company-8", "Landlord Rep Pitch", "landscape"),
  template("company-9", "Tenant Rep Tour Book", "portrait"),
  template("company-10", "Quarterly Owner's Report", "portrait"),
];

const TABS: { value: string; label: string; templates: DocumentTemplate[] }[] = [
  { value: "yours", label: "Your Templates", templates: YOUR_TEMPLATES },
  { value: "default", label: "All default templates", templates: DEFAULT_TEMPLATES },
  { value: "company", label: "All company templates", templates: COMPANY_TEMPLATES },
];

/**
 * The template list: search over three tabs of saved, default, and company
 * templates. Extracted verbatim from NewDocumentModal when the modal became
 * AI-first — this is the "Choose from a template instead" path, and it behaves
 * exactly as the modal always did.
 */
export function TemplatePicker({
  onSelect,
}: {
  onSelect: (template: DocumentTemplate) => void;
}) {
  const [query, setQuery] = useState("");

  return (
    <div className="d-flex flex-column gap-3">
      <InputGroup>
        <InputGroup.Addon>
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </InputGroup.Addon>
        <Input
          type="search"
          placeholder="Search templates"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>

      <Tabs defaultValue="yours">
        <Tabs.List>
          {TABS.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label} ({tab.templates.length})
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Content>
          {TABS.map((tab) => (
            <Tabs.Panel key={tab.value} value={tab.value}>
              <TemplateList templates={tab.templates} query={query} onSelect={onSelect} />
            </Tabs.Panel>
          ))}
        </Tabs.Content>
      </Tabs>
    </div>
  );
}

function TemplateList({
  templates,
  query,
  onSelect,
}: {
  templates: DocumentTemplate[];
  query: string;
  onSelect: (template: DocumentTemplate) => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? templates.filter((t) => t.name.toLowerCase().includes(q)) : templates;
  }, [templates, query]);

  if (filtered.length === 0) {
    return (
      <Empty className="py-4">
        <Empty.Content>No templates match your search.</Empty.Content>
      </Empty>
    );
  }

  return (
    <List flush>
      {filtered.map((t) => (
        <List.Item
          key={t.id}
          asAction
          role="button"
          tabIndex={0}
          onClick={() => onSelect(t)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(t);
            }
          }}
        >
          <List.ItemContent>
            <List.ItemTitle className="fw-semibold">{t.name}</List.ItemTitle>
            <List.ItemDescription className="text-muted">
              {ORIENTATION_LABEL[t.orientation]}
            </List.ItemDescription>
          </List.ItemContent>
        </List.Item>
      ))}
    </List>
  );
}
