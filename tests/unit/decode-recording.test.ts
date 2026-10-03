import { describe, expect, it, vi } from "vitest";
import { decodeRecordingToMono16k } from "@/lib/audio/decode-recording";

/**
 * The per-answer decode in the interview room. It runs once for every answer the
 * candidate gives, which is what makes the two things it guarantees matter:
 * a leaked AudioContext accumulates until the browser refuses another, and a
 * thrown decode leaves the room stuck on "正在识别语音...".
 */

function fakeContext(overrides: Partial<AudioContext> = {}) {
  const close = vi.fn(async () => {});
  const decodeAudioData = vi.fn(async () => ({
    getChannelData: () => new Float32Array([0.1, 0.2, 0.3]),
  }));
  const ctor = vi.fn(() => ({ close, decodeAudioData, ...overrides }) as unknown as AudioContext);
  return { ctor, close, decodeAudioData };
}

const clip = (bytes = 4096) =>
  new Blob([new Uint8Array(bytes)], { type: "audio/webm" });

describe("decodeRecordingToMono16k", () => {
  it("returns the mono samples at the worker's sample rate", async () => {
    const { ctor, close } = fakeContext();
    const out = await decodeRecordingToMono16k(clip(), ctor);

    expect(out).toBeInstanceOf(Float32Array);
    expect(out).toHaveLength(3);
    expect(ctor).toHaveBeenCalledWith({ sampleRate: 16000 });
    expect(close).toHaveBeenCalled();
  });

  it("closes the context when the decode fails", async () => {
    const { ctor, close } = fakeContext({
      decodeAudioData: (async () => {
        throw new Error("Unable to decode audio data");
      }) as unknown as AudioContext["decodeAudioData"],
    });

    await expect(decodeRecordingToMono16k(clip(), ctor)).resolves.toBeNull();
    expect(close).toHaveBeenCalled();
  });

  it("closes the context when the browser refuses to create one", async () => {
    // The cap is reached mid-session, not at startup — after enough answers the
    // constructor itself throws.
    const ctor = vi.fn(() => {
      throw new Error("Failed to construct 'AudioContext': too many active contexts");
    }) as unknown as (new (o?: AudioContextOptions) => AudioContext);

    await expect(decodeRecordingToMono16k(clip(), ctor)).resolves.toBeNull();
  });

  it("does not create a context for a recording with no audio in it", async () => {
    // Stopping immediately after starting produces zero chunks. The old path
    // decoded that, threw inside an uncaught async onstop, and left the
    // "transcribing" status on screen permanently.
    const { ctor, close } = fakeContext();
    const out = await decodeRecordingToMono16k(new Blob([], { type: "audio/webm" }), ctor);

    expect(out).toBeNull();
    expect(ctor).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it("survives a close() that rejects", async () => {
    const { ctor, decodeAudioData } = fakeContext({
      close: (async () => {
        throw new Error("closed");
      }) as unknown as AudioContext["close"],
    });

    await expect(
      decodeRecordingToMono16k(clip(), ctor)
    ).resolves.toHaveLength(3);
    expect(decodeAudioData).toHaveBeenCalled();
  });
});
