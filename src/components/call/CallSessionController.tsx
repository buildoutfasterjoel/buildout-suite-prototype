import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faForwardStep, faXmark } from "@fortawesome/pro-regular-svg-icons";
import { getContact } from "#/data/store";
import { notify } from "#/lib/notify";
import { callFlow } from "#/components/call/callFlow";
import { useCallStore } from "#/components/call/useCallStore";
import { usePendingCallLog } from "#/components/call/usePendingCallLog";
import {
  currentSessionContactId,
  useCallSession,
} from "#/components/call/useCallSession";

/**
 * Drives a call session and renders its controls. Mounted once in the AppShell.
 *
 * Each time the session's index moves it lands the broker on that contact's
 * page and places the call, so the record they're looking at is always the
 * person on the line. Advancing is driven from the other side — the Log Call
 * modal's confirm — so a session never dials ahead of the broker.
 */
export function CallSessionController() {
  const navigate = useNavigate();
  const active = useCallSession((s) => s.active);
  const queue = useCallSession((s) => s.queue);
  const index = useCallSession((s) => s.index);
  const label = useCallSession((s) => s.label);
  const logged = useCallSession((s) => s.logged);

  // Which queue position we've already dialed, so re-renders don't redial.
  const dialedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      dialedRef.current = null;
      return;
    }
    // Ran off the end of the queue — report the run and close it out.
    if (index >= queue.length) {
      const total = queue.length;
      useCallSession.getState().end();
      notify({
        title: "Call session complete",
        description: `${logged} of ${total} call${total === 1 ? "" : "s"} logged.`,
      });
      return;
    }
    if (dialedRef.current === index) return;

    const contactId = currentSessionContactId({ active, queue, index });
    const contact = contactId ? getContact(contactId) : undefined;
    if (!contact) {
      // Gone from the book since the queue was built — don't stall the run.
      useCallSession.getState().skip();
      return;
    }
    dialedRef.current = index;
    void navigate({
      to: "/backoffice/contacts/$contactId",
      params: { contactId: contact.id },
    });
    callFlow.open(contact);
    // `logged` is read only for the completion toast; it must not retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, queue, navigate]);

  if (!active || index >= queue.length) return null;

  /** Drop whatever's in flight — a skip/stop shouldn't leave a call ringing. */
  const clearInFlight = () => {
    if (useCallStore.getState().phase !== "idle") callFlow.hangUp();
    usePendingCallLog.getState().clear();
  };

  return (
    <div className="call-session-bar">
      <span className="call-session-bar__count">
        Call {index + 1} of {queue.length}
      </span>
      {label && <span className="call-session-bar__label">{label}</span>}
      <div className="call-session-bar__actions">
        <button
          type="button"
          className="call-session-bar__btn"
          onClick={() => {
            clearInFlight();
            useCallSession.getState().skip();
          }}
        >
          <FontAwesomeIcon icon={faForwardStep} />
          Skip
        </button>
        <button
          type="button"
          className="call-session-bar__btn call-session-bar__btn--danger"
          onClick={() => {
            clearInFlight();
            useCallSession.getState().end();
            notify({
              title: "Call session ended",
              description: `${logged} call${logged === 1 ? "" : "s"} logged.`,
            });
          }}
        >
          <FontAwesomeIcon icon={faXmark} />
          End Session
        </button>
      </div>
    </div>
  );
}
