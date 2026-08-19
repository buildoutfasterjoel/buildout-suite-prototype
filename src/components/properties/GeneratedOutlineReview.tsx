import { List } from "@buildoutinc/blueprint-react/ui/List";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines, faWandMagicSparkles } from "@fortawesome/pro-regular-svg-icons";
import type { GeneratedSection } from "#/data/types";
import type { SourceFileRef } from "#/data/documentGeneration";

/**
 * The outline, credited back to what produced it. Read-only on purpose: the
 * editor's page rail already reorders and deletes pages, so an editable review
 * would be a second, weaker copy of that.
 */
export function GeneratedOutlineReview({
  sections,
  docType,
  instructions,
  unusedFiles,
}: {
  sections: GeneratedSection[];
  /** Named in the spine sections' description, e.g. "in every Offering Memorandum". */
  docType: string;
  instructions: string;
  /** Selected files that contributed no section — named rather than silently dropped. */
  unusedFiles: SourceFileRef[];
}) {
  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <span className="fw-semibold">{sections.length} sections</span>
        <List flush>
          {sections.map((section, i) => (
            <List.Item key={`${section.templateKey}-${i}`}>
              <List.ItemContent>
                <List.ItemTitle className="fw-medium">
                  <FontAwesomeIcon icon={faFileLines} className="text-muted" /> {section.name}
                </List.ItemTitle>
                <List.ItemDescription className="text-muted">
                  {section.origin === "file" && `from ${section.sourceFileName}`}
                  {section.origin === "instruction" && (
                    <>
                      <FontAwesomeIcon icon={faWandMagicSparkles} /> from your instructions
                    </>
                  )}
                  {section.origin === "spine" && `in every ${docType}`}
                </List.ItemDescription>
              </List.ItemContent>
            </List.Item>
          ))}
        </List>
      </div>

      {instructions.trim() && (
        <div>
          <span className="fw-semibold">Your instructions</span>
          <p className="text-muted mb-0">{instructions.trim()}</p>
        </div>
      )}

      {unusedFiles.length > 0 && (
        <div>
          <span className="fw-semibold">Reviewed, no section added</span>
          <div className="d-flex flex-wrap gap-2 mt-1">
            {unusedFiles.map((f) => (
              <Badge key={f.id} variant="secondary" appearance="muted">
                {f.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
