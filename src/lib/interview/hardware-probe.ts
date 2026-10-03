export type DeviceStatus = "success" | "error";

export interface HardwareProbe {
  mic: DeviceStatus;
  cam: DeviceStatus;
  /** The live stream to preview and meter, or null when nothing could open. */
  stream: MediaStream | null;
  /** What to tell the candidate; null when both devices came up. */
  message: string | null;
}

type GetUserMedia = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

const errorName = (err: unknown): string =>
  err instanceof Error ? err.name : typeof err === "string" ? err : "";

/**
 * Opens the microphone and camera for the preflight check.
 *
 * The previous code asked for both in one getUserMedia call and, on any
 * rejection, marked both devices failed. A desktop with a working microphone and
 * no webcam — the common case this product will see — therefore got two red
 * crosses and "No camera/microphone detected" on the one screen whose entire job
 * is to report device status accurately, and the candidate had no way to know
 * the microphone was fine.
 *
 * Order matters for consent, not just accuracy: the combined request is tried
 * first so a normal machine sees one permission dialog rather than two. Only a
 * NotFoundError — a device that is absent, not a device that was refused — falls
 * back to an audio-only request to find out which one is missing. A denied
 * permission is deliberately not retried: that would prompt the candidate twice
 * for a decision they already made.
 */
export async function probeHardware(
  getUserMedia: GetUserMedia,
  audio: MediaTrackConstraints
): Promise<HardwareProbe> {
  try {
    const stream = await getUserMedia({ audio, video: true });
    return { mic: "success", cam: "success", stream, message: null };
  } catch (err) {
    const name = errorName(err);

    if (name === "NotFoundError" || name === "OverconstrainedError") {
      try {
        const audioOnly = await getUserMedia({ audio });
        return {
          mic: "success",
          cam: "error",
          stream: audioOnly,
          // English to match the surface this replaced; the page's toasts are
          // Chinese and its device errors were English already.
          message:
            name === "OverconstrainedError"
              ? "No camera matched the requested settings. Your microphone works — you can run a voice-only interview."
              : "No camera detected. Your microphone works — you can run a voice-only interview.",
        };
      } catch {
        return {
          mic: "error",
          cam: "error",
          stream: null,
          message:
            "No microphone or camera detected. Plug a device in and re-run the check — a camera is not required for voice practice.",
        };
      }
    }

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return {
        mic: "error",
        cam: "error",
        stream: null,
        message: "Browser blocked camera/microphone access. Please allow access in your URL bar and try again.",
      };
    }

    return {
      mic: "error",
      cam: "error",
      stream: null,
      message: "An error occurred while accessing the camera/microphone.",
    };
  }
}
