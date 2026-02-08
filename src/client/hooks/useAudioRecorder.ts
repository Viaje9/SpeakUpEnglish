import { useState, useRef, useCallback } from "react";

const MAX_DURATION_MS = 30_000;

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start();
    setIsRecording(true);

    timerRef.current = setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, MAX_DURATION_MS);
  }, []);

  const stop = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== "recording") {
        resolve(new Blob());
        return;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        // Stop all tracks to release the microphone
        recorder.stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Discard chunks and suppress onstop handler
    chunksRef.current = [];
    recorder.onstop = () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
    };

    if (recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  return { isRecording, start, stop, cancel };
}
