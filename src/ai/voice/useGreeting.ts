import { useEffect } from "react";
import { useAssistant } from "#/ai/useAssistant";
import { useVoice } from "./useVoice";
import { voiceEngine } from "./voiceEngine";
import { composeGreeting } from "./greeting";
import { buildAssistantContext } from "#/ai/context";

/**
 * Proactive spoken greeting (voice-foundation design §6.3). Fires once per
 * session the first time the assistant opens: renders the greeting, speaks it
 * (if voice is on), then enters hands-free conversation. Also arms audio-unlock
 * on the first user gesture so real TTS — not the robotic fallback — plays.
 */
export function useGreeting(opts: {
  onGreeting: (text: string) => void;
  onEnterConversation: () => void;
}) {
  const { onGreeting, onEnterConversation } = opts;

  // Arm audio unlock once, at mount, before any greeting can fire.
  useEffect(() => {
    const unlock = () => {
      voiceEngine.unlock();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const open = useAssistant((s) => s.open);
  const greeted = useAssistant((s) => s.greetedThisSession);
  const setGreeted = useAssistant((s) => s.setGreeted);

  useEffect(() => {
    if (!open || greeted) return;
    setGreeted(true);
    const text = composeGreeting(buildAssistantContext());
    onGreeting(text);
    if (!useVoice.getState().voiceEnabled) return; // show only, no speech/mic
    void voiceEngine.speak(text).then(() => {
      useVoice.getState().setConversationMode(true);
      onEnterConversation();
    });
  }, [open, greeted, setGreeted, onGreeting, onEnterConversation]);
}
