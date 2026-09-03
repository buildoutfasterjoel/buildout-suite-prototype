import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faMicrophone,
  faPaperclip,
  faPlus,
  faStop,
  faXmark,
} from "@fortawesome/pro-regular-svg-icons";
import { faMicrophone as faMicrophoneSolid } from "@fortawesome/pro-solid-svg-icons";

/** One picked file, as the composer displays it. */
type ComposerAttachment = { id: string; name: string; meta: string };

/** A `File` reduced to what the chip shows — "PDF · 240 KB". */
function describeFile(file: File): ComposerAttachment {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toUpperCase() : "FILE";
  const kb = Math.max(1, Math.round(file.size / 1024));
  const size = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
  return { id: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, meta: `${ext} · ${size}` };
}

/** Auto-grow cap — roughly six lines, after which the field scrolls. */
const MAX_FIELD_HEIGHT = 120;

/**
 * The Otto composer (Figma node 12:108), shared by the app-wide assistant rail
 * and the document editor's Otto panel so both look and behave identically.
 *
 * Presentation only, the same split as `ChatMessage`: the box owns its layout,
 * its auto-grow, its Enter/Shift+Enter handling, and the attachment chips, while
 * every surface keeps its own send path and its own mic behaviour and passes
 * them in. `.otto-composer` is global in `main.scss` and fluid — a full-width
 * value row, 28px controls, `min-width: 0` — so it fits the narrow editor rail
 * with no styles of its own.
 *
 * Attachment state lives HERE rather than in either parent: picked files never
 * leave the composer on either surface, so there is nothing for a parent to do
 * with them and no reason for two parents to hold the same dead state. They are
 * cleared whenever a message is sent.
 */
export function ChatComposer({
  draft,
  onDraftChange,
  onSubmit,
  isLoading,
  onStop,
  placeholder,
  listening,
  onMicToggle,
  micLabel,
  fieldRef,
  formRef,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  /** Send the draft. The composer clears its attachments; the parent clears the draft. */
  onSubmit: () => void;
  /** True mid-turn — swaps the send button for stop. */
  isLoading: boolean;
  onStop: () => void;
  placeholder: string;
  listening: boolean;
  onMicToggle: () => void;
  /** Accessible name for the mic, which differs while it is live. */
  micLabel?: { idle: string; live: string };
  /** Optional handles, for surfaces that focus the field or submit from elsewhere. */
  fieldRef?: React.RefObject<HTMLTextAreaElement | null>;
  formRef?: React.RefObject<HTMLFormElement | null>;
}) {
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const localFieldRef = useRef<HTMLTextAreaElement>(null);
  const field = fieldRef ?? localFieldRef;

  /**
   * Auto-grow: one line at rest, growing with the value to a cap after which it
   * scrolls, so a long prompt can't push the transcript off the top of the rail.
   */
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_FIELD_HEIGHT)}px`;
  }, [draft, field]);

  const submit = () => {
    setAttachments([]);
    onSubmit();
  };

  const labels = micLabel ?? { idle: "Speak to Otto", live: "Listening — tap to stop" };

  return (
    <form
      ref={formRef}
      // `--filled` swaps the grid template so the value lifts to its own row
      // above the controls; empty, the placeholder sits inline between them.
      className={`otto-composer${draft ? " otto-composer--filled" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {attachments.length > 0 && (
        <div className="otto-composer__files">
          {attachments.map((f) => (
            <span key={f.id} className="otto-composer__file">
              <FontAwesomeIcon icon={faPaperclip} className="flex-shrink-0" />
              <span className="otto-composer__file-label">
                <span className="otto-composer__file-name text-truncate">{f.name}</span>
                <span className="otto-composer__file-meta">{f.meta}</span>
              </span>
              <button
                type="button"
                className="otto-composer__file-remove"
                aria-label={`Remove ${f.name}`}
                onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== f.id))}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="otto-composer__body">
        {/* A textarea, not an Input: the value wraps onto as many lines as it
            needs (auto-grown above, to a cap) and the box, not the field,
            carries the border. Its position in the tree is FIXED — the
            resting/filled switch is CSS only, so typing the first character
            can't re-parent it and drop focus. */}
        <textarea
          ref={field}
          className="otto-composer__field"
          rows={1}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          aria-label="Message Otto"
          // Without this the browser offers its own form-history dropdown of
          // previously-typed prompts the moment the composer takes focus, which
          // reads as a stray suggestion bubble floating over the rail.
          autoComplete="off"
        />
        <div className="otto-composer__left">
          <button
            type="button"
            className="otto-composer__attach"
            aria-label="Attach a file"
            onClick={() => fileRef.current?.click()}
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="d-none"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length) setAttachments((prev) => [...prev, ...picked.map(describeFile)]);
              // Reset, so picking the same file twice still fires a change.
              e.target.value = "";
            }}
          />
        </div>
        <div className="otto-composer__right">
          {/* Mid-turn the right slot holds ONE control: a diminished ghost stop
              (Figma node 259:19429). The mic is unmounted rather than left
              alongside it — with two controls appearing and disappearing the
              stop shifts left as the turn starts and the mic lands where the
              stop just was, which is a misclick into "cancel the reply". */}
          {isLoading ? (
            <button
              type="button"
              className="otto-composer__stop"
              aria-label="Stop"
              onClick={onStop}
            >
              <FontAwesomeIcon icon={faStop} />
            </button>
          ) : (
            <>
              <button
                type="button"
                className={`otto-composer__mic${listening ? " is-live" : ""}`}
                aria-label={listening ? labels.live : labels.idle}
                onClick={onMicToggle}
              >
                {/* Solid while live, per the design: the glyph itself carries the
                    state, so the button reads as on even at a glance. */}
                <FontAwesomeIcon icon={listening ? faMicrophoneSolid : faMicrophone} />
              </button>
              {/* Send only exists once there's something to send (per the
                  design) — but never while the mic is live: dictation fills the
                  draft word by word, and mounting send mid-sentence shoves the
                  live mic 36px left, out from under the cursor that is about to
                  tap it to stop. The silence pause sends; the mic cancels. */}
              {draft.trim() && !listening && (
                <button type="submit" className="otto-composer__send" aria-label="Send">
                  <FontAwesomeIcon icon={faArrowUp} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </form>
  );
}
