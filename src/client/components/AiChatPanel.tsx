import { useState, useRef, useEffect } from "react";
import type { AiChatMessage } from "../../shared/types";
import { sendAiChat } from "../lib/api";

const PANEL_SIDE_GAP = 12;
const PANEL_INITIAL_HEIGHT = 380;
const PANEL_MIN_HEIGHT = 260;
const PANEL_SAFE_BOTTOM = 12;
const BTN_HEIGHT = 56;
const BTN_MARGIN = 12;

interface AiChatPanelProps {
  apiKey: string;
}

export default function AiChatPanel({ apiKey }: AiChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem("speakup_ai_chat_messages");
      return stored ? (JSON.parse(stored) as AiChatMessage[]) : [];
    } catch {
      return [];
    }
  });
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [btnTop, setBtnTop] = useState(() => {
    if (typeof window === "undefined") return 350;
    return Math.max(BTN_MARGIN, window.innerHeight / 2 - BTN_HEIGHT / 2 + BTN_HEIGHT + 16);
  });
  const [panelTop, setPanelTop] = useState(() => {
    if (typeof window === "undefined") return 96;
    const maxTop = Math.max(BTN_MARGIN, window.innerHeight - PANEL_INITIAL_HEIGHT - PANEL_SAFE_BOTTOM);
    return Math.min(Math.max(96, BTN_MARGIN), maxTop);
  });
  const [panelHeight, setPanelHeight] = useState(() => {
    const parsed = Number.parseInt(localStorage.getItem("speakup_ai_chat_height") || "", 10);
    if (!Number.isFinite(parsed)) return PANEL_INITIAL_HEIGHT;
    return Math.max(PANEL_MIN_HEIGHT, parsed);
  });

  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const dragStateRef = useRef({ active: false, pointerId: -1, offsetY: 0, startClientY: 0 });
  const floatingDraggedRef = useRef(false);
  const panelDragStateRef = useRef({ active: false, pointerId: -1, offsetY: 0 });
  const resizeStateRef = useRef({ active: false, pointerId: -1, startHeight: PANEL_INITIAL_HEIGHT, startClientY: 0 });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist messages
  useEffect(() => {
    localStorage.setItem("speakup_ai_chat_messages", JSON.stringify(messages));
  }, [messages]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      setBtnTop((prev) => {
        const maxTop = Math.max(BTN_MARGIN, window.innerHeight - BTN_HEIGHT - BTN_MARGIN);
        return Math.min(Math.max(prev, BTN_MARGIN), maxTop);
      });
      setPanelTop((prevTop) => {
        const maxTop = Math.max(BTN_MARGIN, window.innerHeight - panelHeight - PANEL_SAFE_BOTTOM);
        const nextTop = Math.min(Math.max(prevTop, BTN_MARGIN), maxTop);
        setPanelHeight((prevH) => {
          const maxH = Math.max(PANEL_MIN_HEIGHT, window.innerHeight - nextTop - PANEL_SAFE_BOTTOM);
          return Math.min(Math.max(prevH, PANEL_MIN_HEIGHT), maxH);
        });
        return nextTop;
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [panelHeight]);

  // --- Floating button drag ---
  const handleBtnPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    floatingDraggedRef.current = false;
    const rect = e.currentTarget.getBoundingClientRect();
    dragStateRef.current = { active: true, pointerId: e.pointerId, offsetY: e.clientY - rect.top, startClientY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleBtnPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const ds = dragStateRef.current;
    if (!ds.active || ds.pointerId !== e.pointerId) return;
    const maxTop = Math.max(BTN_MARGIN, window.innerHeight - BTN_HEIGHT - BTN_MARGIN);
    const nextTop = e.clientY - ds.offsetY;
    if (Math.abs(e.clientY - ds.startClientY) > 3) floatingDraggedRef.current = true;
    setBtnTop(Math.min(Math.max(nextTop, BTN_MARGIN), maxTop));
  };

  const handleBtnPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragStateRef.current.pointerId !== e.pointerId) return;
    dragStateRef.current = { active: false, pointerId: -1, offsetY: 0, startClientY: 0 };
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleBtnClick = () => {
    if (floatingDraggedRef.current) { floatingDraggedRef.current = false; return; }
    setIsOpen((prev) => !prev);
  };

  // --- Panel drag ---
  const handlePanelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-ai-chat-drag-handle='true']")) return;
    if (target.closest("button,textarea,input,select,a,[role='button']")) return;
    const panel = panelRef.current;
    if (!panel) return;
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    panelDragStateRef.current = { active: true, pointerId: e.pointerId, offsetY: e.clientY - rect.top };
    panel.setPointerCapture(e.pointerId);
  };

  const handlePanelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ds = panelDragStateRef.current;
    if (!ds.active || ds.pointerId !== e.pointerId) return;
    e.preventDefault();
    const maxTop = Math.max(BTN_MARGIN, window.innerHeight - panelHeight - PANEL_SAFE_BOTTOM);
    const nextTop = e.clientY - ds.offsetY;
    setPanelTop(Math.min(Math.max(nextTop, BTN_MARGIN), maxTop));
  };

  const handlePanelPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panelDragStateRef.current.pointerId !== e.pointerId) return;
    panelDragStateRef.current = { active: false, pointerId: -1, offsetY: 0 };
    if (panelRef.current?.hasPointerCapture(e.pointerId)) panelRef.current.releasePointerCapture(e.pointerId);
  };

  // --- Panel resize ---
  const handleResizePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStateRef.current = { active: true, pointerId: e.pointerId, startHeight: panelHeight, startClientY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rs = resizeStateRef.current;
    if (!rs.active || rs.pointerId !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    const deltaY = e.clientY - rs.startClientY;
    const maxH = Math.max(PANEL_MIN_HEIGHT, window.innerHeight - panelTop - PANEL_SAFE_BOTTOM);
    setPanelHeight(Math.min(Math.max(rs.startHeight + deltaY, PANEL_MIN_HEIGHT), maxH));
  };

  const handleResizePointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (resizeStateRef.current.pointerId !== e.pointerId) return;
    resizeStateRef.current = { active: false, pointerId: -1, startHeight: PANEL_INITIAL_HEIGHT, startClientY: 0 };
    localStorage.setItem("speakup_ai_chat_height", String(Math.round(panelHeight)));
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // --- Send message ---
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    const userMsg: AiChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const { reply } = await sendAiChat(text, messages, apiKey);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "抱歉，回覆失敗，請再試一次。" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem("speakup_ai_chat_messages");
  };

  return (
    <>
      {/* Panel */}
      <div className="pointer-events-none fixed inset-0 z-[80]">
        {isOpen && (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="AI 聊天視窗"
            className="pointer-events-auto fixed mx-auto flex flex-col overflow-hidden overscroll-contain rounded-2xl border border-sage-200 bg-white shadow-xl shadow-sage-500/25"
            style={{
              top: `${panelTop}px`,
              left: `${PANEL_SIDE_GAP}px`,
              right: `${PANEL_SIDE_GAP}px`,
              height: `${panelHeight}px`,
              maxWidth: `calc(32rem - ${PANEL_SIDE_GAP * 2}px)`,
            }}
            onPointerDown={handlePanelPointerDown}
            onPointerMove={handlePanelPointerMove}
            onPointerUp={handlePanelPointerEnd}
            onPointerCancel={handlePanelPointerEnd}
          >
            {/* Header */}
            <header
              data-ai-chat-drag-handle="true"
              className="flex cursor-grab touch-none items-center justify-between border-b border-sage-100 bg-sage-50 px-3 py-2.5 active:cursor-grabbing"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.477 2 2 6.013 2 10.928c0 2.779 1.474 5.26 3.768 6.87-.193 1.464-.853 2.738-1.497 3.636a.75.75 0 00.666 1.127c2.16-.132 4.135-1.04 5.478-1.87.524.065 1.058.1 1.585.1 5.523 0 10-4.014 10-8.863C22 6.013 17.523 2 12 2z" />
                </svg>
                <p className="font-body text-sm font-medium text-sage-500">AI 助手</p>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="rounded-md p-1 text-sage-400 transition-colors hover:bg-sage-100 hover:text-sage-500"
                    aria-label="清除聊天記錄"
                    title="清除聊天"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md p-1 text-sage-400 transition-colors hover:bg-sage-100 hover:text-sage-500"
                  aria-label="關閉 AI 聊天視窗"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2.5 [touch-action:pan-y]">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <svg className="h-8 w-8 text-sage-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                  <p className="text-xs text-sage-300">
                    有英文問題嗎？問我吧！
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`mb-2 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-br-md bg-brand-500 text-white"
                        : "rounded-bl-md bg-sage-100 text-sage-500"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="mb-2 flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-sage-100 px-3 py-2">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sage-300 [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sage-300 [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sage-300 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-sage-100 bg-white px-2 py-2">
              <div className="flex items-end gap-1.5">
                <button
                  type="button"
                  aria-label="調整聊天視窗高度"
                  className="mb-0.5 shrink-0 touch-none rounded-md p-1 text-sage-300 transition-colors hover:bg-sage-100 hover:text-sage-400 active:bg-sage-100"
                  onPointerDown={handleResizePointerDown}
                  onPointerMove={handleResizePointerMove}
                  onPointerUp={handleResizePointerEnd}
                  onPointerCancel={handleResizePointerEnd}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6L18 18M6 10L14 18M10 6L18 14" />
                  </svg>
                </button>
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="輸入問題..."
                  rows={1}
                  className="max-h-20 min-h-[36px] flex-1 resize-none rounded-xl border border-sage-200 bg-sage-50 px-3 py-2 font-body text-sm text-sage-500 outline-none transition-colors placeholder:text-sage-300 focus:border-brand-300 focus:ring-1 focus:ring-brand-200/70"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputText.trim() || isLoading}
                  className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm transition-all hover:bg-brand-600 disabled:opacity-40 disabled:shadow-none"
                  aria-label="送出訊息"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating button */}
      {!isOpen && (
        <button
          type="button"
          aria-label="開啟 AI 聊天視窗"
          className="fixed left-0 z-[70] flex h-14 w-12 touch-none select-none items-center justify-center rounded-r-2xl border border-l-0 border-brand-300 bg-brand-500 text-white shadow-lg shadow-brand-400/25"
          style={{ top: `${btnTop}px` }}
          onClick={handleBtnClick}
          onPointerDown={handleBtnPointerDown}
          onPointerMove={handleBtnPointerMove}
          onPointerUp={handleBtnPointerEnd}
          onPointerCancel={handleBtnPointerEnd}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </button>
      )}
    </>
  );
}
