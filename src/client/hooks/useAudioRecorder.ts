import { useState, useRef, useCallback } from "react";

export type RecorderStartErrorCode =
  | "INSECURE_CONTEXT"
  | "MEDIA_DEVICES_UNAVAILABLE"
  | "MEDIA_RECORDER_UNSUPPORTED";

export class RecorderStartError extends Error {
  code: RecorderStartErrorCode;

  constructor(code: RecorderStartErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pendingStopResolverRef = useRef<((blob: Blob) => void) | null>(null);
  const bufferedStopBlobRef = useRef<Blob | null>(null);
  const discardOnStopRef = useRef(false);

  const consumeBufferedBlob = () => {
    const blob = bufferedStopBlobRef.current;
    bufferedStopBlobRef.current = null;
    return blob ?? new Blob();
  };

  const start = useCallback(async () => {
    if (!window.isSecureContext) {
      throw new RecorderStartError(
        "INSECURE_CONTEXT",
        "Microphone access requires a secure context (HTTPS or localhost).",
      );
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new RecorderStartError(
        "MEDIA_DEVICES_UNAVAILABLE",
        "navigator.mediaDevices.getUserMedia is unavailable.",
      );
    }
    if (typeof MediaRecorder === "undefined") {
      throw new RecorderStartError(
        "MEDIA_RECORDER_UNSUPPORTED",
        "MediaRecorder is not supported in this browser.",
      );
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferredTypes = [
      "audio/webm;codecs=opus",
      "audio/mp4",
      "audio/webm",
    ];
    const supportedType = preferredTypes.find((t) => MediaRecorder.isTypeSupported?.(t));
    const recorder = supportedType ? new MediaRecorder(stream, { mimeType: supportedType }) : new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    bufferedStopBlobRef.current = null;
    discardOnStopRef.current = false;
    pendingStopResolverRef.current = null;
    setIsPaused(false);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const shouldDiscard = discardOnStopRef.current;
      discardOnStopRef.current = false;
      const blob = shouldDiscard
        ? new Blob()
        : new Blob(chunksRef.current, { type: recorder.mimeType });
      chunksRef.current = [];
      recorder.stream.getTracks().forEach((t) => t.stop());
      if (mediaRecorderRef.current === recorder) {
        mediaRecorderRef.current = null;
      }
      setIsRecording(false);
      setIsPaused(false);

      const resolve = pendingStopResolverRef.current;
      pendingStopResolverRef.current = null;
      if (resolve) {
        resolve(blob);
      } else if (!shouldDiscard && blob.size > 0) {
        // If recording stops unexpectedly, keep blob so the next stop() can consume it.
        bufferedStopBlobRef.current = blob;
      }
    };

    recorder.start();
    setIsRecording(true);
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(consumeBufferedBlob());
        return;
      }
      discardOnStopRef.current = false;
      pendingStopResolverRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      setIsPaused(true);
      return;
    }
    if (recorder.state === "paused") {
      recorder.resume();
      setIsPaused(false);
    }
  }, []);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    bufferedStopBlobRef.current = null;
    discardOnStopRef.current = true;
    chunksRef.current = [];
    const pendingResolve = pendingStopResolverRef.current;
    pendingStopResolverRef.current = null;
    pendingResolve?.(new Blob());

    if (recorder.state === "recording" || recorder.state === "paused") {
      recorder.stop();
      return;
    }

    recorder.stream.getTracks().forEach((t) => t.stop());
    if (mediaRecorderRef.current === recorder) {
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  return { isRecording, isPaused, start, stop, togglePause, cancel };
}
