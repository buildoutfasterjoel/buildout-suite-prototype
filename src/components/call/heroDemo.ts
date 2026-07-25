import { create } from "zustand";
import { useDataStore } from "#/data/dataStore";
import { useHeroOffer } from "#/ai/heroOffer";
import { useBovDraft } from "#/components/call/useBovDraft";
import { useCallStore } from "#/components/call/useCallStore";
import { useAssistant } from "#/ai/useAssistant";
import { useVoice } from "#/ai/voice/useVoice";
import { voiceEngine } from "#/ai/voice/voiceEngine";
import { callFlow } from "#/components/call/callFlow";
import { heroInbound } from "#/components/call/heroInbound";
import { rosaClosing } from "#/components/call/rosaClosing";
import { useContactSession } from "#/components/contacts/useContactSession";

interface HeroDemoState {
  arcComplete: boolean;
  markArcComplete: () => void;
  clearComplete: () => void;
}

export const useHeroDemo = create<HeroDemoState>((set) => ({
  arcComplete: false,
  markArcComplete: () => set({ arcComplete: true }),
  clearComplete: () => set({ arcComplete: false }),
}));

/** Otto's loop-closing line spoken/shown when the arc completes (PRD §3.1). */
export function arcCompleteText(): string {
  return (
    "That's the full loop — from Rosa's overnight voicemail to a signed listing agreement and " +
    "an active listing, all captured on one record. Want me to run it again?"
  );
}

/** Smooth in-session replay: stop in-flight work, re-seed a clean dataset, clear every hero
 * store, and re-fire the greeting from the top — no page reload. */
export async function resetHeroDemo(): Promise<void> {
  heroInbound.cancel();
  rosaClosing.cancel();
  callFlow.hangUp(); // also cancels voice + resets the call store
  voiceEngine.cancel();
  await useDataStore.getState().reset();
  useHeroOffer.getState().clearOffer();
  useContactSession.getState().reset();
  useBovDraft.getState().clear();
  useCallStore.getState().reset();
  useHeroDemo.getState().clearComplete();
  useVoice.getState().setConversationMode(false);
  useAssistant.getState().setGreeted(false);
  useAssistant.getState().setOpen(true);
}
