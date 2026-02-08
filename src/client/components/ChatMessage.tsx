import type { ChatMessage as ChatMessageType } from "../../shared/types";
import AudioPlayer from "./AudioPlayer";

interface Props {
  message: ChatMessageType;
  isLatest: boolean;
}

export default function ChatMessage({ message, isLatest }: Props) {
  const isUser = message.role === "user";
  const isSummary = message.role === "summary";

  if (isSummary) {
    return (
      <div className="mb-3 animate-fade-up">
        <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 font-display text-xs font-semibold text-brand-600">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            對話整理
          </p>
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
        <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm">
          AI
        </div>
      )}

      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${
          isUser
            ? "rounded-br-md bg-brand-500 text-white"
            : "rounded-bl-md bg-white text-sage-500 ring-1 ring-sage-100"
        }`}
      >
        {isUser && (
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-white/80">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            語音訊息
          </p>
        )}
        {isUser && message.audioBase64 && (
          <AudioPlayer base64={message.audioBase64} autoPlay={false} />
        )}
        {!isUser && message.text && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
            {message.text}
          </p>
        )}
        {!isUser && message.audioBase64 && (
          <AudioPlayer base64={message.audioBase64} autoPlay={isLatest} />
        )}
      </div>
    </div>
  );
}
