import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faMicrophoneSlash,
  faPhoneSlash,
  faPaperPlaneTop,
} from "@fortawesome/pro-regular-svg-icons";
import { useCallStore } from "#/components/call/useCallStore";
import { formatDuration } from "#/components/call/ringtone";
import { callFlow } from "#/components/call/callFlow";

/**
 * The global live-call bar (Phase-3 design §3). Renders from useCallStore and
 * drives callFlow. Docks full-width above the app content; on connect it expands
 * to carry the transcript, the owner's suggested broker lines, and a type-a-line
 * input. Broker input during a call is chips/typing only — never voice (§5.3).
 */
export function LiveCallBar() {
  const phase = useCallStore((s) => s.phase);
  const target = useCallStore((s) => s.target);
  const countdown = useCallStore((s) => s.countdown);
  const elapsedSecs = useCallStore((s) => s.elapsedSecs);
  const muted = useCallStore((s) => s.muted);
  const transcript = useCallStore((s) => s.transcript);
  const suggestions = useCallStore((s) => s.suggestions);
  const awaitingOwner = useCallStore((s) => s.awaitingOwner);
  const shouldEnd = useCallStore((s) => s.shouldEnd);
  const [draft, setDraft] = useState("");

  if (phase === "idle" || !target) return null;

  if (phase === "calling") {
    return (
      <div className="contact-call-bar contact-call-bar--calling">
        <span className="contact-call-bar__avatar contact-call-bar__avatar--calling">
          {target.initials}
        </span>
        <div className="contact-call-bar__info">
          <div className="contact-call-bar__name">Calling {target.name}</div>
          <div className="contact-call-bar__meta">{target.phone} · audio starts at zero</div>
        </div>
        <span className="contact-call-bar__count">{countdown}</span>
        <button type="button" className="contact-call-bar__cancel" onClick={() => callFlow.hangUp()}>
          Cancel
        </button>
      </div>
    );
  }

  const connected = phase === "connected";

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft("");
    callFlow.submitLine(t);
  };

  return (
    <div className="contact-call-bar contact-call-bar--live d-flex flex-column">
      <div className="d-flex align-items-center gap-3 flex-wrap">
        <div className="contact-call-bar__status">
          <span className="contact-call-bar__pulse" aria-hidden="true" />
          <span className="contact-call-bar__status-label">{connected ? "LIVE" : "RINGING"}</span>
          {connected && <span className="contact-call-bar__conn">Connected</span>}
          <span className="contact-call-bar__timer">{formatDuration(elapsedSecs)}</span>
        </div>

        <div className="contact-call-bar__target">
          <span className="contact-call-bar__avatar">{target.initials}</span>
          <div className="contact-call-bar__info">
            <div className="contact-call-bar__name">{target.name}</div>
            <div className="contact-call-bar__meta">
              {target.entity} · {target.phone}
            </div>
          </div>
        </div>

        <div className="contact-call-bar__actions ms-auto">
          <button
            type="button"
            className={`contact-call-bar__mute ${muted ? "is-active" : ""}`}
            onClick={() => callFlow.toggleMute()}
          >
            <FontAwesomeIcon icon={muted ? faMicrophoneSlash : faMicrophone} />
            {muted ? "Muted" : "Mute"}
          </button>
          <button
            type="button"
            className="contact-call-bar__end"
            onClick={() => (connected ? void callFlow.endCall() : callFlow.hangUp())}
          >
            <FontAwesomeIcon icon={faPhoneSlash} />
            {connected ? "End call & log" : "Hang up"}
          </button>
        </div>
      </div>

      {connected && (
        <div className="contact-call-bar__panel">
          <div className="contact-call-bar__transcript">
            {transcript.length === 0 && (
              <div className="contact-call-bar__hint">Connecting you…</div>
            )}
            {transcript.map((l) => (
              <div
                key={l.id}
                className={`contact-call-bar__line contact-call-bar__line--${l.speaker}`}
              >
                <span className="contact-call-bar__speaker">
                  {l.speaker === "you" ? "You" : target.firstName}
                </span>
                <span>{l.text}</span>
              </div>
            ))}
            {awaitingOwner && (
              <div className="contact-call-bar__hint">{target.firstName} is responding…</div>
            )}
          </div>

          {shouldEnd && (
            <div className="contact-call-bar__wrapup">Wrapping up — hang up when ready.</div>
          )}

          {suggestions.length > 0 && (
            <div className="contact-call-bar__chips">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="contact-call-bar__chip"
                  disabled={awaitingOwner}
                  onClick={() => callFlow.submitLine(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="contact-call-bar__compose d-flex align-items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              className="form-control form-control-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Say something to ${target.firstName}…`}
              aria-label="Your line"
              disabled={awaitingOwner}
            />
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              aria-label="Send line"
              disabled={awaitingOwner || !draft.trim()}
            >
              <FontAwesomeIcon icon={faPaperPlaneTop} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
