import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType, Voice, TokenUsage } from "../shared/types";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { blobToWavBase64 } from "./lib/audioUtils";
import { sendChat, sendSummarize } from "./lib/api";
import ChatMessage from "./components/ChatMessage";
import AudioRecorder from "./components/AudioRecorder";
import VoiceSelect from "./components/VoiceSelect";
import ToastContainer from "./components/ToastContainer";
import { useToast } from "./hooks/useToast";

const EMPTY_USAGE: TokenUsage = {
  promptTokens: 0, completionTokens: 0, totalTokens: 0,
  promptTextTokens: 0, promptAudioTokens: 0, completionTextTokens: 0, completionAudioTokens: 0,
};

export default function App() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [voice, setVoice] = useState<Voice>("nova");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [totalUsage, setTotalUsage] = useState<TokenUsage>(EMPTY_USAGE);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const { isRecording, start, stop } = useAudioRecorder();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handlePreview = async () => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    try {
      const res = await fetch(`/api/voice-preview?voice=${voice}`);
      if (!res.ok) throw new Error("Preview failed");
      const { audioBase64 } = await res.json();
      if (previewAudioRef.current) previewAudioRef.current.pause();
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      previewAudioRef.current = audio;
      await audio.play();
    } catch {
      showToast("語音試聽失敗，請稍後再試。");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleStart = async () => {
    try {
      await start();
    } catch {
      showToast("無法存取麥克風，請允許麥克風權限。");
    }
  };

  const handleStop = async () => {
    const blob = await stop();
    if (blob.size === 0) return;
    setIsLoading(true);
    try {
      const audioBase64 = await blobToWavBase64(blob);
      const userMessage: ChatMessageType = { role: "user", audioBase64 };
      setMessages((prev) => [...prev, userMessage]);
      const response = await sendChat(audioBase64, messages, voice);
      const assistantMessage: ChatMessageType = {
        role: "assistant",
        text: response.transcript,
        audioBase64: response.audioBase64,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setTotalUsage((prev) => ({
        promptTokens: prev.promptTokens + response.usage.promptTokens,
        completionTokens: prev.completionTokens + response.usage.completionTokens,
        totalTokens: prev.totalTokens + response.usage.totalTokens,
        promptTextTokens: prev.promptTextTokens + response.usage.promptTextTokens,
        promptAudioTokens: prev.promptAudioTokens + response.usage.promptAudioTokens,
        completionTextTokens: prev.completionTextTokens + response.usage.completionTextTokens,
        completionAudioTokens: prev.completionAudioTokens + response.usage.completionAudioTokens,
      }));
    } catch (err) {
      console.error("Send failed:", err);
      setMessages((prev) => prev.slice(0, -1));
      showToast("訊息傳送失敗，請再試一次。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    try {
      // Only send user/assistant messages (not previous summaries)
      const chatHistory = messages.filter((m) => m.role !== "summary");
      const response = await sendSummarize(chatHistory);
      const summaryMessage: ChatMessageType = { role: "summary", text: response.summary };
      setMessages((prev) => [...prev, summaryMessage]);
      setIsFinished(true);
      setTotalUsage((prev) => ({
        promptTokens: prev.promptTokens + response.usage.promptTokens,
        completionTokens: prev.completionTokens + response.usage.completionTokens,
        totalTokens: prev.totalTokens + response.usage.totalTokens,
        promptTextTokens: prev.promptTextTokens + response.usage.promptTextTokens,
        promptAudioTokens: prev.promptAudioTokens + response.usage.promptAudioTokens,
        completionTextTokens: prev.completionTextTokens + response.usage.completionTextTokens,
        completionAudioTokens: prev.completionAudioTokens + response.usage.completionAudioTokens,
      }));
    } catch {
      showToast("整理失敗，請再試一次。");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    setIsFinished(false);
    setTotalUsage(EMPTY_USAGE);
  };

  const hasUserMessages = messages.some((m) => m.role === "user");

  const costUSD = (() => {
    const r = { textIn: 0.15, audioIn: 10, textOut: 0.60, audioOut: 20 };
    return (
      totalUsage.promptTextTokens * r.textIn +
      totalUsage.promptAudioTokens * r.audioIn +
      totalUsage.completionTextTokens * r.textOut +
      totalUsage.completionAudioTokens * r.audioOut
    ) / 1_000_000;
  })();
  const costTWD = costUSD * 32.5;

  return (
    <div className="mx-auto flex h-dvh max-w-lg flex-col bg-surface font-body">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <header className="relative shrink-0 border-b border-sage-100 bg-white px-4 pb-3 pt-4">
        <h1 className="text-center font-display text-xl font-semibold tracking-tight text-sage-500">
          SpeakUp English
        </h1>
        <p className="mt-0.5 text-center text-[11px] tracking-wide text-sage-300">
          AI 英語口說練習
        </p>

        {/* Voice selector */}
        <div className="mt-2.5 flex items-center justify-center">
          <VoiceSelect
            value={voice}
            onChange={setVoice}
            onPreview={handlePreview}
            isPreviewing={isPreviewing}
          />
        </div>
      </header>

      {/* Chat area */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-100">
              <svg className="h-10 w-10 text-brand-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-display text-base font-semibold text-sage-500">
                準備好練習了嗎？
              </p>
              <p className="mt-1 text-xs leading-relaxed text-sage-300">
                點擊下方麥克風開始說話
                <br />
                AI 會用語音和文字回覆你
              </p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            message={msg}
            isLatest={i === messages.length - 1}
          />
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Cost bar */}
      {totalUsage.totalTokens > 0 && (
        <div className="shrink-0 border-t border-sage-100 bg-sage-50 px-4 py-1.5 text-center font-body text-[10px] tracking-wide text-sage-300">
          {totalUsage.totalTokens.toLocaleString()} tokens
          {" / "}${costUSD.toFixed(4)} USD
          {" / "}NT${costTWD.toFixed(2)}
        </div>
      )}

      {/* Recorder */}
      <footer className="shrink-0 border-t border-sage-100 bg-white">
        <AudioRecorder
          isRecording={isRecording}
          isLoading={isLoading}
          isSummarizing={isSummarizing}
          isFinished={isFinished}
          hasMessages={hasUserMessages}
          onStart={handleStart}
          onStop={handleStop}
          onSummarize={handleSummarize}
          onNewSession={handleNewSession}
        />
      </footer>
    </div>
  );
}
