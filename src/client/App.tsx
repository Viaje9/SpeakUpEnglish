import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage as ChatMessageType, Voice, TokenUsage } from "../shared/types";
import { DEFAULT_SYSTEM_PROMPT } from "../shared/types";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { RecorderStartError } from "./hooks/useAudioRecorder";
import { blobToWavBase64 } from "./lib/audioUtils";
import { primeAiAudioTimeline, stopAiAudio, unlockAiAudioContext } from "./lib/aiAudioPlayer";
import { pauseActiveAudio } from "./lib/audioFocus";
import { sendChat, sendSummarize } from "./lib/api";
import {
  createConversation,
  appendMessage,
  setSummary,
  migrateFromLocalStorage,
} from "./lib/db";
import ChatMessage from "./components/ChatMessage";
import AudioRecorder from "./components/AudioRecorder";
import SettingsPage from "./components/SettingsPage";
import HistoryPage from "./components/HistoryPage";
import ToastContainer from "./components/ToastContainer";
import AiChatPanel from "./components/AiChatPanel";
import { useToast } from "./hooks/useToast";

type Page = "chat" | "settings" | "history";

const EMPTY_USAGE: TokenUsage = {
  promptTokens: 0, completionTokens: 0, totalTokens: 0,
  promptTextTokens: 0, promptAudioTokens: 0, completionTextTokens: 0, completionAudioTokens: 0,
};

