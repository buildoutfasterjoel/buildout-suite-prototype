import { create } from "zustand";
import type { CallRecapSpecT } from "#/ai/generate/schemas";

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
   * The AI's recap, held here rather than published at hang-up.
   *
   * The rail's recap card is the report of a *logged* call, so it waits for the
   * broker to confirm this modal — the same rule the hero's follow-up email
   * already follows. Published at hang-up it appeared behind a modal the broker
   * had not answered yet, reporting a call that was not on the record.
   */
  recap: CallRecapSpecT;
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
