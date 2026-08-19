import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { SuggestionCard } from "#/data/documentGeneration";

/**
 * The suggestion deck. Clicking a card appends its sentence to the
 * instructions textarea; clicking again removes it — the textarea stays the
 * single source of truth, there is no hidden "selected suggestions" state.
 */
export function InstructionSuggestions({
  cards,
  instructions,
  onToggle,
}: {
  cards: SuggestionCard[];
  instructions: string;
  onToggle: (card: SuggestionCard, add: boolean) => void;
}) {
  if (cards.length === 0) return null;

  return (
    <div className="d-flex flex-column gap-2">
      <span className="form-text mb-0">Suggested additions</span>
      <div className="d-flex flex-wrap gap-2">
        {cards.map((card) => {
          const active = instructions.includes(card.sentence);
          return (
            <Card
              key={card.id}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              className={active ? "border-primary" : undefined}
              style={{ cursor: "pointer", flex: "1 1 220px" }}
              onClick={() => onToggle(card, !active)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggle(card, !active);
                }
              }}
            >
              <Card.Body className="p-2">
                <span className="d-flex align-items-center gap-2 fw-medium">
                  <FontAwesomeIcon
                    icon={active ? faCheck : faPlus}
                    className={active ? "text-accent" : "text-muted"}
                  />
                  {card.title}
                </span>
                <span className="d-block text-muted fs-small">{card.effect}</span>
              </Card.Body>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
