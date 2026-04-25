
import { pipeline, env } from '@huggingface/transformers';

type WorkerGlobalScope = typeof globalThis & {
  postMessage(message: unknown, transfer?: Transferable[]): void;
};
declare const self: WorkerGlobalScope;

// Skip local model check since we are running in the browser
env.allowLocalModels = false;

type PipelineInstance = Awaited<ReturnType<typeof pipeline>>;

class WhisperPipeline {
  static task = 'automatic-speech-recognition' as const;
  static model = 'Xenova/whisper-base'; // Use base model for better multilingual accuracy (supports Chinese)
  static instance: PipelineInstance | null = null;

  static async getInstance(progress_callback?: (progress: unknown) => void) {
    if (this.instance === null) {
      try {
        // Use WebGPU device with fp16 dtype for faster hardware acceleration and lower memory
        this.instance = await pipeline(this.task, this.model, { 
          progress_callback,
          device: 'webgpu',
          dtype: 'fp16'
        });
      } catch (err) {
        console.warn("WebGPU initialization failed, falling back to WASM (CPU):", err);
        // Fallback to WASM/CPU with quantized model for better performance on CPU
        this.instance = await pipeline(this.task, this.model, { 
          progress_callback,
          device: 'wasm',
          dtype: 'q8'
        });
      }
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, audio, language } = event.data;

  if (type === 'transcribe') {
    try {
      // Load model if not loaded yet
      const transcriber = await WhisperPipeline.getInstance((x: unknown) => {
        // We can send progress updates to the main thread
        self.postMessage({ status: 'progress', ...(x as Record<string, unknown>) });
      });

      // We expect 'audio' to be a Float32Array containing audio data
      // sampled at 16000Hz.
      // The transcriber is a callable function returned by pipeline()
      type TranscriberFunction = (audio: Float32Array, options: Record<string, unknown>) => Promise<{ text: string }>;
      const result = await (transcriber as unknown as TranscriberFunction)(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        // language is optional, if not provided it will auto-detect. 
        // We can pass 'zh' or 'chinese' from the main thread.
        ...(language && { language }),
        task: 'transcribe',
      });

      self.postMessage({
        status: 'complete',
        text: result.text,
      });
    } catch (error: unknown) {
      self.postMessage({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  } else if (type === 'load') {
    try {
      await WhisperPipeline.getInstance((x: unknown) => {
        self.postMessage({ status: 'progress', ...(x as Record<string, unknown>) });
      });
      self.postMessage({ status: 'ready' });
    } catch (error: unknown) {
      self.postMessage({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  } else if (type === 'dispose') {
    try {
      const instance = WhisperPipeline.instance as unknown as { dispose?: () => Promise<void> };
      if (instance && typeof instance.dispose === 'function') {
        await instance.dispose();
      }
      WhisperPipeline.instance = null;
      self.close();
    } catch (error) {
      console.error('Error disposing whisper worker:', error);
      self.close();
    }
  }
});