const FLOATING_BTN_MARGIN = 12;
const NOTE_PANEL_SIDE_GAP = 12;
const NOTE_PANEL_INITIAL_HEIGHT = 320;
const NOTE_PANEL_MIN_HEIGHT = 220;
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
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [isNotePanelOpen, setIsNotePanelOpen] = useState(false);
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const [retryPayload, setRetryPayload] = useState<{
    audioBase64: string;
    history: ChatMessageType[];
  } | null>(null);
  const [noteText, setNoteText] = useState<string>(() => localStorage.getItem("speakup_floating_note") || "");
  const [notePanelHeight, setNotePanelHeight] = useState(() => {
    const parsed = Number.parseInt(localStorage.getItem("speakup_floating_note_height") || "", 10);
    if (!Number.isFinite(parsed)) return NOTE_PANEL_INITIAL_HEIGHT;
    return Math.max(NOTE_PANEL_MIN_HEIGHT, parsed);
  });
  const [notePanelTop, setNotePanelTop] = useState(() => {
    if (typeof window === "undefined") return 96;
    const maxTop = Math.max(
      FLOATING_BTN_MARGIN,
      window.innerHeight - NOTE_PANEL_INITIAL_HEIGHT - NOTE_PANEL_SAFE_BOTTOM,
    );
    return Math.min(Math.max(96, FLOATING_BTN_MARGIN), maxTop);
  });

  const noteDragStateRef = useRef({
    active: false,
    pointerId: -1,
    offsetY: 0,
  });
  const noteResizeStateRef = useRef({
    active: false,
    pointerId: -1,
    startHeight: NOTE_PANEL_INITIAL_HEIGHT,
    startClientY: 0,
  });
  const notePanelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<Page>(page);

  const { toasts, show: showToast, dismiss: dismissToast } = useToast();
  const { isRecording, isPaused, start, stop, togglePause, cancel } = useAudioRecorder();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    migrateFromLocalStorage();
  }, []);

  useEffect(() => {
    let unlocked = false;
    const unlockOnce = () => {
      if (unlocked) return;
      unlocked = true;
      unlockAiAudioContext().catch(() => {
        // Keep silent here; user can still unlock by manually pressing play.
      });
      window.removeEventListener("pointerdown", unlockOnce);
      window.removeEventListener("keydown", unlockOnce);
    };

    window.addEventListener("pointerdown", unlockOnce, { passive: true });
    window.addEventListener("keydown", unlockOnce);
    return () => {
      window.removeEventListener("pointerdown", unlockOnce);
      window.removeEventListener("keydown", unlockOnce);
    };
  }, []);

  useEffect(() => {
    const clampNoteHeight = (height: number, top: number) => {
      const maxHeight = Math.max(
        NOTE_PANEL_MIN_HEIGHT,
        window.innerHeight - top - NOTE_PANEL_SAFE_BOTTOM,
      );
      return Math.min(Math.max(height, NOTE_PANEL_MIN_HEIGHT), maxHeight);
    };

    const clampNoteTop = (top: number, height: number) => {
      const maxTop = Math.max(FLOATING_BTN_MARGIN, window.innerHeight - height - NOTE_PANEL_SAFE_BOTTOM);
      return Math.min(Math.max(top, FLOATING_BTN_MARGIN), maxTop);
    };

    const handleResize = () => {
      setNotePanelTop((prevTop) => {
        const nextTop = clampNoteTop(prevTop, notePanelHeight);
        setNotePanelHeight((prevHeight) => clampNoteHeight(prevHeight, nextTop));
        return nextTop;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [notePanelHeight]);

  const handleFloatingButtonClick = () => {
    setIsNotePanelOpen((prev) => !prev);
  };

  const handleNotePanelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.closest("[data-note-drag-handle='true']")) return;
    if (target.closest("button,textarea,input,select,a,[role='button']")) return;

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
    event.preventDefault();

    const maxTop = Math.max(FLOATING_BTN_MARGIN, window.innerHeight - notePanelHeight - NOTE_PANEL_SAFE_BOTTOM);
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

  const handleNoteResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    noteResizeStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startHeight: notePanelHeight,
      startClientY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleNoteResizePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const resizeState = noteResizeStateRef.current;
    if (!resizeState.active || resizeState.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const deltaY = event.clientY - resizeState.startClientY;
    const maxHeight = Math.max(
      NOTE_PANEL_MIN_HEIGHT,
      window.innerHeight - notePanelTop - NOTE_PANEL_SAFE_BOTTOM,
    );
    const nextHeight = Math.min(
      Math.max(resizeState.startHeight + deltaY, NOTE_PANEL_MIN_HEIGHT),
      maxHeight,
    );
    setNotePanelHeight(nextHeight);
  };

  const handleNoteResizePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    const resizeState = noteResizeStateRef.current;
    if (resizeState.pointerId !== event.pointerId) return;

    noteResizeStateRef.current = {
      active: false,
      pointerId: -1,
      startHeight: NOTE_PANEL_INITIAL_HEIGHT,
      startClientY: 0,
    };

    localStorage.setItem("speakup_floating_note_height", String(Math.round(notePanelHeight)));

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
    showToast("設定已儲存", "success");
    setPage("chat");
  };

  const handleStart = async () => {
    try {
      setRetryPayload(null);
      // Enter recording mode with silence: stop AI WebAudio/fallback and any active media element.
      stopAiAudio();
      pauseActiveAudio();
      await unlockAiAudioContext().catch(() => {});
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

  const submitAudioMessage = useCallback(async (audioBase64: string, historySnapshot: ChatMessageType[]) => {
    setIsLoading(true);
    try {
      const userMessage: ChatMessageType = { role: "user", audioBase64 };
      setMessages((prev) => [...prev, userMessage]);
      const response = await sendChat(
        audioBase64,
        historySnapshot,
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
      const shouldAutoPlayAssistant = pageRef.current === "chat";
      setAutoPlaySignature(shouldAutoPlayAssistant ? response.audioBase64 : null);
      setMessages((prev) => [...prev, assistantMessage]);
      if (response.memoryUpdate?.memory) {
        setMemory(response.memoryUpdate.memory);
        localStorage.setItem("speakup_memory", response.memoryUpdate.memory);
      }
      addUsage(response.usage);
      setRetryPayload(null);

      // Persist to IndexedDB
      let convId = conversationId;
      if (!convId) {
        convId = await createConversation();
        setConversationId(convId);
      }
      const baseOrder = historySnapshot.length;
      await appendMessage(convId, userMessage, baseOrder);
      await appendMessage(convId, assistantMessage, baseOrder + 1);
    } catch (err) {
      console.error("Send failed:", err);
      setMessages((prev) => prev.slice(0, -1));
      setAutoPlaySignature(null);
      setRetryPayload({ audioBase64, history: historySnapshot });
      showToast("訊息傳送失敗，可點「重試送出」。");
    } finally {
      setIsLoading(false);
    }
  }, [
    apiKey,
    autoMemoryEnabled,
    conversationId,
    memory,
    systemPrompt,
    voice,
  ]);

  const handleStop = async () => {
    const blob = await stop();
    await primeAiAudioTimeline().catch(() => {});
    if (blob.size === 0) return;

    try {
      const audioBase64 = await blobToWavBase64(blob);
      await submitAudioMessage(audioBase64, messages);
    } catch (err) {
      console.error("Audio processing failed:", err);
      showToast("音訊處理失敗，請再試一次。");
    }
  };

  const handleRetrySend = async () => {
    if (!retryPayload || isLoading) return;
    await submitAudioMessage(retryPayload.audioBase64, retryPayload.history);
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
    setRetryPayload(null);
    setIsFinished(false);
    setTotalUsage(EMPTY_USAGE);
    setLastIncreaseTWD(0);
    setConversationId(null);
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

  const handleAutoPlayHandled = useCallback(() => {
    setAutoPlaySignature(null);
  }, []);

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
                  onAutoPlayHandled={handleAutoPlayHandled}
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

            {retryPayload && !isRecording && !isLoading && !isSummarizing && (
              <div className="flex items-center justify-between border-t border-amber-200 bg-amber-50 px-4 py-2">
                <p className="font-body text-xs text-amber-800">上次語音送出失敗，已保留音檔</p>
                <button
                  type="button"
                  onClick={handleRetrySend}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-amber-600 active:scale-95"
                >
                  重試送出
                </button>
              </div>
            )}

            {/* Recorder */}
            <footer className="shrink-0 border-t border-sage-100 bg-sage-50">
              <AudioRecorder
                isRecording={isRecording}
                isLoading={isLoading}
                isSummarizing={isSummarizing}
                isFinished={isFinished}
                hasMessages={hasUserMessages}
                isPaused={isPaused}
                isAiChatOpen={isAiChatOpen}
                isNotePanelOpen={isNotePanelOpen}
                onStart={handleStart}
                onStop={handleStop}
                onTogglePause={togglePause}
                onCancel={cancel}
                onSummarize={handleSummarize}
                onRequestNewSession={handleNewSession}
                onToggleAiChat={() => setIsAiChatOpen((prev) => !prev)}
                onToggleNotePanel={handleFloatingButtonClick}
              />
            </footer>
          </>
        )}
      </div>

      {page === "chat" && (
        <>
          <div className="pointer-events-none fixed inset-0 z-[80]">
            {isNotePanelOpen && (
              <div
                ref={notePanelRef}
                role="dialog"
                aria-label="筆記視窗"
                className={`pointer-events-auto fixed mx-auto flex flex-col overflow-hidden overscroll-contain rounded-2xl border bg-white shadow-xl shadow-sage-500/25 transition-colors ${
                  isNoteEditing
                    ? "border-brand-400 ring-2 ring-brand-200/70"
                    : "border-sage-200"
                }`}
                style={{
                  top: `${notePanelTop}px`,
                  left: `${NOTE_PANEL_SIDE_GAP}px`,
                  right: `${NOTE_PANEL_SIDE_GAP}px`,
                  height: `${notePanelHeight}px`,
                  maxWidth: `calc(32rem - ${NOTE_PANEL_SIDE_GAP * 2}px)`,
                }}
                onPointerDown={handleNotePanelPointerDown}
                onPointerMove={handleNotePanelPointerMove}
                onPointerUp={handleNotePanelPointerEnd}
                onPointerCancel={handleNotePanelPointerEnd}
              >
                <header
                  data-note-drag-handle="true"
                  className="flex cursor-grab touch-none items-center justify-between border-b border-sage-100 bg-sage-50 px-3 py-2.5 active:cursor-grabbing"
                >
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
                  onFocus={() => setIsNoteEditing(true)}
                  onBlur={() => setIsNoteEditing(false)}
                  placeholder="在這裡記錄你的口說重點、句型或提醒..."
                  className="h-full w-full resize-none overscroll-contain bg-white px-3 pt-2.5 pb-10 font-body text-sm leading-relaxed text-sage-500 outline-none placeholder:text-sage-300 [touch-action:pan-y]"
                />
                <button
                  type="button"
                  aria-label="調整小抄高度"
                  className="absolute bottom-2 left-2 rounded-md p-1 text-sage-300 transition-colors hover:bg-sage-100 hover:text-sage-400 active:bg-sage-100 touch-none"
                  onPointerDown={handleNoteResizePointerDown}
                  onPointerMove={handleNoteResizePointerMove}
                  onPointerUp={handleNoteResizePointerEnd}
                  onPointerCancel={handleNoteResizePointerEnd}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6L18 18M6 10L14 18M10 6L18 14" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <AiChatPanel
            apiKey={apiKey}
            isOpen={isAiChatOpen}
            onRequestClose={() => setIsAiChatOpen(false)}
          />
        </>
      )}
    </>
  );
}
