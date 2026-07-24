import { create } from "zustand";
import type { CallRecapSpecT } from "#/ai/generate/schemas";
import type { HeroActions } from "./heroRecapExtensions";

export type CallPhase = "idle" | "calling" | "ringing" | "connected";

/** Snapshot of the contact taken at call start so the call never depends on the
 * live record mid-call. `firstName` feeds ownerVoiceFor; role/note/entity feed
 * the call-turn candidate. */
export interface CallTarget {
  contactId: string;
  name: string;
  entity: string;
  phone: string;
  initials: string;
  firstName: string;
  role: string;
  note: string;
  signalText?: string;
}

export interface TranscriptLine {
  id: string;
  speaker: "you" | "them";
  text: string;
}

interface CallState {
  phase: CallPhase;
  target: CallTarget | null;
  countdown: number;
  elapsedSecs: number;
  muted: boolean;
  transcript: TranscriptLine[];
  suggestions: string[];
  awaitingOwner: boolean;
  shouldEnd: boolean;
  recap: CallRecapSpecT | null;
  heroActions: HeroActions | null;
  startTarget: (t: CallTarget) => void;
  setPhase: (p: CallPhase) => void;
  setCountdown: (n: number) => void;
  setElapsed: (n: number) => void;
  toggleMute: () => void;
  appendLine: (speaker: "you" | "them", text: string) => void;
  setSuggestions: (s: string[]) => void;
  setAwaitingOwner: (b: boolean) => void;
  setShouldEnd: (b: boolean) => void;
  setRecap: (r: CallRecapSpecT | null) => void;
  clearRecap: () => void;
  setHeroActions: (a: HeroActions | null) => void;
  clearHeroActions: () => void;
  reset: () => void;
}

let _lineSeq = 0;

const IDLE = {
  phase: "idle" as CallPhase,
  target: null,
  countdown: 5,
  elapsedSecs: 0,
  muted: false,
  transcript: [] as TranscriptLine[],
  suggestions: [] as string[],
  awaitingOwner: false,
  shouldEnd: false,
  recap: null as CallRecapSpecT | null,
  heroActions: null as HeroActions | null,
};

export const useCallStore = create<CallState>((set) => ({
  ...IDLE,
  startTarget: (target) =>
    set({
      ...IDLE,
      target,
      phase: "calling",
      countdown: 5,
    }),
  setPhase: (phase) => set({ phase }),
  setCountdown: (countdown) => set({ countdown }),
  setElapsed: (elapsedSecs) => set({ elapsedSecs }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  appendLine: (speaker, text) =>
    set((s) => ({
      transcript: [...s.transcript, { id: `line-${_lineSeq++}`, speaker, text }],
    })),
  setSuggestions: (suggestions) => set({ suggestions }),
  setAwaitingOwner: (awaitingOwner) => set({ awaitingOwner }),
  setShouldEnd: (shouldEnd) => set({ shouldEnd }),
  setRecap: (recap) => set({ recap }),
  clearRecap: () => set({ recap: null }),
  setHeroActions: (heroActions) => set({ heroActions }),
  clearHeroActions: () => set({ heroActions: null }),
  reset: () => set({ ...IDLE }),
}));
