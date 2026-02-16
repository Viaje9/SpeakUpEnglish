import { pauseActiveAudio } from "./audioFocus";

type PlaybackListener = (activeKey: string | null) => void;

class AiAudioPlayer {
  private audioContext: AudioContext | null = null;
  private outputNode: GainNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private activeKey: string | null = null;
  private listeners = new Set<PlaybackListener>();
  private decodeCache = new Map<string, AudioBuffer>();
  private decodeInFlight = new Map<string, Promise<AudioBuffer>>();

  subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.activeKey);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === "running") return;
    await context.resume();
  }

  async play(base64: string, key: string): Promise<void> {
    pauseActiveAudio();
    await this.unlock();

    const context = this.ensureContext();
    if (context.state !== "running") {
      throw new Error("AudioContext is not running");
    }

    const buffer = await this.decodeWav(base64, context);
    this.stop();

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputNode!);

    this.currentSource = source;
    this.activeKey = key;
    this.notify();

    source.onended = () => {
      if (this.currentSource !== source) return;
      source.disconnect();
      this.currentSource = null;
      this.activeKey = null;
      this.notify();
    };

    source.start(0);
  }

  stop(): void {
    if (!this.currentSource) return;
    const source = this.currentSource;
    this.currentSource = null;
    this.activeKey = null;
    source.onended = null;
    try {
      source.stop(0);
    } catch {
      // no-op
    }
    source.disconnect();
    this.notify();
  }

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.outputNode = this.audioContext.createGain();
      this.outputNode.connect(this.audioContext.destination);
    }
    return this.audioContext;
  }

  private async decodeWav(base64: string, context: AudioContext): Promise<AudioBuffer> {
    const cached = this.decodeCache.get(base64);
    if (cached) return cached;

    const inFlight = this.decodeInFlight.get(base64);
    if (inFlight) return inFlight;

    const decodePromise = (async () => {
      try {
        const arrayBuffer = this.base64ToArrayBuffer(base64);
        const decoded = await context.decodeAudioData(arrayBuffer);
        this.decodeCache.set(base64, decoded);
        return decoded;
      } finally {
        this.decodeInFlight.delete(base64);
      }
    })();

    this.decodeInFlight.set(base64, decodePromise);
    return decodePromise;
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.activeKey);
    }
  }
}

const aiAudioPlayer = new AiAudioPlayer();

export function unlockAiAudioContext(): Promise<void> {
  return aiAudioPlayer.unlock();
}

export function playAiAudio(base64: string, key: string): Promise<void> {
  return aiAudioPlayer.play(base64, key);
}

export function stopAiAudio(): void {
  aiAudioPlayer.stop();
}

export function subscribeAiAudioPlayback(listener: PlaybackListener): () => void {
  return aiAudioPlayer.subscribe(listener);
}
