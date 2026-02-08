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
  return (
    <div className="flex items-center justify-center gap-4 p-4">
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm">AI is thinking...</span>
        </div>
      ) : (
        <button
          onClick={isRecording ? onStop : onStart}
          className={`flex h-16 w-16 items-center justify-center rounded-full transition-all ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 animate-pulse"
              : "bg-blue-500 hover:bg-blue-600"
          } text-white shadow-lg active:scale-95`}
        >
          {isRecording ? (
            <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </button>
      )}
      {isRecording && (
        <span className="text-sm text-red-500 font-medium">Recording...</span>
      )}
    </div>
  );
}
