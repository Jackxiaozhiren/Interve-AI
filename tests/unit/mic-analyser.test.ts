// F3-split-1 RED: shared mic-analyser helper tests (module lands in GREEN).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMicAnalyser } from "../../src/lib/audio/mic-analyser";

function mockMediaStack() {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] };
  const connect = vi.fn();
  const analyser = {
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 4,
    getByteFrequencyData: vi.fn(),
  };
  const close = vi.fn(async () => {});
  const ctx = {
    state: "open",
    createMediaStreamSource: vi.fn(() => ({ connect })),
    createAnalyser: vi.fn(() => analyser),
    close,
  };
  const getUserMedia = vi.fn(async (_constraints?: MediaStreamConstraints) => {
    void _constraints;
    return stream as unknown as MediaStream;
  });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  const AudioContextCtor = vi.fn(() => ctx);
  vi.stubGlobal("window", { AudioContext: AudioContextCtor });
  return { stop, stream, connect, analyser, close, ctx, getUserMedia, AudioContextCtor };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createMicAnalyser", () => {
  it("requests mic with echo cancellation and wires source->analyser", async () => {
    const { getUserMedia, analyser, connect, AudioContextCtor } = mockMediaStack();
    const mic = await createMicAnalyser({ smoothingTimeConstant: 0.9 });
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ echoCancellation: true, noiseSuppression: true }),
    });
    expect(AudioContextCtor).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(analyser.fftSize).toBe(512);
    expect(analyser.smoothingTimeConstant).toBe(0.9);
    expect(mic.dataArray).toBeInstanceOf(Uint8Array);
    expect(mic.dataArray.length).toBe(4);
    mic.dispose();
  });

  it("prefers the device via ideal (never exact)", async () => {
    const { getUserMedia } = mockMediaStack();
    const mic = await createMicAnalyser({ deviceId: "mic-1", smoothingTimeConstant: 0.4 });
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ deviceId: { ideal: "mic-1" } }),
    });
    expect(JSON.stringify(getUserMedia.mock.calls[0][0])).not.toContain("exact");
    mic.dispose();
  });

  it("dispose stops tracks and closes a non-closed context exactly once", async () => {
    const { stop, close } = mockMediaStack();
    const mic = await createMicAnalyser({ smoothingTimeConstant: 0.9 });
    mic.dispose();
    mic.dispose();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("dispose skips close when the context is already closed", async () => {
    const { stop, close, ctx } = mockMediaStack();
    ctx.state = "closed";
    const mic = await createMicAnalyser({ smoothingTimeConstant: 0.9 });
    mic.dispose();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it("propagates acquisition failure to the caller (hooks own the warning)", async () => {
    mockMediaStack();
    const denied = new Error("Permission denied");
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(denied);
    await expect(createMicAnalyser({ smoothingTimeConstant: 0.9 })).rejects.toBe(denied);
  });
});
