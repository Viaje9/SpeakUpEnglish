interface AudioRecorderProps {
  isRecording: boolean;
  isLoading: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function AudioRecorder({
  isRecording,
  isLoading,
  onStart,
  onStop,
}: AudioRecorderProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-2 py-5">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-brand-400 [animation-delay:300ms]" />
        </div>
        <span className="font-body text-xs font-medium tracking-wide text-sage-400">
          AI 思考中...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4">
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

      <span
        className={`font-body text-xs font-medium tracking-wide ${
          isRecording ? "text-red-500" : "text-sage-300"
        }`}
      >
        {isRecording ? "點擊停止錄音" : "點擊開始說話"}
      </span>
    </div>
  );
}
