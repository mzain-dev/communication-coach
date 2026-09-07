// Thin wrappers around the browser's built-in Web Speech API. Used for Listening practice
// playback (SpeechSynthesis) and shadowing mode (SpeechRecognition) — no server calls, no
// audio files to generate/host. SpeechRecognition is Chrome/Edge-only; callers should
// feature-detect with `isSpeechRecognitionSupported()` before offering shadowing mode.

// Minimal ambient types for the (non-standardized) SpeechRecognition API — TypeScript's DOM
// lib doesn't ship these.
interface SpeechRecognitionEvent extends Event {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
}

export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/** Records one utterance and resolves with the recognized text (or "" if unsupported/no speech). */
export function recognizeOnce(): Promise<string> {
  return new Promise((resolve) => {
    const SpeechRecognitionCtor = (
      window as unknown as {
        SpeechRecognition?: new () => SpeechRecognition;
        webkitSpeechRecognition?: new () => SpeechRecognition;
      }
    ).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      resolve("");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resolve(event.results[0]?.[0]?.transcript ?? "");
    };
    recognition.onerror = () => resolve("");
    recognition.onend = () => resolve("");

    recognition.start();
  });
}
