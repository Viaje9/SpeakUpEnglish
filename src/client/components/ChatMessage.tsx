import type { ChatMessage as ChatMessageType } from "../../shared/types";
import AudioPlayer from "./AudioPlayer";

interface Props {
  message: ChatMessageType;
  isLatest: boolean;
}

export default function ChatMessage({ message, isLatest }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-500 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-900 rounded-bl-sm"
        }`}
      >
        {isUser && (
          <p className="text-sm opacity-80 italic mb-1">🎤 Voice message</p>
        )}
        {isUser && message.audioBase64 && (
          <AudioPlayer base64={message.audioBase64} autoPlay={false} />
        )}
        {!isUser && message.text && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
        )}
        {!isUser && message.audioBase64 && (
          <AudioPlayer base64={message.audioBase64} autoPlay={isLatest} />
        )}
      </div>
    </div>
  );
}
