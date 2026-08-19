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
 * The cards deliberately do NOT say which files they use. Every selected file
 * contributes its sections whatever template is picked — the template supplies
 * only the spine — so naming a subset would misdescribe what happens, and the
 * card would grow with each file selected.
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
              // Equal thirds on one row. A 200px basis was right while the cards
              // carried a line of filenames; without it they wrap 2 + 1, and the
              // lone card stretches to full width. minWidth: 0 lets a long name
              // truncate rather than force a wrap.
              style={{ cursor: "pointer", flex: "1 1 0", minWidth: 0 }}
              onClick={() => onSelect(suggestion.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(suggestion.name);
                }
              }}
            >
              <Card.Body className="p-2">
                <span className="d-flex align-items-center gap-2">
                  <FontAwesomeIcon
                    icon={active ? faCircleCheck : faCircle}
                    className={active ? "text-primary" : "text-muted opacity-50"}
                  />
                  <span className="fw-medium text-truncate" title={suggestion.name}>
                    {suggestion.name}
                  </span>
                  {suggestion.bestFit && (
                    // The name truncates; the badge must not. Without these it
                    // gets squeezed by the name and breaks across two lines.
                    <Badge
                      variant="secondary"
                      appearance="accent"
                      className="flex-shrink-0 text-nowrap"
                    >
                      Best fit
                    </Badge>
                  )}
                </span>
              </Card.Body>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
