"use client";

/**
 * eslint-disable react-hooks/immutability --
 * The audio-context ref belongs to the room (the runtime hook creates it and
 * this slice plays through it). Writes happen in handlers, never in render.
 */
import { useRef } from "react";

/**
 * S4 slice 12: AI playback. stopAiPlayback and playAudio moved verbatim from
 * page.tsx. Both are read by the barge-in path, the finish handler's TTS branch
 * and the settlement teardown, so the hook returns them rather than owning any
 * decision about when to speak.
 */
export function useAiPlayback(opts: {
  audioContext: { current: AudioContext | null };
  setIsAiSpeaking: (b: boolean) => void;
}) {
  const { audioContext, setIsAiSpeaking } = opts;
  const currentAudioSource = useRef<AudioBufferSourceNode | null>(null);

  function stopAiPlayback() {
    if (currentAudioSource.current) {
      currentAudioSource.current.stop();
      currentAudioSource.current = null;
    }
    window.speechSynthesis.cancel();
    setIsAiSpeaking(false);
  }

  async function playAudio(audioData: Float32Array, sampleRate: number) {
    if (!audioContext.current) return;

    // Stop any currently playing audio
    if (currentAudioSource.current) {
      currentAudioSource.current.stop();
    }

    const buffer = audioContext.current.createBuffer(1, audioData.length, sampleRate);
    // @ts-expect-error: ArrayBufferLike vs ArrayBuffer mismatch
    buffer.copyToChannel(audioData, 0);

    const source = audioContext.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.current.destination);

    source.onended = () => {
      setIsAiSpeaking(false);
    };

    currentAudioSource.current = source;
    source.start();
  }

  return { stopAiPlayback, playAudio };
}
