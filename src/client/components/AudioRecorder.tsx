interface AudioRecorderProps {
  isRecording: boolean;
  isLoading: boolean;
  isSummarizing: boolean;
  isFinished: boolean;
  hasMessages: boolean;
  onStart: () => void;
  onStop: () => void;
  onSummarize: () => void;
  onNewSession: () => void;
}

export default function AudioRecorder({
  isRecording,
  isLoading,
  isSummarizing,
  isFinished,
  hasMessages,
  onStart,
  onStop,
  onSummarize,
  onNewSession,
}: AudioRecorderProps) {
  if (isFinished) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <button
          onClick={onNewSession}
          className="flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 font-body text-sm font-medium text-white shadow-lg shadow-brand-200 transition-all hover:bg-brand-600 active:scale-95"
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
    <div className="flex items-center justify-center gap-5 py-4">
      {/* Mic button */}
      <button
        onClick={isRecording ? onStop : onStart}
        className={`relative flex h-[68px] w-[68px] items-center justify-center rounded-full transition-all duration-200 active:scale-90 ${
          isRecording
            ? "animate-ripple bg-red-500 hover:bg-red-600"
            : "bg-brand-500 shadow-lg shadow-brand-200 hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-300"
        }`}
      >
        {isRecording ? (
          <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="3" />
          </svg>
        ) : (
          <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>

      {/* Summarize button */}
      {hasMessages && !isRecording && (
        <button
          onClick={onSummarize}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-sage-100 bg-sage-50 text-sage-400 transition-all hover:border-brand-200 hover:text-brand-500 active:scale-90"
          title="整理對話"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}
