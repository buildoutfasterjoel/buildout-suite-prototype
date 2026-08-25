import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
// Solid, deliberately: the avatar's glyph is a silhouette on a pale disc, and
// the regular weight reads as a hairline outline at 14px.
import { faOtter } from "@fortawesome/pro-solid-svg-icons";
import { useHeroOffer } from "#/ai/heroOffer";
import type { GreetingParts } from "#/ai/voice/greeting";

/**
 * A starter prompt. Every chip maps to a tool that actually runs — none of them
 * advertises a capability the prototype doesn't have.
 */
export interface StarterPrompt {
  icon: IconDefinition;
  label: string;
  sublabel: string;
  prompt: string;
}

/**
 * The rail's home screen (Figma node 193:4366) — where Otto opens, every time.
 *
 * The old rail opened straight into a transcript, which meant the greeting, the
 * offer and the starter prompts were all just early messages: they scrolled away
 * and never came back. Here they're a *place* instead. Otto's mark and name sit
 * inside the greeting rather than in the header (which is why the header hides
 * its avatar on this view), the headline carries the gradient, and the one
 * question that expects an answer is bold with its two buttons directly beneath.
 *
 * The content block is vertically centred: on a tall rail an empty transcript
 * pinned to the top reads as a page that failed to load.
 */
export function OttoHome({
  greeting,
  starters,
  onPick,
  onCall,
  onBrief,
}: {
  /** Null until the session greeting fires — the block simply isn't there yet. */
  greeting: GreetingParts | null;
  starters: StarterPrompt[];
  onPick: (prompt: string) => void;
  onCall: () => void;
  onBrief: () => void;
}) {
  // Read reactively so the buttons disappear the moment the offer is answered or
  // cleared, rather than lingering over a question that's already been settled.
  const offer = useHeroOffer((s) => s.pendingOffer);

  return (
    <div className="assistant-home">
      <div className="d-flex flex-column" style={{ gap: 12 }}>
        <div className="d-flex align-items-center" style={{ gap: 10 }}>
          <span className="assistant-rail__avatar">
            <FontAwesomeIcon icon={faOtter} />
          </span>
          <div className="d-flex flex-column" style={{ minWidth: 0 }}>
            <span className="assistant-rail__title text-truncate">Otto</span>
            <span className="assistant-rail__subtitle text-truncate">
              Your Buildout assistant
            </span>
          </div>
        </div>

        {greeting && (
          <div className="d-flex flex-column" style={{ gap: 12 }}>
            <div className="d-flex flex-column" style={{ gap: 4 }}>
              <p className="assistant-home__headline mb-0">{greeting.headline}</p>
              <p className="mb-0">
                {greeting.lead} <span className="fw-semibold">{greeting.offer}</span>
              </p>
            </div>
            {offer && (
              <div className="d-flex align-items-center gap-2">
                <Button size="sm" variant="primary" onClick={onCall}>
                  Yes, call now
                </Button>
                <Button size="sm" variant="outline" onClick={onBrief}>
                  Brief me first
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Starter prompts (Figma node 193:4388). Stripped back from the bordered,
          shadowed cards they used to be: on the home screen they're the only
          other thing on the page, so they no longer have to fight for attention —
          a gradient disc and a title with its hint trailing on the same line. */}
      <div className="d-flex flex-column gap-2">
        {starters.map((s) => (
          <button
            key={s.label}
            type="button"
            className="assistant-starter-row"
            onClick={() => onPick(s.prompt)}
          >
            <span className="assistant-starter-row__icon">
              <FontAwesomeIcon icon={s.icon} />
            </span>
            <span className="assistant-starter-row__text">
              <span className="assistant-starter-row__title">{s.label}</span>
              <span className="assistant-starter-row__subtitle">{s.sublabel}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
