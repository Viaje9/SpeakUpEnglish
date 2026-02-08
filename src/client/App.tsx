import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType, Voice, TokenUsage } from "../shared/types";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { blobToWavBase64 } from "./lib/audioUtils";
import { sendChat, sendSummarize } from "./lib/api";
import { createConversation, appendMessage, setSummary, migrateFromLocalStorage } from "./lib/db";
import ChatMessage from "./components/ChatMessage";
import AudioRecorder from "./components/AudioRecorder";
import SettingsPage from "./components/SettingsPage";
import HistoryPage from "./components/HistoryPage";
import ToastContainer from "./components/ToastContainer";
import { useToast } from "./hooks/useToast";

type Page = "chat" | "settings" | "history";

const EMPTY_USAGE: TokenUsage = {
  promptTokens: 0, completionTokens: 0, totalTokens: 0,
  promptTextTokens: 0, promptAudioTokens: 0, completionTextTokens: 0, completionAudioTokens: 0,
};

export default function App() {
  const [page, setPage] = useState<Page>("chat");
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [voice, setVoice] = useState<Voice>(() => {
    return (localStorage.getItem("speakup_voice") as Voice) || "nova";
  });
  const [totalUsage, setTotalUsage] = useState<TokenUsage>(EMPTY_USAGE);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { toasts, show: showToast, dismiss: dismissToast } = useToast();
  const { isRecording, start, stop, cancel } = useAudioRecorder();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    migrateFromLocalStorage();
  }, []);

  const handleChangeVoice = (v: Voice) => {
    setVoice(v);
    localStorage.setItem("speakup_voice", v);
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
      addUsage(response.usage);

      // Persist to IndexedDB
      let convId = conversationId;
      if (!convId) {
        convId = await createConversation();
        setConversationId(convId);
      }
      const baseOrder = messages.length;
      await appendMessage(convId, userMessage, baseOrder);
      await appendMessage(convId, assistantMessage, baseOrder + 1);
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
      const chatHistory = messages.filter((m) => m.role !== "summary");
      const response = await sendSummarize(chatHistory);
      const summaryMessage: ChatMessageType = { role: "summary", text: response.summary };
      setMessages((prev) => [...prev, summaryMessage]);
      setIsFinished(true);
      addUsage(response.usage);

      // Persist summary to IndexedDB
      if (conversationId) {
        await appendMessage(conversationId, summaryMessage, messages.length);
        await setSummary(conversationId, response.summary);
      }
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
    setConversationId(null);
  };

  const handleLoadConversation = (convId: string, msgs: ChatMessageType[]) => {
    setConversationId(convId);
    setMessages(msgs);
    setIsFinished(msgs.some((m) => m.role === "summary"));
    setTotalUsage(EMPTY_USAGE);
    setPage("chat");
  };

  const addUsage = (usage: TokenUsage) => {
    setTotalUsage((prev) => ({
      promptTokens: prev.promptTokens + usage.promptTokens,
      completionTokens: prev.completionTokens + usage.completionTokens,
      totalTokens: prev.totalTokens + usage.totalTokens,
      promptTextTokens: prev.promptTextTokens + usage.promptTextTokens,
      promptAudioTokens: prev.promptAudioTokens + usage.promptAudioTokens,
      completionTextTokens: prev.completionTextTokens + usage.completionTextTokens,
      completionAudioTokens: prev.completionAudioTokens + usage.completionAudioTokens,
    }));
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

      {page === "settings" && (
        <SettingsPage
          voice={voice}
          onChangeVoice={handleChangeVoice}
          onBack={() => setPage("chat")}
        />
      )}

      {page === "history" && (
        <HistoryPage
          onBack={() => setPage("chat")}
          onLoadConversation={handleLoadConversation}
        />
      )}

      {page === "chat" && (
        <>
          {/* Header */}
          <header className="relative flex shrink-0 items-center border-b border-sage-100 bg-white px-4 py-3">
            {/* Left: history */}
            <button
              onClick={() => setPage("history")}
              className="rounded-lg p-1.5 text-sage-400 transition-colors hover:bg-sage-50 hover:text-sage-500"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Center */}
            <div className="flex-1 text-center">
              <h1 className="font-display text-base font-semibold tracking-tight text-sage-500">
                SpeakUp English
              </h1>
              <p className="text-[10px] tracking-wide text-sage-300">
                AI 英語口說練習
              </p>
            </div>

            {/* Right: settings */}
            <button
              onClick={() => setPage("settings")}
              className="rounded-lg p-1.5 text-sage-400 transition-colors hover:bg-sage-50 hover:text-sage-500"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
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
              onCancel={cancel}
              onSummarize={handleSummarize}
              onNewSession={handleNewSession}
            />
          </footer>
        </>
      )}
    </div>
  );
}
