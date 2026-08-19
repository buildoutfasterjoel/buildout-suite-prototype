import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faCircle } from "@fortawesome/pro-regular-svg-icons";
import type { TemplateName, TemplateSuggestion } from "#/data/documentGeneration";

/**
 * What document the selected files should become. The broker does not declare a
 * document type — the AI proposes a template and they confirm or override it, so
 * the best fit arrives preselected and Generate works without a single click here.
 *
 * Each card names the files it actually uses, which is what keeps the suggestion
 * legible rather than magic: "best fit" means something you can read.
 */
export function DocumentSuggestions({
  suggestions,
  selected,
  onSelect,
}: {
  suggestions: TemplateSuggestion[];
  selected: TemplateName;
  onSelect: (name: TemplateName) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="d-flex flex-column gap-2">
      <span className="fw-semibold">Based on these files, we&rsquo;d make</span>
      <div className="d-flex flex-wrap gap-2">
        {suggestions.map((suggestion) => {
          const active = suggestion.name === selected;
          return (
            <Card
              key={suggestion.name}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              className={active ? "border-primary" : undefined}
              style={{ cursor: "pointer", flex: "1 1 200px", minWidth: 0 }}
              onClick={() => onSelect(suggestion.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(suggestion.name);
                }
              }}
            >
              <Card.Body className="p-2 d-flex flex-column gap-1">
                <span className="d-flex align-items-center gap-2">
                  <FontAwesomeIcon
                    icon={active ? faCircleCheck : faCircle}
                    className={active ? "text-primary" : "text-muted opacity-50"}
                  />
                  <span className="fw-medium text-truncate">{suggestion.name}</span>
                  {suggestion.bestFit && (
                    <Badge variant="secondary" appearance="accent">
                      Best fit
                    </Badge>
                  )}
                </span>
                <span className="d-block text-muted fs-small">
                  {suggestion.usesFileNames.length > 0
                    ? `Uses ${formatFileList(suggestion.usesFileNames)}`
                    : "Uses none of the selected files"}
                </span>
              </Card.Body>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/** "a.pdf", "a.pdf and b.xlsx", "a.pdf, b.xlsx and c.zip". */
function formatFileList(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
