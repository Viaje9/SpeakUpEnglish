import { useState } from "react";
import { loadHistory, deleteRecord, type HistoryRecord } from "../lib/history";

interface Props {
  onBack: () => void;
}

export default function HistoryPage({ onBack }: Props) {
  const [records, setRecords] = useState<HistoryRecord[]>(loadHistory);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    deleteRecord(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("zh-TW", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {records.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-50">
              <svg className="h-8 w-8 text-sage-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-sm text-sage-300">還沒有聊天記錄</p>
            <p className="text-xs text-sage-200">完成對話並整理後會顯示在這裡</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((r) => {
              const isExpanded = expandedId === r.id;
              const preview = r.summary.length > 80 ? r.summary.slice(0, 80) + "..." : r.summary;

              return (
                <div
                  key={r.id}
                  className="animate-fade-up rounded-xl bg-white p-4 ring-1 ring-sage-100 transition-shadow hover:shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-body text-[11px] text-sage-300">
                      {formatDate(r.timestamp)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigator.clipboard.writeText(r.summary)}
                        className="rounded-md p-1 text-sage-300 transition-colors hover:bg-sage-50 hover:text-sage-500"
                        title="複製"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="rounded-md p-1 text-sage-300 transition-colors hover:bg-red-50 hover:text-red-500"
                        title="刪除"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    className="w-full text-left"
                  >
                    <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-gray-700">
                      {isExpanded ? r.summary : preview}
                    </p>
                    {r.summary.length > 80 && (
                      <span className="mt-1 inline-block font-body text-xs text-brand-500">
                        {isExpanded ? "收合" : "展開全文"}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
