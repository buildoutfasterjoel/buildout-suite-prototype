import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faMicrophoneSlash,
  faPhoneSlash,
  faPhoneArrowUpRight,
} from "@fortawesome/pro-regular-svg-icons";
import { useCallStore } from "#/components/call/useCallStore";
import { formatDuration } from "#/components/call/ringtone";
import { callFlow } from "#/components/call/callFlow";
import { useCallSession } from "#/components/call/useCallSession";

/**
 * The global live-call bar (Phase-3 design §3). Renders from useCallStore and
 * drives callFlow. Docks full-width above the app content: a countdown while
 * dialing (with "Dial now" to skip the wait), then the live status, timer, and
 * mute / end controls.
 */
export function LiveCallBar() {
  const phase = useCallStore((s) => s.phase);
  const target = useCallStore((s) => s.target);
  const countdown = useCallStore((s) => s.countdown);
  const elapsedSecs = useCallStore((s) => s.elapsedSecs);
  const muted = useCallStore((s) => s.muted);
  // In a call session the session bar owns stopping/skipping, so the bar drops
  // its own Cancel rather than offering two competing ways out.
  const inSession = useCallSession((s) => s.active);

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
        <button
          type="button"
          className="contact-call-bar__dial"
          onClick={() => callFlow.dialNow()}
        >
          <FontAwesomeIcon icon={faPhoneArrowUpRight} />
          Dial now
        </button>
        {!inSession && (
          <button
            type="button"
            className="contact-call-bar__cancel"
            onClick={() => callFlow.hangUp()}
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  const connected = phase === "connected";

  return (
    <div className="contact-call-bar contact-call-bar--live">
      <div className="d-flex align-items-center gap-3 flex-wrap w-100">
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
            onClick={() =>
              connected
                ? void callFlow.endCall()
                : // Ringing with nobody picking up: in a session that's a
                  // no-answer worth logging; standalone it's just abandoned.
                  inSession
                  ? callFlow.noAnswer()
                  : callFlow.hangUp()
            }
          >
            <FontAwesomeIcon icon={faPhoneSlash} />
            {connected ? "End call & log" : inSession ? "No answer" : "Hang up"}
          </button>
        </div>
      </div>
    </div>
  );
}
