import { useEffect, useRef, useState } from "react";
import type { ChatMessage as ChatMessageType } from "../../shared/types";
import { sendTranslate } from "../lib/api";
import AudioPlayer from "./AudioPlayer";

interface Props {
  message: ChatMessageType;
  isLatest: boolean;
  apiKey?: string;
}

export default function ChatMessage({ message, isLatest, apiKey }: Props) {
  const isUser = message.role === "user";
  const isSummary = message.role === "summary";
  const [isAiPlaying, setIsAiPlaying] = useState(false);
  const aiAudioRef = useRef<HTMLAudioElement>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    if (!message.text) return;
    try {
      await navigator.clipboard.writeText(message.text);
      setIsCopied(true);
      setCopyFailed(false);
      setTimeout(() => setIsCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 1500);
    }
  };

  const toggleAiAudio = () => {
    const audio = aiAudioRef.current;
    if (!audio || !message.audioBase64) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.05)) {
      audio.currentTime = 0;
    }
    audio.play().catch(() => {});
  };

  useEffect(() => {
    if (isUser || !message.audioBase64 || !aiAudioRef.current) return;
    const audio = aiAudioRef.current;
    const onEnded = () => setIsAiPlaying(false);
    const onPlay = () => setIsAiPlaying(true);
    const onPause = () => setIsAiPlaying(false);

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    if (isLatest) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [isUser, isLatest, message.audioBase64]);

  if (isSummary) {
    return (
      <div className="mb-3 animate-fade-up">
        <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-display text-xs font-semibold text-brand-600">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              對話整理
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-brand-600 ring-1 ring-brand-200 transition-colors hover:bg-brand-100"
            >
              {copyFailed ? "複製失敗" : isCopied ? "已複製" : "複製"}
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {message.text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex animate-fade-up ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      {/* AI avatar */}
      {!isUser && (
        <div className="mr-2 mt-1 flex shrink-0">
          <div
            className={`relative flex h-8 w-8 items-center justify-center rounded-full border border-brand-200 text-sm font-semibold shadow-sm ${
              isAiPlaying
                ? "bg-brand-200 text-brand-700"
                : "bg-brand-100 text-brand-700"
            }`}
            onClick={toggleAiAudio}
            role={message.audioBase64 ? "button" : undefined}
            tabIndex={message.audioBase64 ? 0 : undefined}
            onKeyDown={(e) => {
              if (!message.audioBase64) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleAiAudio();
              }
            }}
          >
            {isAiPlaying && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                <div className="avatar-liquid-top" />
                <div className="avatar-liquid-bottom" />
              </div>
            )}
            <span className="relative z-10">AI</span>
            {message.audioBase64 && (
              <audio
                ref={aiAudioRef}
                src={`data:audio/wav;base64,${message.audioBase64}`}
                preload="metadata"
                className="hidden"
              />
            )}
          </div>
        </div>
      )}

      <div
        className={`relative flex max-w-[78%] items-center gap-3 rounded-2xl px-4 py-2.5 shadow-sm ${
          isUser
            ? "rounded-br-md bg-brand-500 text-white"
            : "rounded-bl-md bg-white text-sage-500 ring-1 ring-sage-100"
        }`}
      >
        {!isUser && message.text && (
          <button
            disabled={isTranslating}
            onClick={async () => {
              if (showTranslated) {
                setShowTranslated(false);
                return;
              }

              if (translatedText) {
                setShowTranslated(true);
                return;
              }

              try {
                setIsTranslating(true);
                const result = await sendTranslate(message.text, apiKey);
                setTranslatedText(result.translatedText || message.text);
                setShowTranslated(true);
              } catch (err) {
                console.error("Translate failed:", err);
              } finally {
                setIsTranslating(false);
              }
            }}
            className="absolute right-2 top-2 rounded-full bg-sage-50 px-4 py-1.5 text-sm font-semibold text-sage-600 shadow-sm ring-1 ring-sage-200 transition-colors hover:bg-sage-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isTranslating ? "翻譯中..." : showTranslated ? "原文" : "翻譯"}
          </button>
        )}

        {/* 左側內容 */}
        <div className={`min-w-0 flex-1 ${!isUser && message.text ? "pt-10" : ""}`}>
          {isUser && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-white/80">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              語音訊息
            </p>
          )}
          {!isUser && message.text && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
              {showTranslated && translatedText ? translatedText : message.text}
            </p>
          )}
        </div>

        {/* 右側播放按鈕 */}
        {isUser && message.audioBase64 && (
          <AudioPlayer base64={message.audioBase64} autoPlay={false} variant="user" />
        )}
      </div>
    </div>
  );
}
