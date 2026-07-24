/**
 * Voice configuration for the ElevenLabs TTS path. Voice ids are ElevenLabs
 * stock voices, overridable via env so a swap needs no code change.
 * NOTE: confirm these ids against the ElevenLabs account during setup
 * (voice-foundation design §9); they are the documented public premade ids.
 */
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

/** Warm, neutral "Otto" delivery. Default: ElevenLabs "Adam". */
export const AL_VOICE_ID = env.ELEVENLABS_AL_VOICE_ID || "pNInz6obpgDQGcFmaJgB";

/** Low-latency, low-credit model for hands-free + the Phase-3 live call. */
export const TTS_MODEL = env.ELEVENLABS_MODEL || "eleven_flash_v2_5";

/** Warmth comes from voice + settings (ElevenLabs has no `instructions` field). */
export const AL_VOICE_SETTINGS = {
  stability: 0.45,
  similarity_boost: 0.75,
  style: 0.4,
  use_speaker_boost: true,
};

/** Gendered owner pools (Phase 3 owner lines). Stock ElevenLabs voices. */
export const OWNER_VOICES = {
  female: [
    "21m00Tcm4TlvDq8ikWAM", // Rachel
    "AZnzlk1XvdvUeBnXmlld", // Domi
    "EXAVITQu4vr4xnSDxMaL", // Bella
    "MF3mGyEYCl7XYWbV9V6O", // Elli
  ],
  male: [
    "ErXwobaYiN019PkySvjV", // Antoni
    "TxGEqnHWrfWFTfGW9XjX", // Josh
    "VR6AewLTigWG4xSOukaG", // Arnold
    "yoZ06aMxZJJ28mfd3POQ", // Sam
  ],
};

export const ALLOWED_VOICE_IDS = new Set<string>([
  AL_VOICE_ID,
  ...OWNER_VOICES.female,
  ...OWNER_VOICES.male,
]);

export function resolveVoiceId(id: string | undefined): string {
  return id && ALLOWED_VOICE_IDS.has(id) ? id : AL_VOICE_ID;
}
