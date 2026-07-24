import { createServerFn } from "@tanstack/react-start";
import { resolveVoiceId, TTS_MODEL, AL_VOICE_SETTINGS } from "./voice/ttsConfig";

const MAX_TTS_CHARS = 4000;

/**
 * Provider seam. Pure and injectable so it unit-tests without network or env.
 * Swapping TTS providers later means rewriting only this function; the server
 * fn contract and all client code stay put (voice-foundation design §4).
 */
export async function synthesizeResponse(args: {
  text: string;
  voiceId?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<Response> {
  const { text, voiceId, apiKey, fetchImpl = fetch } = args;
  if (!apiKey) {
    return new Response("ELEVENLABS_API_KEY is not set on the server.", {
      status: 503,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  }

  const id = resolveVoiceId(voiceId);
  const capped = text.slice(0, MAX_TTS_CHARS);

  let providerRes: Response;
  try {
    providerRes = await fetchImpl(
      `https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: capped, model_id: TTS_MODEL, voice_settings: AL_VOICE_SETTINGS }),
      },
    );
  } catch {
    return new Response("TTS provider request failed.", { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  if (!providerRes.ok) {
    return new Response("TTS provider error.", { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  const bytes = await providerRes.arrayBuffer();
  return new Response(bytes, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}

/** POST { text, voiceId? } → audio/mpeg bytes (503 no key, 502 provider fail). */
export const tts = createServerFn({ method: "POST" })
  .validator((data: { text: string; voiceId?: string }) => data)
  .handler(async ({ data }) =>
    synthesizeResponse({ text: data.text, voiceId: data.voiceId, apiKey: process.env.ELEVENLABS_API_KEY }),
  );

/** Lets the client choose server-TTS vs browser speech before any audio call. */
export const ttsConfigured = createServerFn({ method: "GET" }).handler(async () => ({
  configured: Boolean(process.env.ELEVENLABS_API_KEY),
}));
