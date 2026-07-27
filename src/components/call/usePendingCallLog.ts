import { create } from "zustand";

/**
 * A call that has ended and is waiting to be logged. The call itself writes
 * nothing to the CRM — the broker confirms the log in the Log Call modal (see
 * GlobalLogCallModal), which is what actually records it.
 */
export interface PendingCallLog {
  contactId: string;
  /** The AI's summary of the call, streamed into the notes field as a draft. */
  draft: string;
  /** Outcome chip to pre-select, e.g. "No Answer". Defaults to "Connected". */
  outcome?: string;
  /**
   * Arm the hero's follow-up inbound (Rosa's financials email) once the log is
   * confirmed, so the story beat follows the logged call rather than hang-up.
   */
  armHeroInbound: boolean;
}

interface PendingCallLogState {
  pending: PendingCallLog | null;
  request: (pending: PendingCallLog) => void;
  clear: () => void;
}

export const usePendingCallLog = create<PendingCallLogState>((set) => ({
  pending: null,
  request: (pending) => set({ pending }),
  clear: () => set({ pending: null }),
}));
