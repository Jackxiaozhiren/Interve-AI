type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext;

/**
 * Decodes a recorded clip into the mono 16 kHz samples the in-browser Whisper
 * worker expects.
 *
 * Two rules this exists to enforce, both learned from the interview room
 * hanging on "正在识别语音...":
 *
 * - The temporary AudioContext is closed on every path. One is created per
 *   answer, and browsers cap the number of live contexts per origin, so an
 *   unbounded leak does not fail on the first turn — it fails in the middle of
 *   a session, on the turn where the candidate has already given the longest
 *   answer.
 * - Failure is a value, not an exception. The caller previously awaited this
 *   inside an async `onstop` with no catch, so a short recording (empty blob,
 *   rejected decode) stranded the UI in its "transcribing" state with nothing
 *   but a console rejection to explain it.
 *
 * The decoded AudioBuffer outlives the context it came from, so closing here
 * does not invalidate the returned samples.
 */
export async function decodeRecordingToMono16k(
  blob: Blob,
  CreateAudioContext: AudioContextConstructor
): Promise<Float32Array | null> {
  // Stopping a recording within its first timeslice produces no chunks at all;
  // decoding that would only throw.
  if (blob.size === 0) return null;

  let ctx: AudioContext | null = null;
  try {
    ctx = new CreateAudioContext({ sampleRate: 16000 });
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    return decoded.getChannelData(0);
  } catch {
    return null;
  } finally {
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        /* already closed */
      }
    }
  }
}
