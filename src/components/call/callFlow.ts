import type { Contact } from "#/data/types";
import { useCallStore } from "./useCallStore";
import { playOneRing, playAnsweredCue } from "./ringtone";
import { voiceEngine } from "#/ai/voice/voiceEngine";
import { ownerVoiceFor } from "#/ai/voice/ownerVoice";
import { generateCallTurn, generateCallRecap } from "#/ai/generate";
import { useAssistant } from "#/ai/useAssistant";
import { addNote } from "#/data/actions";
import { contactFullName, contactInitials } from "#/components/contacts/contactDisplay";

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
        property: null,
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
    voiceEngine.cancel(); // Al goes quiet
    _stopForCall?.(); // mic can't capture call audio (§5.3)
    useCallStore.getState().startTarget({
      contactId: contact.id,
      name: contactFullName(contact),
      entity: contact.company,
      phone: phone ?? contact.phone,
      initials: contactInitials(contact),
      firstName: contact.firstName,
      role: contact.role,
      note: contact.notes ?? "",
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
        opportunity: null,
      };
    }
    // Log the call to the contact's record (persists; replaces the old LogCallModal).
    // Always logged — the call happened — even if a newer call supersedes the UI below.
    addNote(
      target.contactId,
      `Call with ${target.name} — ${recap.sentiment}. ${recap.keyPoints.join(" ")}`.trim(),
    );
    // A new call/hangup took over during recap generation — don't surface a stale recap.
    if (mySession !== session) return;
    useCallStore.getState().setRecap(recap);
    useAssistant.getState().setOpen(true); // sidebar renders + speaks the recap
  },
};
