import { floatTo16BitPCM, int16ArrayToBase64, resampleFloat32 } from "./pcm";

const TARGET_SAMPLE_RATE = 16000;
// Halved from the previous ScriptProcessorNode's 4096 (~85ms @ 48kHz) to ~43ms — smaller chunks
// mean less buffering delay before each piece of audio is sent to the Live API.
const BUFFER_SIZE = 2048;

// AudioWorkletProcessor runs in a separate global scope with no access to this module, so it's
// defined as a self-contained string and loaded via a Blob URL — avoids needing a second static
// file served from `public/` just for this. `process()` is called once per 128-frame render
// quantum (fixed by the Web Audio API spec); we accumulate frames until we have a full chunk.
const WORKLET_SOURCE = `
class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.chunkSize = ${BUFFER_SIZE};
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) this.buffer.push(channel[i]);
      while (this.buffer.length >= this.chunkSize) {
        const chunk = this.buffer.slice(0, this.chunkSize);
        this.buffer = this.buffer.slice(this.chunkSize);
        this.port.postMessage(chunk);
      }
    }
    return true;
  }
}
registerProcessor("mic-capture-processor", MicCaptureProcessor);
`;

/**
 * Captures microphone audio and emits base64-encoded 16kHz PCM16 chunks — the format the
 * Gemini Live API expects for `sendRealtimeInput`. Runs capture on an AudioWorklet (the
 * dedicated audio rendering thread) rather than the older ScriptProcessorNode, which runs on
 * the main thread and is more prone to jitter/delay when the page is busy (React re-renders,
 * GC, etc.) — a real contributor to perceived call latency.
 */
export class MicStreamer {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private muted = false;

  /**
   * @param onChunk called with each base64 PCM16 chunk to send to the Live API.
   * @param onLevel optional, called with each chunk's RMS amplitude (0-1ish) for UI meters —
   * reports 0 while muted rather than the (silenced) raw signal, so a level-driven UI doesn't
   * show stale motion.
   */
  async start(onChunk: (base64Pcm: string) => void, onLevel?: (level: number) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    this.audioContext = new AudioContext();

    const workletUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
    try {
      await this.audioContext.audioWorklet.addModule(workletUrl);
    } finally {
      URL.revokeObjectURL(workletUrl);
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.audioContext, "mic-capture-processor");

    this.workletNode.port.onmessage = (event: MessageEvent<number[]>) => {
      const float32 = Float32Array.from(event.data);

      if (onLevel) {
        let sumSquares = 0;
        for (let i = 0; i < float32.length; i++) sumSquares += float32[i] * float32[i];
        onLevel(this.muted ? 0 : Math.sqrt(sumSquares / float32.length));
      }

      // Muting disables the track (below) too, but that takes a moment to silence the
      // worklet's input — skip sending chunks immediately so we don't keep billing/consuming
      // Live API input quota on stale audio between toggling mute and the track actually cutting.
      if (this.muted) return;

      const resampled = resampleFloat32(float32, this.audioContext!.sampleRate, TARGET_SAMPLE_RATE);
      const pcm16 = floatTo16BitPCM(resampled);
      onChunk(int16ArrayToBase64(pcm16));
    };

    this.sourceNode.connect(this.workletNode);
    // The audio graph only processes nodes reachable from `destination` — route through a
    // silent gain so we never actually hear our own mic played back.
    const silentGain = this.audioContext.createGain();
    silentGain.gain.value = 0;
    this.workletNode.connect(silentGain);
    silentGain.connect(this.audioContext.destination);
  }

  /** Local mute: disables the mic track at the hardware/OS level (so other apps see it as off
   * too) and stops forwarding audio to the Live API, without tearing down the call. */
  setMuted(muted: boolean) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }

  get isMuted() {
    return this.muted;
  }

  stop() {
    this.workletNode?.port.close();
    this.workletNode?.disconnect();
    this.sourceNode?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close();
    this.audioContext = null;
    this.sourceNode = null;
    this.workletNode = null;
    this.stream = null;
  }
}
