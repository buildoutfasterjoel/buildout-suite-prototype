import { useMemo, useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPlus, faTag } from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { addContactTags, removeContactTags } from "#/data/actions";

/**
 * The "+" beside a contact's tags: a picker over the tags the book already
 * uses, with free text for a genuinely new one.
 *
 * Existing tags come first and are toggled from the list, deliberately. The tag
 * facet on the People page is derived from the contacts themselves, so a second
 * spelling of the same idea ("Investor" / "investors") splits one segment into
 * two filters that each find half the book. That is the same reason the
 * assistant's `add_contact_tags` is told to read `contact_tags` first — the
 * broker doing it by hand needs the same nudge, and a list they can see beats a
 * blank box every time.
 *
 * Creating is still one keystroke away: type something the book has never seen
 * and the first row becomes "Create". Nothing here is a dead end.
 */
export function ContactTagPicker({ contact }: { contact: Contact }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Subscribe to the map so the checkmarks track what the toggles just wrote —
  // and what the assistant writes while this is open.
  const contacts = useDataStore((s) => s.contacts);

  const on = useMemo(
    () => new Set(contact.tags.map((t) => t.toLowerCase())),
    [contact.tags],
  );

  /** Every tag in use across the book, so the broker reuses before inventing. */
  const inUse = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of contacts.values()) {
      for (const t of c.tags) if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const typed = query.trim();
  const matches = typed
    ? inUse.filter((t) => t.toLowerCase().includes(typed.toLowerCase()))
    : inUse;
  // Only offer to create what isn't already a tag somewhere in the book.
  const canCreate =
    typed.length > 0 && !inUse.some((t) => t.toLowerCase() === typed.toLowerCase());

  const toggle = (tag: string) => {
    if (on.has(tag.toLowerCase())) removeContactTags(contact.id, [tag]);
    else addContactTags(contact.id, [tag]);
  };

  const create = () => {
    if (!canCreate) return;
    addContactTags(contact.id, [typed]);
    setQuery("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <Popover.Trigger
        render={
          <Button variant="ghost" appearance="muted" size="icon-sm" aria-label="Add tags">
            <FontAwesomeIcon icon={faPlus} />
          </Button>
        }
      />
      <Popover.Content align="start" sideOffset={4} style={{ width: 260 }}>
        <Popover.Body className="d-flex flex-column gap-2 p-2">
          <Input
            value={query}
            autoFocus
            placeholder="Find or create a tag"
            aria-label="Find or create a tag"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              // Enter takes the obvious action: create what's new, otherwise
              // toggle the one match. With several matches it does nothing —
              // guessing which one the broker meant is worse than waiting.
              if (canCreate) create();
              else if (matches.length === 1) toggle(matches[0]);
            }}
          />
          <div className="contact-tag-picker__list">
            {canCreate && (
              <button type="button" className="contact-tag-picker__row" onClick={create}>
                <FontAwesomeIcon icon={faPlus} className="contact-tag-picker__icon" />
                <span className="text-truncate">
                  Create “<strong>{typed}</strong>”
                </span>
              </button>
            )}
            {matches.map((tag) => {
              const applied = on.has(tag.toLowerCase());
              return (
                <button
                  key={tag}
                  type="button"
                  className={`contact-tag-picker__row${applied ? " is-applied" : ""}`}
                  aria-pressed={applied}
                  onClick={() => toggle(tag)}
                >
                  <FontAwesomeIcon
                    icon={applied ? faCheck : faTag}
                    className="contact-tag-picker__icon"
                  />
                  <span className="text-truncate">{tag}</span>
                </button>
              );
            })}
            {!matches.length && !canCreate && (
              <div className="text-muted fs-small px-2 py-1">No tags yet — type to create one.</div>
            )}
          </div>
        </Popover.Body>
      </Popover.Content>
    </Popover>
  );
}
