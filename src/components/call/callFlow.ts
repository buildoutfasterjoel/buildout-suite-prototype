import type { Contact } from "#/data/types";
import { useCallStore } from "./useCallStore";
import { playOneRing, playAnsweredCue } from "./ringtone";
import { voiceEngine } from "#/ai/voice/voiceEngine";
import { ownerVoiceFor } from "#/ai/voice/ownerVoice";
import { generateCallTurn, generateCallRecap } from "#/ai/generate";
import { contactFullName, contactInitials } from "#/components/contacts/contactDisplay";
import { usePendingCallLog } from "./usePendingCallLog";
import { composeCallNotes } from "./callNotes";
import { getContact } from "#/data/store";
import { isHeroCall } from "./heroRecapExtensions";
import { signalText } from "#/data/signal";

/**
 * Imperative live-call controller (Phase-3 design §3/§4). Owns the phase timers,
 * ring tones, owner-turn fetches, and owner-voice playback — the messy work that
 * mustn't live in React, so start_call/the Phase-4 director can drive a call from
 * anywhere. Reactive state lives in useCallStore; audio in voiceEngine.
 */

// The sidebar registers its hands-free stopForCall here so a call can hard-stop
// the mic even though callFlow lives outside React (§7). No-op if unregistered
// (sidebar closed → no live mic anyway).
let _stopForCall: (() => void) | null = null;
export function registerStopForCall(fn: (() => void) | null) {
  _stopForCall = fn;
}

// A monotonic session id: every open/hangUp/endCall bumps it, so an in-flight
// owner-turn or recap fetch that resolves after the call moved on is dropped.
let session = 0;
let timers: ReturnType<typeof setTimeout>[] = [];
let ticker: ReturnType<typeof setInterval> | null = null;
let ringLoop: ReturnType<typeof setInterval> | null = null;
let connectedAt = 0;

/** The owner-persona note is the broker's strategic note only — strip the dated
 * call-log lines addNote() appends when a call is logged, so a prior call's
 * recap never feeds back into the next call's role-play. */
export function personaNote(notes: string | undefined): string {
  if (!notes) return "";
  return notes
    .split("\n")
    .filter((l) => !/^\d{4}-\d{2}-\d{2}: Call with /.test(l))
    .join("\n")
    .trim();
}

function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms));
}
function stopRing() {
  if (ringLoop) {
    clearInterval(ringLoop);
    ringLoop = null;
  }
}
function clearAll() {
  timers.forEach(clearTimeout);
  timers = [];
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
  stopRing();
}

async function runOwnerTurn(brokerLine: string) {
  const mySession = session;
  const st = useCallStore.getState();
  const target = st.target;
  if (!target) return;
  st.setAwaitingOwner(true);
  const history = st.transcript.map((l) => ({ speaker: l.speaker, text: l.text }));
  let res;
  try {
    res = await generateCallTurn({
      data: {
        candidate: {
          name: target.name,
          role: target.role,
          entity: target.entity,
          note: target.note,
          phone: target.phone,
        },
        property: target.signalText ? { signal: target.signalText } : null,
        history,
        brokerLine,
      },
    });
  } catch {
    res = { ownerReply: "Mhm, go on.", suggestions: [], shouldEnd: false };
  }
  // Superseded (hung up / new call) or no longer connected → drop silently.
  if (mySession !== session || useCallStore.getState().phase !== "connected") return;
  const store = useCallStore.getState();
  store.appendLine("them", res.ownerReply);
  store.setSuggestions(res.suggestions);
  store.setShouldEnd(res.shouldEnd);
  store.setAwaitingOwner(false);
  void voiceEngine.speak(res.ownerReply, {
    voiceId: ownerVoiceFor({ id: target.contactId, firstName: target.firstName }),
  });
}

function toConnected() {
  stopRing();
  playAnsweredCue();
  connectedAt = Date.now();
  useCallStore.setState({ phase: "connected", elapsedSecs: 0 });
  ticker = setInterval(() => {
    useCallStore.getState().setElapsed(Math.floor((Date.now() - connectedAt) / 1000));
  }, 500);
  void runOwnerTurn(""); // the owner answers first
}

function startRing() {
  stopRing();
  if (!useCallStore.getState().muted) playOneRing();
  ringLoop = setInterval(() => {
    if (!useCallStore.getState().muted) playOneRing();
  }, 3000);
}

function toRinging() {
  useCallStore.getState().setPhase("ringing");
  startRing();
  later(toConnected, 3400);
}

