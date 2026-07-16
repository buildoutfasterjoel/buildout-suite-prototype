import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faMicrophoneSlash,
  faPhoneSlash,
} from "@fortawesome/pro-regular-svg-icons";
import type { LiveCall } from "#/components/contacts/useLiveCall";
import { formatDuration } from "#/components/contacts/useLiveCall";

/**
 * The full-width call bar that docks above the contact record while a simulated
 * call runs. Three states: "calling" (white slim countdown bar) and
 * "ringing"/"connected" (dark blue status bar). Purely presentational — all
 * transitions are owned by `useLiveCall`.
 */
export function LiveCallBar({
  call,
  onHangUp,
  onEndAndLog,
  onToggleMute,
}: {
  call: LiveCall;
  onHangUp: () => void;
  onEndAndLog: () => void;
  onToggleMute: () => void;
}) {
  if (call.phase === "calling") {
    return (
      <div className="contact-call-bar contact-call-bar--calling">
        <span className="contact-call-bar__avatar contact-call-bar__avatar--calling">
          {call.initials}
        </span>
        <div className="contact-call-bar__info">
          <div className="contact-call-bar__name">Calling {call.name}</div>
          <div className="contact-call-bar__meta">
            {call.phone} · audio starts at zero
          </div>
        </div>
        <span className="contact-call-bar__count">{call.countdown}</span>
        <button
          type="button"
          className="contact-call-bar__cancel"
          onClick={onHangUp}
        >
          Cancel
        </button>
      </div>
    );
  }

  const connected = call.phase === "connected";
  return (
    <div className="contact-call-bar contact-call-bar--live">
      <div className="contact-call-bar__status">
        <span className="contact-call-bar__pulse" aria-hidden="true" />
        <span className="contact-call-bar__status-label">
          {connected ? "LIVE" : "RINGING"}
        </span>
        {connected && <span className="contact-call-bar__conn">Connected</span>}
        <span className="contact-call-bar__timer">
          {formatDuration(call.elapsedSecs)}
        </span>
      </div>

      <div className="contact-call-bar__target">
        <span className="contact-call-bar__avatar">{call.initials}</span>
        <div className="contact-call-bar__info">
          <div className="contact-call-bar__name">{call.name}</div>
          <div className="contact-call-bar__meta">
            {call.entity} · {call.phone}
          </div>
        </div>
      </div>

      <div className="contact-call-bar__actions">
        <button
          type="button"
          className={`contact-call-bar__mute ${call.muted ? "is-active" : ""}`}
          onClick={onToggleMute}
        >
          <FontAwesomeIcon icon={call.muted ? faMicrophoneSlash : faMicrophone} />
          {call.muted ? "Muted" : "Mute"}
        </button>
        <button
          type="button"
          className="contact-call-bar__end"
          onClick={connected ? onEndAndLog : onHangUp}
        >
          <FontAwesomeIcon icon={faPhoneSlash} />
          {connected ? "End call & log" : "Hang up"}
        </button>
      </div>
    </div>
  );
}
