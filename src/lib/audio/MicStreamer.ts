import { floatTo16BitPCM, int16ArrayToBase64, resampleFloat32 } from "./pcm";

const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

/**
 * Captures microphone audio and emits base64-encoded 16kHz PCM16 chunks — the format the
 * Gemini Live API expects for `sendRealtimeInput`. Uses ScriptProcessorNode: deprecated, but
 * the simplest option that needs no separate worklet file and works across current browsers.
 */
export class MicStreamer {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;

  async start(onChunk: (base64Pcm: string) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    this.audioContext = new AudioContext();
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.processorNode = this.audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    this.processorNode.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const resampled = resampleFloat32(input, this.audioContext!.sampleRate, TARGET_SAMPLE_RATE);
      const pcm16 = floatTo16BitPCM(resampled);
      onChunk(int16ArrayToBase64(pcm16));
    };

    this.sourceNode.connect(this.processorNode);
    // ScriptProcessorNode only fires while connected to a destination.
    this.processorNode.connect(this.audioContext.destination);
    this.muteLocalPlayback();
  }

  private muteLocalPlayback() {
    // We connect to `destination` to keep the processor alive but never want to hear our own mic.
    if (this.processorNode) this.processorNode.disconnect(this.audioContext!.destination);
    const silentGain = this.audioContext!.createGain();
    silentGain.gain.value = 0;
    this.processorNode!.connect(silentGain);
    silentGain.connect(this.audioContext!.destination);
  }

  stop() {
    this.processorNode?.disconnect();
    this.sourceNode?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close();
    this.audioContext = null;
    this.sourceNode = null;
    this.processorNode = null;
    this.stream = null;
  }
}