export const callFlow = {
  open(contact: Contact, phone?: string) {
    clearAll();
    session += 1;
    voiceEngine.cancel(); // Otto goes quiet
    _stopForCall?.(); // mic can't capture call audio (§5.3)
    useCallStore.getState().startTarget({
      contactId: contact.id,
      name: contactFullName(contact),
      entity: contact.company,
      phone: phone ?? contact.phone,
      initials: contactInitials(contact),
      firstName: contact.firstName,
      role: contact.role,
      note: personaNote(contact.notes),
      signalText: signalText(contact) || undefined,
    });
    let n = 5;
    const step = () => {
      n -= 1;
      if (n >= 1) {
        useCallStore.getState().setCountdown(n);
        later(step, 900);
      } else {
        toRinging();
      }
    };
    later(step, 900);
  },

  /** Skip the remaining pre-dial countdown and start ringing immediately. */
  dialNow() {
    if (useCallStore.getState().phase !== "calling") return;
    clearAll(); // drop the queued countdown steps; the session id stays valid
    toRinging();
  },

  /**
   * Nobody picked up. Ends the attempt and queues a log so the call is still
   * recorded — the broker confirms it (with a "No Answer" outcome) in the Log
   * Call modal, same as a connected call.
   */
  noAnswer() {
    const target = useCallStore.getState().target;
    clearAll();
    session += 1;
    voiceEngine.cancel();
    useCallStore.getState().reset();
    if (!target) return;
    usePendingCallLog.getState().request({
      contactId: target.contactId,
      draft: `Called ${target.firstName} — no answer. Try again or follow up by email.`,
      outcome: "No Answer",
      armHeroInbound: false,
      // No transcript to summarise, so the recap states the one fact there is.
      // It still travels through the log rather than around it, so an unanswered
      // call reports itself in the same order as a connected one.
      recap: {
        sentiment: "neutral",
        keyPoints: [`Called ${target.firstName} — no answer.`],
        tasks: [{ title: `Try ${target.firstName} again`, due: null }],
        opportunity: { name: "", address: "" },
      },
    });
  },

  submitLine(text: string) {
    const t = text.trim();
    if (!t) return;
    const st = useCallStore.getState();
    if (st.phase !== "connected" || st.awaitingOwner) return;
    st.appendLine("you", t);
    st.setSuggestions([]);
    st.setShouldEnd(false);
    void runOwnerTurn(t);
  },

  toggleMute() {
    useCallStore.getState().toggleMute();
  },

  hangUp() {
    clearAll();
    session += 1;
    voiceEngine.cancel();
    useCallStore.getState().reset();
  },

  async endCall() {
    const st = useCallStore.getState();
    const target = st.target;
    const transcript = st.transcript.map((l) => ({ speaker: l.speaker, text: l.text }));
    clearAll();
    session += 1; // invalidate any in-flight owner turn / audio
    const mySession = session;
    voiceEngine.cancel();
    useCallStore.setState({
      phase: "idle",
      suggestions: [],
      awaitingOwner: false,
      shouldEnd: false,
      // The line is down but the call isn't reported yet — the recap below is a
      // model call. Anything waiting to hear how the call went waits on this
      // rather than on `phase`, which is already idle.
      wrapping: true,
    });
    if (!target) {
      useCallStore.getState().reset();
      return;
    }
    let recap;
    try {
      recap = await generateCallRecap({
        data: {
          transcript,
          contact: { name: target.name, firstName: target.firstName, entity: target.entity },
        },
      });
    } catch {
      recap = {
        sentiment: "neutral" as const,
        keyPoints: [`Call with ${target.firstName} ended.`],
        tasks: [{ title: `Follow up with ${target.firstName}`, due: null }],
        opportunity: { name: "", address: "" },
      };
    }
    // A new call/hangup took over during recap generation — don't surface a
    // stale recap, and don't pop a (blocking) log modal for a superseded call.
    if (mySession !== session) return;
    // The pending log takes over the waiting from here.
    useCallStore.getState().setWrapping(false);
    // Nothing is written to the CRM here: queue the log with the AI's summary
    // and let the broker confirm it in the Log Call modal (see
    // GlobalLogCallModal). That confirm is also what arms the hero's follow-up
    // email, so Rosa's financials arrive after the call is logged — the deal is
    // created from that email's "Start a Deal" action, not at hang-up.
    usePendingCallLog.getState().request({
      contactId: target.contactId,
      // Handed over rather than published: `GlobalLogCallModal` sets it on the
      // store once the broker confirms, so the recap card reports a call that is
      // actually on the record.
      recap,
      draft: composeCallNotes({
        recap,
        firstName: target.firstName,
        heroKey: getContact(target.contactId)?.heroKey,
      }),
      armHeroInbound: isHeroCall(target),
    });
    // Nothing is on the store yet: the recap surfaces from the confirmed log, so
    // the sidebar shows it when the broker opens the panel — a finished call
    // still never forces the panel open over their work.
  },
};
