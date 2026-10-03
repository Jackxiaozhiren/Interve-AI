import { describe, expect, it, vi } from "vitest";
import { probeHardware } from "@/lib/interview/hardware-probe";

/**
 * The preflight on setup step 6. Its whole job is to tell a candidate which of
 * their devices work, so a result that lies about the microphone is worse than no
 * check at all — which is what the original single combined getUserMedia did on
 * any machine without a webcam.
 */

const stream = (label: string) => ({ label, getTracks: () => [] }) as unknown as MediaStream;

const domError = (name: string) => {
  const err = new Error(name);
  err.name = name;
  return err;
};

const AUDIO = { echoCancellation: true, noiseSuppression: true } as MediaTrackConstraints;

function gum(...results: Array<MediaStream | Error | string>) {
  let call = 0;
  const seen: MediaStreamConstraints[] = [];
  const impl = vi.fn(async (c: MediaStreamConstraints) => {
    seen.push(c);
    const r = results[Math.min(call, results.length - 1)];
    call += 1;
    // Discriminated by shape rather than `instanceof Error`, so a stub can
    // represent the non-Error rejections some polyfills throw.
    if (typeof r === "object" && r !== null && "getTracks" in r) return r as MediaStream;
    throw r;
  });
  return { impl, seen, calls: () => call };
}

describe("probeHardware", () => {
  it("reports both devices from one combined request when they exist", async () => {
    const both = stream("both");
    const { impl, seen, calls } = gum(both);

    const out = await probeHardware(impl, AUDIO);

    expect(out).toEqual({ mic: "success", cam: "success", stream: both, message: null });
    // One prompt, not two: the combined request is tried first on purpose.
    expect(calls()).toBe(1);
    expect(seen[0]).toEqual({ audio: AUDIO, video: true });
  });

  it("does not blame the microphone when only the camera is missing", async () => {
    const micOnly = stream("mic");
    const { impl, seen, calls } = gum(domError("NotFoundError"), micOnly);

    const out = await probeHardware(impl, AUDIO);

    expect(out.mic).toBe("success");
    expect(out.cam).toBe("error");
    expect(out.stream).toBe(micOnly);
    expect(out.message).toMatch(/No camera detected/);
    expect(out.message).toMatch(/microphone works/);
    expect(calls()).toBe(2);
    // The retry asks for audio alone, so it cannot fail on the absent camera again.
    expect(seen[1]).toEqual({ audio: AUDIO });
  });

  it("says so when neither device exists", async () => {
    const { impl, calls } = gum(domError("NotFoundError"), domError("NotFoundError"));

    const out = await probeHardware(impl, AUDIO);

    expect(out).toMatchObject({ mic: "error", cam: "error", stream: null });
    expect(out.message).toMatch(/No microphone or camera detected/);
    expect(calls()).toBe(2);
  });

  it("never re-prompts after a denied permission", async () => {
    // A second request would show the candidate a dialog for a decision they
    // already made, which is why NotFound is the only fallback trigger.
    for (const name of ["NotAllowedError", "PermissionDeniedError"]) {
      const { impl, calls } = gum(domError(name));
      const out = await probeHardware(impl, AUDIO);
      expect(out.mic).toBe("error");
      expect(out.cam).toBe("error");
      expect(out.message).toMatch(/Browser blocked/);
      expect(calls()).toBe(1);
    }
  });

  it("treats an unusable camera constraint as a camera problem, not a global one", async () => {
    const micOnly = stream("mic");
    const { impl } = gum(domError("OverconstrainedError"), micOnly);

    const out = await probeHardware(impl, AUDIO);

    expect(out.mic).toBe("success");
    expect(out.message).toMatch(/No camera matched/);
  });

  it("keeps a generic message for an unexpected failure", async () => {
    const { impl, calls } = gum(domError("NotReadableError"));
    const out = await probeHardware(impl, AUDIO);
    expect(out).toMatchObject({ mic: "error", cam: "error", stream: null });
    expect(out.message).toMatch(/An error occurred while accessing/);
    expect(calls()).toBe(1);
  });

  it("survives a rejection that is not an Error at all", async () => {
    // getUserMedia rejects with a DOMException normally, but some polyfills throw
    // a bare string; the classifier must not read `.name` off it blindly.
    const { impl } = gum("denied" as unknown as Error);
    const out = await probeHardware(impl, AUDIO);
    expect(out.mic).toBe("error");
    expect(out.message).toMatch(/An error occurred while accessing/);
  });
});
