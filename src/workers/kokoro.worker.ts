
import { KokoroTTS } from 'kokoro-js';

type WorkerGlobalScope = typeof globalThis & {
  postMessage(message: unknown, transfer?: Transferable[]): void;
};
declare const self: WorkerGlobalScope;

let ttsInstance: KokoroTTS | null = null;

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, text, voice = 'af_heart' } = event.data;

  if (type === 'load') {
    try {
      // Initialize Kokoro TTS (downloads the model ~82MB)
      if (!ttsInstance) {
        ttsInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
          dtype: 'q8', // Quantized model for better performance in browser
        });
      }
      self.postMessage({ status: 'ready' });
    } catch (error: unknown) {
      self.postMessage({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  } else if (type === 'generate') {
    try {
      if (!ttsInstance) {
        throw new Error("TTS Model not loaded yet.");
      }
      
      self.postMessage({ status: 'progress', message: 'Generating audio...' });
      
      const audioResult = await ttsInstance.generate(text, {
        voice: voice,
      });

      // audioResult contains raw audio data (Float32Array) and sampleRate
      self.postMessage({ 
        status: 'complete', 
        audio: audioResult.audio,
        sampleRate: ('sampleRate' in audioResult && typeof audioResult.sampleRate === 'number') ? audioResult.sampleRate : 24000
      }, { transfer: [audioResult.audio.buffer as ArrayBuffer] });
      
    } catch (error: unknown) {
      self.postMessage({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  } else if (type === 'dispose') {
    ttsInstance = null;
    self.close();
  }
});
