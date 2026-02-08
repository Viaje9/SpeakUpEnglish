import { useState, useRef, useEffect } from "react";
import type { Voice } from "../../shared/types";
import { VOICES } from "../../shared/types";

interface Props {
  value: Voice;
  onChange: (v: Voice) => void;
  onPreview: () => void;
  isPreviewing: boolean;
}

export default function VoiceSelect({ value, onChange, onPreview, isPreviewing }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = value.charAt(0).toUpperCase() + value.slice(1);

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      {/* Dropdown trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-sage-100 bg-sage-50 py-1 pr-2 pl-2.5 font-body text-xs text-sage-500 transition-colors hover:border-brand-200"
      >
        <span>{label}</span>
        <svg
          className={`h-3 w-3 text-sage-300 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Preview button */}
      <button
        onClick={onPreview}
        disabled={isPreviewing}
        className="flex items-center gap-1 rounded-lg border border-sage-100 bg-sage-50 px-2.5 py-1 font-body text-xs text-sage-400 transition-all hover:border-brand-200 hover:text-brand-500 active:scale-95 disabled:opacity-40"
      >
        {isPreviewing ? (
          <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
        試聽
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-44 animate-fade-up rounded-xl border border-sage-100 bg-white py-1 shadow-lg shadow-sage-200/50">
          {VOICES.map((v) => (
            <button
              key={v}
              onClick={() => { onChange(v); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left font-body text-xs transition-colors hover:bg-brand-50 ${
                v === value ? "bg-brand-50 font-medium text-brand-600" : "text-sage-500"
              }`}
            >
              {v === value && (
                <svg className="h-3 w-3 shrink-0 text-brand-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
              <span className={v === value ? "" : "pl-5"}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
