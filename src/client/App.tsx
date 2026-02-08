import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType, Voice, TokenUsage } from "../shared/types";
import { DEFAULT_SYSTEM_PROMPT } from "../shared/types";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { RecorderStartError } from "./hooks/useAudioRecorder";
import { blobToWavBase64 } from "./lib/audioUtils";
import { sendChat, sendSummarize } from "./lib/api";
import {
  createConversation,
  appendMessage,
  setSummary,
  migrateFromLocalStorage,
  deleteConversation,
} from "./lib/db";
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

const FLOATING_BTN_HEIGHT = 56;
const FLOATING_BTN_MARGIN = 12;
const NOTE_PANEL_SIDE_GAP = 12;
const NOTE_PANEL_HEIGHT = 320;
const NOTE_PANEL_SAFE_BOTTOM = 136;

export default function App() {
  const [page, setPage] = useState<Page>("chat");
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [voice, setVoice] = useState<Voice>(() => {
    return (localStorage.getItem("speakup_voice") as Voice) || "nova";
  });
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("speakup_openai_api_key") || "");
  const [systemPrompt, setSystemPrompt] = useState<string>(() => {
    return localStorage.getItem("speakup_system_prompt") || DEFAULT_SYSTEM_PROMPT;
  });
  const [memory, setMemory] = useState<string>(() => localStorage.getItem("speakup_memory") || "");
  const [autoMemoryEnabled, setAutoMemoryEnabled] = useState<boolean>(() => {
    return localStorage.getItem("speakup_auto_memory_enabled") === "1";
  });
  const [totalUsage, setTotalUsage] = useState<TokenUsage>(EMPTY_USAGE);
  const [lastIncreaseTWD, setLastIncreaseTWD] = useState(0);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [autoPlaySignature, setAutoPlaySignature] = useState<string | null>(null);
  const [confirmNewChatOpen, setConfirmNewChatOpen] = useState(false);
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false);
  const [noteText, setNoteText] = useState<string>(() => localStorage.getItem("speakup_floating_note") || "");
  const [floatingBtnTop, setFloatingBtnTop] = useState(() => {
    if (typeof window === "undefined") return 280;
    return Math.max(FLOATING_BTN_MARGIN, window.innerHeight / 2 - FLOATING_BTN_HEIGHT / 2);
  });
  const [notePanelTop, setNotePanelTop] = useState(() => {
    if (typeof window === "undefined") return 96;
    const maxTop = Math.max(
      FLOATING_BTN_MARGIN,
      window.innerHeight - NOTE_PANEL_HEIGHT - NOTE_PANEL_SAFE_BOTTOM,
    );
    return Math.min(Math.max(96, FLOATING_BTN_MARGIN), maxTop);
  });

  const dragStateRef = useRef({
    active: false,
    pointerId: -1,
    offsetY: 0,
    startClientY: 0,
  });
  const noteDragStateRef = useRef({
    active: false,
    pointerId: -1,
    offsetY: 0,
  });
  const floatingDraggedRef = useRef(false);
  const notePanelRef = useRef<HTMLDivElement>(null);

  const { toasts, show: showToast, dismiss: dismissToast } = useToast();
  const { isRecording, start, stop, cancel } = useAudioRecorder();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    migrateFromLocalStorage();
  }, []);

  useEffect(() => {
    const clampFloatingTop = (top: number) => {
      const maxTop = Math.max(FLOATING_BTN_MARGIN, window.innerHeight - FLOATING_BTN_HEIGHT - FLOATING_BTN_MARGIN);
      return Math.min(Math.max(top, FLOATING_BTN_MARGIN), maxTop);
    };

    const clampNoteTop = (top: number) => {
      const maxTop = Math.max(FLOATING_BTN_MARGIN, window.innerHeight - NOTE_PANEL_HEIGHT - NOTE_PANEL_SAFE_BOTTOM);
      return Math.min(Math.max(top, FLOATING_BTN_MARGIN), maxTop);
    };

    const handleResize = () => {
      setFloatingBtnTop((prev) => clampFloatingTop(prev));
      setNotePanelTop((prev) => clampNoteTop(prev));
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleFloatingPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    floatingDraggedRef.current = false;
    const rect = event.currentTarget.getBoundingClientRect();
    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      offsetY: event.clientY - rect.top,
      startClientY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleFloatingPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;

    const maxTop = Math.max(FLOATING_BTN_MARGIN, window.innerHeight - FLOATING_BTN_HEIGHT - FLOATING_BTN_MARGIN);
    const nextTop = event.clientY - dragState.offsetY;
    if (Math.abs(event.clientY - dragState.startClientY) > 3) {
      floatingDraggedRef.current = true;
    }
    setFloatingBtnTop(Math.min(Math.max(nextTop, FLOATING_BTN_MARGIN), maxTop));
  };

  const handleFloatingPointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    dragStateRef.current = {
      active: false,
      pointerId: -1,
      offsetY: 0,
      startClientY: 0,
    };

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleFloatingButtonClick = () => {
    if (floatingDraggedRef.current) {
      floatingDraggedRef.current = false;
      return;
    }
    setIsNotePanelOpen((prev) => !prev);
  };

  const handleNotePanelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("textarea,button,input,a")) return;

    const panelElement = notePanelRef.current;
    if (!panelElement) return;

    event.preventDefault();
    const rect = panelElement.getBoundingClientRect();
    noteDragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      offsetY: event.clientY - rect.top,
    };
    panelElement.setPointerCapture(event.pointerId);
  };

  const handleNotePanelPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = noteDragStateRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;

    const maxTop = Math.max(FLOATING_BTN_MARGIN, window.innerHeight - NOTE_PANEL_HEIGHT - NOTE_PANEL_SAFE_BOTTOM);
    const nextTop = event.clientY - dragState.offsetY;
    setNotePanelTop(Math.min(Math.max(nextTop, FLOATING_BTN_MARGIN), maxTop));
  };

  const handleNotePanelPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = noteDragStateRef.current;
    if (dragState.pointerId !== event.pointerId) return;

    noteDragStateRef.current = {
      active: false,
      pointerId: -1,
      offsetY: 0,
    };

    if (notePanelRef.current?.hasPointerCapture(event.pointerId)) {
      notePanelRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const handleNoteTextChange = (value: string) => {
    setNoteText(value);
    localStorage.setItem("speakup_floating_note", value);
  };

  const handleSaveSettings = (
    nextVoice: Voice,
    nextApiKey: string,
    nextSystemPrompt: string,
    nextMemory: string,
    nextAutoMemoryEnabled: boolean,
  ) => {
    const normalizedKey = nextApiKey.trim();
    const normalizedSystemPrompt = nextSystemPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
    const normalizedMemory = nextMemory.trim();
    setVoice(nextVoice);
    setApiKey(normalizedKey);
    setSystemPrompt(normalizedSystemPrompt);
    setMemory(normalizedMemory);
    setAutoMemoryEnabled(nextAutoMemoryEnabled);
    localStorage.setItem("speakup_voice", nextVoice);
    localStorage.setItem("speakup_openai_api_key", normalizedKey);
    localStorage.setItem("speakup_system_prompt", normalizedSystemPrompt);
    localStorage.setItem("speakup_memory", normalizedMemory);
    localStorage.setItem("speakup_auto_memory_enabled", nextAutoMemoryEnabled ? "1" : "0");
    showToast("設定已儲存");
    setPage("chat");
  };

  const handleStart = async () => {
    try {
      await start();
    } catch (err) {
      if (err instanceof RecorderStartError) {
        if (err.code === "INSECURE_CONTEXT") {
          showToast("iOS PWA 需要 HTTPS 才能使用麥克風（localhost 除外）。");
          return;
        }
        if (err.code === "MEDIA_DEVICES_UNAVAILABLE") {
          showToast("此環境無法使用麥克風 API，請改用 Safari HTTPS 頁面測試。");
          return;
        }
        if (err.code === "MEDIA_RECORDER_UNSUPPORTED") {
          showToast("此裝置或瀏覽器不支援錄音功能。");
          return;
        }
      }

      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          showToast("麥克風權限被拒絕，請到 iOS 設定允許 Safari/網站麥克風。");
          return;
        }
        if (err.name === "NotFoundError") {
          showToast("找不到可用麥克風裝置。");
          return;
        }
      }

      showToast("無法存取麥克風，請確認 HTTPS 與麥克風權限。");
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
      const response = await sendChat(
        audioBase64,
        messages,
        voice,
        systemPrompt,
        memory,
        autoMemoryEnabled,
        apiKey,
      );
      const assistantMessage: ChatMessageType = {
        role: "assistant",
        text: response.transcript,
        audioBase64: response.audioBase64,
      };
      setAutoPlaySignature(response.audioBase64);
      setMessages((prev) => [...prev, assistantMessage]);
      if (response.memoryUpdate?.memory) {
        setMemory(response.memoryUpdate.memory);
        localStorage.setItem("speakup_memory", response.memoryUpdate.memory);
      }
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
      setAutoPlaySignature(null);
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
      const response = await sendSummarize(chatHistory, apiKey);
      const summaryMessage: ChatMessageType = { role: "summary", text: response.summary };
      setMessages((prev) => [...prev, summaryMessage]);
      setIsFinished(true);
      addUsage(response.usage);

      // Persist summary to IndexedDB
      if (conversationId) {
        await appendMessage(conversationId, summaryMessage, messages.length);
        await setSummary(conversationId, response.summary, response.title);
      }
    } catch {
      showToast("整理失敗，請再試一次。");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    setAutoPlaySignature(null);
    setIsFinished(false);
    setTotalUsage(EMPTY_USAGE);
    setLastIncreaseTWD(0);
    setConversationId(null);
  };

  const handleConfirmNewSession = async () => {
    if (conversationId) {
      try {
        await deleteConversation(conversationId);
      } catch {
        showToast("刪除聊天記錄失敗，請稍後再試。");
        return;
      }
    }
    setConfirmNewChatOpen(false);
    handleNewSession();
  };

  const handleLoadConversation = (convId: string, msgs: ChatMessageType[]) => {
    setConversationId(convId);
    setMessages(msgs);
    setAutoPlaySignature(null);
    setIsFinished(msgs.some((m) => m.role === "summary"));
    setTotalUsage(EMPTY_USAGE);
    setLastIncreaseTWD(0);
    setPage("chat");
  };

  const calculateUsageCostUSD = (usage: TokenUsage) => {
    const r = { textIn: 0.15, audioIn: 10, textOut: 0.60, audioOut: 20 };
    return (
      usage.promptTextTokens * r.textIn +
      usage.promptAudioTokens * r.audioIn +
      usage.completionTextTokens * r.textOut +
      usage.completionAudioTokens * r.audioOut
    ) / 1_000_000;
  };

  const addUsage = (usage: TokenUsage) => {
    setLastIncreaseTWD(calculateUsageCostUSD(usage) * 32.5);
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

  const costUSD = calculateUsageCostUSD(totalUsage);
  const costTWD = costUSD * 32.5;

  return (
    <>
      <div className="mx-auto flex h-dvh max-w-lg flex-col bg-surface font-body">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        {page === "settings" && (
          <SettingsPage
            voice={voice}
            apiKey={apiKey}
            systemPrompt={systemPrompt}
            memory={memory}
            autoMemoryEnabled={autoMemoryEnabled}
            onSave={handleSaveSettings}
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
                  shouldAutoPlay={
                    i === messages.length - 1 &&
                    msg.role === "assistant" &&
                    !!msg.audioBase64 &&
                    msg.audioBase64 === autoPlaySignature
                  }
                  onAutoPlayHandled={() => setAutoPlaySignature(null)}
                  apiKey={apiKey}
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
                <span className="text-green-600">{" / "}+NT${lastIncreaseTWD.toFixed(2)}</span>
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
                onRequestNewSession={() => setConfirmNewChatOpen(true)}
              />
            </footer>
          </>
        )}

        {confirmNewChatOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-sage-500/35 px-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-chat-confirm-title"
            aria-describedby="new-chat-confirm-desc"
            onClick={() => setConfirmNewChatOpen(false)}
          >
            <div
              className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl shadow-sage-500/20"
              onClick={(e) => e.stopPropagation()}
            >
              <p id="new-chat-confirm-title" className="font-display text-lg font-semibold text-sage-500">
                開始新對話？
              </p>
              <p id="new-chat-confirm-desc" className="mt-2 text-sm leading-relaxed text-sage-400">
                目前對話紀錄將被清除，且無法復原。
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmNewChatOpen(false)}
                  className="rounded-xl border border-sage-100 bg-sage-50 px-3 py-2 text-sm font-medium text-sage-500 active:scale-95"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmNewSession}
                  className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white shadow-md shadow-brand-200 active:scale-95"
                >
                  清除並開始
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none fixed inset-0 z-50">
        {isNotePanelOpen && (
          <div
            ref={notePanelRef}
            role="dialog"
            aria-label="筆記視窗"
            className="pointer-events-auto fixed mx-auto flex h-80 flex-col overflow-hidden rounded-2xl border border-sage-200 bg-white shadow-xl shadow-sage-500/25"
            style={{
              top: `${notePanelTop}px`,
              left: `${NOTE_PANEL_SIDE_GAP}px`,
              right: `${NOTE_PANEL_SIDE_GAP}px`,
              maxWidth: `calc(32rem - ${NOTE_PANEL_SIDE_GAP * 2}px)`,
            }}
            onPointerDown={handleNotePanelPointerDown}
            onPointerMove={handleNotePanelPointerMove}
            onPointerUp={handleNotePanelPointerEnd}
            onPointerCancel={handleNotePanelPointerEnd}
          >
            <header className="flex cursor-grab items-center justify-between border-b border-sage-100 bg-sage-50 px-3 py-2.5 active:cursor-grabbing">
              <p className="font-body text-sm font-medium text-sage-500">小抄筆記</p>
              <button
                type="button"
                onClick={() => setIsNotePanelOpen(false)}
                className="rounded-md p-1 text-sage-400 transition-colors hover:bg-sage-100 hover:text-sage-500"
                aria-label="關閉筆記視窗"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>
            <textarea
              value={noteText}
              onChange={(event) => handleNoteTextChange(event.target.value)}
              placeholder="在這裡記錄你的口說重點、句型或提醒..."
              className="h-full w-full resize-none bg-white px-3 py-2.5 font-body text-sm leading-relaxed text-sage-500 outline-none placeholder:text-sage-300"
            />
          </div>
        )}
      </div>

      {!isNotePanelOpen && (
        <button
          type="button"
          aria-label="開啟筆記視窗"
          className="fixed right-0 z-[70] flex h-14 w-12 touch-none select-none items-center justify-center rounded-l-2xl border border-r-0 border-brand-300 bg-brand-500 text-white shadow-lg shadow-brand-400/25"
          style={{ top: `${floatingBtnTop}px` }}
          onClick={handleFloatingButtonClick}
          onPointerDown={handleFloatingPointerDown}
          onPointerMove={handleFloatingPointerMove}
          onPointerUp={handleFloatingPointerEnd}
          onPointerCancel={handleFloatingPointerEnd}
        >
          <span className="flex flex-col gap-1.5" aria-hidden="true">
            <span className="h-1 w-1 rounded-full bg-white/90" />
            <span className="h-1 w-1 rounded-full bg-white/90" />
            <span className="h-1 w-1 rounded-full bg-white/90" />
          </span>
        </button>
      )}
    </>
  );
}
