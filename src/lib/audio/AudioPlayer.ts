import { base64ToInt16Array, int16ToFloat32 } from "./pcm";

const OUTPUT_SAMPLE_RATE = 24000;

/** Queues and gaplessly plays back 24kHz PCM16 audio chunks from the Gemini Live API. */
export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private onPlaybackChange?: (playing: boolean) => void;

  constructor(onPlaybackChange?: (playing: boolean) => void) {
    this.onPlaybackChange = onPlaybackChange;
  }

  private ensureContext() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      this.nextStartTime = this.audioContext.currentTime;
    }
    return this.audioContext;
  }

  enqueue(base64Pcm: string) {
    const ctx = this.ensureContext();
    const int16 = base64ToInt16Array(base64Pcm);
    const float32 = int16ToFloat32(int16);

    const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(this.nextStartTime, ctx.currentTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;

    this.activeSources.push(source);
    this.onPlaybackChange?.(true);
    source.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== source);
      if (this.activeSources.length === 0) this.onPlaybackChange?.(false);
    };
  }

  /** Stops all queued/playing audio immediately — used when the model is interrupted (barge-in). */
  clear() {
    this.activeSources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    });
    this.activeSources = [];
    if (this.audioContext) this.nextStartTime = this.audioContext.currentTime;
    this.onPlaybackChange?.(false);
  }

  close() {
    this.clear();
    this.audioContext?.close();
    this.audioContext = null;
  }
}
