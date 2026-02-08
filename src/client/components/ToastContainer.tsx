import type { ReactNode } from "react";
import type { Toast } from "../hooks/useToast";

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const icons: Record<Toast["type"], ReactNode> = {
  error: (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  success: (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  ),
  info: (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
    </svg>
  ),
};

const styles: Record<Toast["type"], string> = {
  error: "bg-red-50 text-red-700 ring-red-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  info: "bg-brand-50 text-brand-700 ring-brand-200",
};

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4 pt-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex w-full max-w-sm animate-fade-up items-center gap-2.5 rounded-xl px-4 py-3 font-body text-sm shadow-lg ring-1 ${styles[t.type]}`}
        >
          {icons[t.type]}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="shrink-0 rounded-md p-0.5 opacity-50 transition-opacity hover:opacity-100"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
