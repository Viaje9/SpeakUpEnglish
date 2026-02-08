import { useEffect, useRef, useState } from "react";
import { releaseAudioFocus, requestAudioFocus } from "../lib/audioFocus";

interface AudioPlayerProps {
  base64: string;
  autoPlay?: boolean;
  variant?: "user" | "ai";
  onPlayingChange?: (playing: boolean) => void;
  className?: string;
  size?: "default" | "compact";
}

export default function AudioPlayer({
  base64,
  autoPlay = true,
  variant = "ai",
  onPlayingChange,
  className = "",
  size = "default",
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      setPlaying(false);
      releaseAudioFocus(audio);
    };
    const onPlay = () => {
      requestAudioFocus(audio);
      setPlaying(true);
    };
    const onPause = () => {
      setPlaying(false);
      releaseAudioFocus(audio);
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [base64]);

  useEffect(() => {
    if (autoPlay && audioRef.current) {
      requestAudioFocus(audioRef.current);
      audioRef.current.play().catch(() => {});
    }
  }, [base64, autoPlay]);

  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.currentTime = 0;
      requestAudioFocus(audio);
      audio.play().catch(() => {});
    }
  };

  const isUser = variant === "user";
  const src = `data:audio/wav;base64,${base64}`;
  const isCompact = size === "compact";

  return (
    <>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        className={`flex shrink-0 items-center justify-center rounded-full transition-colors ${
          isUser
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-brand-100 text-brand-600 hover:bg-brand-200"
        } ${isCompact ? "h-5 w-5" : "h-8 w-8"} ${className}`}
      >
        {playing ? (
          <svg className={isCompact ? "h-2.5 w-2.5" : "h-4 w-4"} fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className={isCompact ? "h-2.5 w-2.5" : "h-4 w-4"} fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
    </>
  );
}
