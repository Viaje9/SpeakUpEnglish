import { useState, useRef } from "react";
import type { Voice } from "../../shared/types";
import { VOICES } from "../../shared/types";

interface Props {
  voice: Voice;
  onChangeVoice: (v: Voice) => void;
  onBack: () => void;
}

export default function SettingsPage({ voice, onChangeVoice, onBack }: Props) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePreview = async (v: Voice) => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    try {
      const res = await fetch(`/api/voice-preview?voice=${v}`);
      if (!res.ok) throw new Error();
      const { audioBase64 } = await res.json();
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audioRef.current = audio;
      await audio.play();
    } catch {
      // silent fail
    } finally {
      setIsPreviewing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center border-b border-sage-100 bg-white px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-sage-400 transition-colors hover:bg-sage-50 hover:text-sage-500"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="flex-1 text-center font-display text-base font-semibold text-sage-500">
          設定
        </h2>
        <div className="w-8" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-3 font-body text-xs font-medium tracking-wide text-sage-400">
          AI 語音
        </p>
        <div className="space-y-1.5">
          {VOICES.map((v) => {
            const selected = v === voice;
            return (
              <div
                key={v}
                className={`flex items-center justify-between rounded-xl px-4 py-3 transition-colors ${
                  selected
                    ? "bg-brand-50 ring-1 ring-brand-200"
                    : "bg-white ring-1 ring-sage-100 hover:ring-sage-200"
                }`}
              >
                <button
                  onClick={() => onChangeVoice(v)}
                  className="flex flex-1 items-center gap-3"
                >
                  {selected ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500">
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-sage-200" />
                  )}
                  <span
                    className={`font-body text-sm ${
                      selected ? "font-medium text-brand-600" : "text-sage-500"
                    }`}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </span>
                </button>
                <button
                  onClick={() => handlePreview(v)}
                  disabled={isPreviewing}
                  className="rounded-lg p-2 text-sage-300 transition-colors hover:bg-sage-50 hover:text-brand-500 disabled:opacity-40"
                >
                  {isPreviewing ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
