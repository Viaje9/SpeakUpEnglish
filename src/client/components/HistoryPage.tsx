import { useState, useEffect } from "react";
import type { ChatMessage as ChatMessageType, Conversation } from "../../shared/types";
import { listConversations, loadMessages, deleteConversation } from "../lib/db";
import ChatMessage from "./ChatMessage";

interface Props {
  onBack: () => void;
  onLoadConversation: (convId: string, msgs: ChatMessageType[]) => void;
}

export default function HistoryPage({ onBack, onLoadConversation }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isSummaryCopied, setIsSummaryCopied] = useState(false);
  const [isSummaryCopyFailed, setIsSummaryCopyFailed] = useState(false);

  // Detail view state
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [detailMessages, setDetailMessages] = useState<ChatMessageType[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    listConversations()
      .then(setConversations)
      .finally(() => setIsLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    await handleDelete(pendingDeleteId);
    setPendingDeleteId(null);
  };

  const handleSelect = async (convId: string) => {
    setSelectedConvId(convId);
    setIsLoadingDetail(true);
    const msgs = await loadMessages(convId);
    setDetailMessages(msgs);
    setIsLoadingDetail(false);
  };

  const handleBackToList = () => {
    setSelectedConvId(null);
    setDetailMessages([]);
  };

  const handleContinue = () => {
    if (selectedConvId) {
      onLoadConversation(selectedConvId, detailMessages);
    }
  };

  const handleCopySummary = async (summary: string) => {
    try {
      await navigator.clipboard.writeText(summary);
      setIsSummaryCopied(true);
      setIsSummaryCopyFailed(false);
      setTimeout(() => setIsSummaryCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
      setIsSummaryCopyFailed(true);
      setTimeout(() => setIsSummaryCopyFailed(false), 1500);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFallbackTitle = (summary: string | null, ts: number) => {
    const trimmed = summary?.trim();
    if (trimmed) {
      const firstLine = trimmed.split(/\r?\n/).find((line) => line.trim())?.trim() || trimmed;
      return firstLine.length > 36 ? `${firstLine.slice(0, 36)}...` : firstLine;
    }
    return `英語練習 ${new Date(ts).toLocaleDateString("zh-TW")}`;
  };

  // Detail view
  if (selectedConvId) {
    const conv = conversations.find((c) => c.id === selectedConvId);
    return (
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center border-b border-sage-100 bg-white px-4 py-3">
          <button
            onClick={handleBackToList}
            className="rounded-lg p-1.5 text-sage-400 transition-colors hover:bg-sage-50 hover:text-sage-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="flex-1 text-center font-display text-base font-semibold text-sage-500">
            對話詳情
          </h2>
          <div className="w-8" />
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4">
          {isLoadingDetail ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-sage-200 border-t-brand-500" />
            </div>
          ) : detailMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              {conv?.summary && (
                <div className="w-full rounded-xl bg-white p-4 ring-1 ring-sage-100">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-body text-xs font-medium text-sage-400">整理摘要</p>
                    <button
                      type="button"
                      onClick={() => handleCopySummary(conv.summary!)}
                      className="rounded-full bg-sage-50 px-2.5 py-1 text-xs font-medium text-sage-500 transition-colors hover:bg-sage-100"
                    >
                      {isSummaryCopyFailed ? "複製失敗" : isSummaryCopied ? "已複製" : "複製"}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-gray-700">
                    {conv.summary}
                  </p>
                </div>
              )}
              {!conv?.summary && (
                <p className="text-sm text-sage-300">此對話沒有完整訊息記錄</p>
              )}
            </div>
          ) : (
            detailMessages.map((msg, i) => (
              <ChatMessage key={i} message={msg} shouldAutoPlay={false} />
            ))
          )}
        </main>

        {detailMessages.length > 0 && !detailMessages.some((m) => m.role === "summary") && (
          <footer className="shrink-0 border-t border-sage-100 bg-white px-4 py-3">
            <button
              onClick={handleContinue}
              className="w-full rounded-xl bg-brand-500 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              繼續對話
            </button>
          </footer>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center border-b border-sage-100 bg-white px-4 py-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-sage-400 transition-colors hover:bg-sage-50 hover:text-sage-500"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="flex-1 text-center font-display text-base font-semibold text-sage-500">
          聊天記錄
        </h2>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-sage-200 border-t-brand-500" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-50">
              <svg className="h-8 w-8 text-sage-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-sm text-sage-300">還沒有聊天記錄</p>
            <p className="text-xs text-sage-200">完成對話後會顯示在這裡</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((c) => {
              const title = c.title?.trim() || getFallbackTitle(c.summary, c.timestamp);
              const preview = c.summary
                ? c.summary.length > 80
                  ? c.summary.slice(0, 80) + "..."
                  : c.summary
                : "對話進行中...";

              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(c.id);
                    }
                  }}
                  className="w-full animate-fade-up rounded-xl bg-white p-4 text-left ring-1 ring-sage-100 transition-shadow hover:shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-body text-[11px] text-sage-300">
                      {formatDate(c.timestamp)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-sage-50 px-2 py-0.5 font-body text-[10px] text-sage-400">
                        {c.messageCount} 則訊息
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(c.id);
                        }}
                        className="rounded-md p-1 text-sage-300 transition-colors hover:bg-red-50 hover:text-red-500"
                        title="刪除"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <h3 className="mb-1 line-clamp-1 font-body text-sm font-semibold text-sage-500">
                    {title}
                  </h3>
                  <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-gray-700">
                    {preview}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pendingDeleteId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl ring-1 ring-sage-100">
            <h3 className="font-display text-base font-semibold text-sage-500">確認刪除</h3>
            <p className="mt-2 font-body text-sm leading-relaxed text-sage-400">
              刪除聊天記錄時，會把歷史記錄一併刪除。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                className="rounded-lg px-3 py-2 font-body text-sm text-sage-400 transition-colors hover:bg-sage-50 hover:text-sage-500"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-500 px-3 py-2 font-body text-sm text-white transition-colors hover:bg-red-600"
              >
                刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
