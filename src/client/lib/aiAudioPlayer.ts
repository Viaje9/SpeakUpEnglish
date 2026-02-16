import { pauseActiveAudio, releaseAudioFocus, requestAudioFocus } from "./audioFocus";

type PlaybackListener = (activeKey: string | null) => void;

class AiAudioPlayer {
  private audioContext: AudioContext | null = null;
  private outputNode: GainNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private fallbackAudio: HTMLAudioElement | null = null;
  private activeKey: string | null = null;
  private timelinePrimed = false;
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
    if (this.shouldPreferElementPlayback()) return;
    const context = this.ensureContext();
    if (context.state !== "running") {
      await context.resume();
    }
  }

  async prime(): Promise<void> {
    if (this.shouldPreferElementPlayback()) return;
    await this.unlock();
    const context = this.ensureContext();
    this.primeTimeline(context);
  }

  async play(base64: string, key: string): Promise<void> {
    pauseActiveAudio();
    this.stop();

    if (this.shouldPreferElementPlayback()) {
      await this.playWithElement(base64, key);
      return;
    }

    try {
      await this.playWithWebAudio(base64, key);
    } catch {
      await this.playWithElement(base64, key);
    }
  }

  stop(): void {
    let shouldNotify = false;

    if (this.currentSource) {
      const source = this.currentSource;
      this.currentSource = null;
      source.onended = null;
      try {
        source.stop(0);
      } catch {
        // no-op
      }
      source.disconnect();
      shouldNotify = true;
    }

    if (this.fallbackAudio) {
      const audio = this.fallbackAudio;
      this.fallbackAudio = null;
      audio.onended = null;
      audio.onpause = null;
      audio.pause();
      audio.currentTime = 0;
      releaseAudioFocus(audio);
      shouldNotify = true;
    }

    if (this.activeKey !== null) {
      this.activeKey = null;
      shouldNotify = true;
    }

    if (shouldNotify) {
      this.notify();
    }
  }

  private async playWithWebAudio(base64: string, key: string): Promise<void> {
    await this.unlock();
    const context = this.ensureContext();
    if (context.state !== "running") {
      throw new Error("AudioContext is not running");
    }
    const buffer = await this.decodeWav(base64, context);

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

    try {
      source.start(0);
    } catch {
      source.onended = null;
      source.disconnect();
      this.currentSource = null;
      this.activeKey = null;
      this.notify();
      throw new Error("Failed to start WebAudio source");
    }
  }

  private async playWithElement(base64: string, key: string): Promise<void> {
    const audio = new Audio(`data:audio/wav;base64,${base64}`);
    this.fallbackAudio = audio;
    this.activeKey = key;
    this.notify();

    audio.onended = () => {
      if (this.fallbackAudio !== audio) return;
      this.fallbackAudio = null;
      this.activeKey = null;
      releaseAudioFocus(audio);
      this.notify();
    };

    audio.onpause = () => {
      if (this.fallbackAudio !== audio) return;
      if (audio.ended) return;
      this.fallbackAudio = null;
      this.activeKey = null;
      releaseAudioFocus(audio);
      this.notify();
    };

    requestAudioFocus(audio);
    try {
      await audio.play();
    } catch (error) {
      if (this.fallbackAudio === audio) {
        this.fallbackAudio = null;
      }
      audio.onended = null;
      audio.onpause = null;
      audio.pause();
      releaseAudioFocus(audio);
      if (this.activeKey === key) {
        this.activeKey = null;
        this.notify();
      }
      throw error;
    }
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

  private primeTimeline(context: AudioContext): void {
    if (this.timelinePrimed) return;
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate);
      source.connect(this.outputNode!);
      source.onended = () => {
        source.disconnect();
      };
      source.start(0);
      this.timelinePrimed = true;
    } catch {
      // Some browsers may still block start(). Keep unlock flow non-fatal.
    }
  }

  private shouldPreferElementPlayback(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
    const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return isIOSDevice || isIPadOS;
  }
}

const aiAudioPlayer = new AiAudioPlayer();

export function unlockAiAudioContext(): Promise<void> {
  return aiAudioPlayer.unlock();
}

export function playAiAudio(base64: string, key: string): Promise<void> {
  return aiAudioPlayer.play(base64, key);
}

export function primeAiAudioTimeline(): Promise<void> {
  return aiAudioPlayer.prime();
}

export function stopAiAudio(): void {
  aiAudioPlayer.stop();
}

export function subscribeAiAudioPlayback(listener: PlaybackListener): () => void {
  return aiAudioPlayer.subscribe(listener);
}
