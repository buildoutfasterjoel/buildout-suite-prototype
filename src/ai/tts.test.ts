import { describe, it, expect, vi } from "vitest";
import { synthesizeResponse } from "./tts";
import { AL_VOICE_ID } from "./voice/ttsConfig";

describe("synthesizeResponse", () => {
  it("returns 503 when no api key is configured", async () => {
    const res = await synthesizeResponse({ text: "hello", apiKey: undefined });
    expect(res.status).toBe(503);
  });

  it("calls ElevenLabs with the resolved voice and returns audio bytes", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
    ) as unknown as typeof fetch;

    const res = await synthesizeResponse({ text: "hi", voiceId: "bogus", apiKey: "k", fetchImpl });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    const url = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain(AL_VOICE_ID); // unknown voice fell back to Al
  });

  it("caps text at 4000 chars before sending", async () => {
    let sentText = "";
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      sentText = JSON.parse(init.body as string).text;
      return new Response(new Uint8Array([1]), { status: 200 });
    }) as unknown as typeof fetch;

    await synthesizeResponse({ text: "x".repeat(5000), apiKey: "k", fetchImpl });
    expect(sentText.length).toBe(4000);
  });

  it("returns 502 when the provider fails", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 401 })) as unknown as typeof fetch;
    const res = await synthesizeResponse({ text: "hi", apiKey: "k", fetchImpl });
    expect(res.status).toBe(502);
  });
});
