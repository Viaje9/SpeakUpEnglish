import { useEffect, useRef, useState } from "react";

interface AudioRecorderProps {
  isRecording: boolean;
  isLoading: boolean;
  isSummarizing: boolean;
  isFinished: boolean;
  hasMessages: boolean;
  isPaused: boolean;
  isAiChatOpen: boolean;
  isNotePanelOpen: boolean;
  onStart: () => void;
  onStop: () => void;
  onTogglePause: () => void;
  onCancel: () => void;
  onSummarize: () => void;
  onRequestNewSession: () => void;
  onToggleAiChat: () => void;
  onToggleNotePanel: () => void;
}

export default function AudioRecorder({
  isRecording,
  isLoading,
  isSummarizing,
  isFinished,
  hasMessages,
  isPaused,
  isAiChatOpen,
  isNotePanelOpen,
  onStart,
  onStop,
  onTogglePause,
  onCancel,
  onSummarize,
  onRequestNewSession,
  onToggleAiChat,
  onToggleNotePanel,
}: AudioRecorderProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const recordingStartedAtRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);

  useEffect(() => {
    if (!isRecording) {
      recordingStartedAtRef.current = null;
      accumulatedMsRef.current = 0;
      setElapsedSeconds(0);
      return;
    }

    if (recordingStartedAtRef.current === null) {
      recordingStartedAtRef.current = Date.now();
    }

    if (isPaused) {
      if (recordingStartedAtRef.current !== null) {
        accumulatedMsRef.current += Date.now() - recordingStartedAtRef.current;
        recordingStartedAtRef.current = null;
      }
      setElapsedSeconds(Math.floor(accumulatedMsRef.current / 1000));
      return;
    }

    if (recordingStartedAtRef.current === null) {
      recordingStartedAtRef.current = Date.now();
    }

    const timerId = window.setInterval(() => {
      const runningMs = recordingStartedAtRef.current
        ? Date.now() - recordingStartedAtRef.current
        : 0;
      setElapsedSeconds(Math.floor((accumulatedMsRef.current + runningMs) / 1000));
    }, 250);

    return () => {
      window.clearInterval(timerId);
    };
  }, [isRecording, isPaused]);

  if (isFinished) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <button
          onClick={onRequestNewSession}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 font-body text-sm font-medium text-white shadow-lg shadow-brand-200 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          開始新對話
        </button>
      </div>
    );
  }

  if (isLoading || isSummarizing) {
    return (
      <div className="flex flex-col items-center gap-2 py-5">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:300ms]" />
        </div>
        <span className="font-body text-xs font-medium tracking-wide text-sage-400">
          {isSummarizing ? "整理對話中..." : "AI 思考中..."}
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-4">
      {/* Left slot */}
      <div className={isRecording ? "flex justify-end pr-5" : "flex items-center justify-between pl-4 pr-2"}>
        {isRecording ? (
          <button
            onClick={onCancel}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-sage-100 bg-sage-50 text-sage-400 active:scale-90"
            title="取消錄音"
            aria-label="取消錄音"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <>
            <button
              onClick={onToggleAiChat}
              aria-label={isAiChatOpen ? "關閉 AI 助手" : "開啟 AI 助手"}
              className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors active:scale-90 ${
                isAiChatOpen
                  ? "border-sky-300 bg-sky-100 text-sky-700"
                  : "border-sky-200 bg-white text-sky-600 hover:bg-sky-50"
              }`}
              title={isAiChatOpen ? "關閉 AI 助手" : "開啟 AI 助手"}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 6.75V4.5m0 2.25h2.25M18 6.75h-2.25M18 6.75V9" />
              </svg>
            </button>
            {hasMessages && (
              <button
                onClick={onRequestNewSession}
                aria-label="開始新對話"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-sage-200 bg-white text-sage-600 transition-colors hover:bg-sage-50 active:scale-90"
                title="開始新對話"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>

      {/* Mic button — always centered */}
      <button
        onClick={isRecording ? onStop : onStart}
        className={`relative flex h-[68px] w-[68px] items-center justify-center rounded-full active:scale-90 ${
          isRecording && !isPaused
            ? "animate-ripple bg-red-500"
            : isRecording
              ? "bg-red-400 shadow-lg shadow-red-200"
              : "bg-brand-500 shadow-lg shadow-brand-200"
        }`}
      >
        {isRecording ? (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <svg className="mt-0.5 h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="3" />
            </svg>
            <span className="mt-1 text-[10px] font-semibold leading-none text-white/95 tabular-nums">
              {elapsedSeconds}s
            </span>
          </div>
        ) : (
          <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>

      {/* Right slot */}
      <div className={isRecording ? "flex justify-start pl-5" : "flex w-full items-center pl-2 pr-4"}>
        {isRecording ? (
          <button
            onClick={onTogglePause}
            aria-label={isPaused ? "繼續錄音" : "暫停錄音"}
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors active:scale-90 ${
              isPaused
                ? "border-slate-300 bg-slate-200 text-slate-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title={isPaused ? "繼續錄音" : "暫停錄音"}
          >
            {isPaused ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5v14l11-7-11-7z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="7.5" y="5.5" width="3.5" height="13" rx="1.2" />
                <rect x="13" y="5.5" width="3.5" height="13" rx="1.2" />
              </svg>
            )}
          </button>
        ) : (
          <>
            {hasMessages && (
              <button
                onClick={onSummarize}
                aria-label="整理對話重點"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-200 bg-white text-brand-600 shadow-sm transition-colors hover:bg-brand-50 active:scale-90"
                title="整理對話重點"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h6M9 8h6M5.25 4.5h13.5A1.5 1.5 0 0120.25 6v12a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V6a1.5 1.5 0 011.5-1.5z" />
                </svg>
              </button>
            )}
            <button
              onClick={onToggleNotePanel}
              aria-label={isNotePanelOpen ? "關閉小抄筆記" : "開啟小抄筆記"}
              className={`ml-auto flex h-11 w-11 items-center justify-center rounded-full border transition-colors active:scale-90 ${
                isNotePanelOpen
                  ? "border-amber-300 bg-amber-100 text-amber-700"
                  : "border-amber-200 bg-white text-amber-600 hover:bg-amber-50"
              }`}
              title={isNotePanelOpen ? "關閉小抄筆記" : "開啟小抄筆記"}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 3.75h6.586a1.5 1.5 0 011.06.44l2.164 2.164a1.5 1.5 0 01.44 1.06v11.836A1.5 1.5 0 0116.75 20.75h-9.5A1.5 1.5 0 015.75 19.25v-14A1.5 1.5 0 017.25 3.75H8z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.25h6M9 12.75h6M9 16.25h4" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
