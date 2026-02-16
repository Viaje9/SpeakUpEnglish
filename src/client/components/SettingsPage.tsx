import { useState, useRef } from "react";
import { DEFAULT_SYSTEM_PROMPT } from "../../shared/types";
import type { Voice } from "../../shared/types";
import VoiceSelect from "./VoiceSelect";
import { sendVoicePreview } from "../lib/api";
import { releaseAudioFocus, requestAudioFocus } from "../lib/audioFocus";

interface Props {
  voice: Voice;
  apiKey: string;
  systemPrompt: string;
  memory: string;
  autoMemoryEnabled: boolean;
  onSave: (
    voice: Voice,
    apiKey: string,
    systemPrompt: string,
    memory: string,
    autoMemoryEnabled: boolean,
  ) => void;
  onBack: () => void;
}

export default function SettingsPage({
  voice,
  apiKey,
  systemPrompt,
  memory,
  autoMemoryEnabled,
  onSave,
  onBack,
}: Props) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [draftVoice, setDraftVoice] = useState<Voice>(voice);
  const [draftApiKey, setDraftApiKey] = useState(apiKey);
  const [draftSystemPrompt, setDraftSystemPrompt] = useState(systemPrompt);
  const [draftMemory, setDraftMemory] = useState(memory);
  const [draftAutoMemoryEnabled, setDraftAutoMemoryEnabled] = useState(autoMemoryEnabled);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isDirty =
    draftVoice !== voice ||
    draftApiKey !== apiKey ||
    draftSystemPrompt !== systemPrompt ||
    draftMemory !== memory ||
    draftAutoMemoryEnabled !== autoMemoryEnabled;

  const handleBack = () => {
    if (!isDirty) {
      onBack();
      return;
    }
    setShowDiscardModal(true);
  };

  const handlePreview = async (v: Voice) => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    try {
      const { audioBase64 } = await sendVoicePreview(v, draftApiKey);
      if (audioRef.current) {
        audioRef.current.pause();
        releaseAudioFocus(audioRef.current);
      }
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audio.onpause = () => releaseAudioFocus(audio);
      audio.onended = () => releaseAudioFocus(audio);
      audioRef.current = audio;
      requestAudioFocus(audio);
      await audio.play();
    } catch {
      // silent fail
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleResetSettings = () => {
    setDraftVoice("nova");
    setDraftApiKey("");
    setDraftSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    setDraftMemory("");
    setDraftAutoMemoryEnabled(false);
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center border-b border-sage-100 bg-white px-4 py-3">
        <button
          onClick={handleBack}
          className="rounded-lg p-1.5 text-sage-400 transition-colors hover:bg-sage-50 hover:text-sage-500"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="flex-1 text-center font-display text-base font-semibold text-sage-500">
          設定
        </h2>
        <button
          onClick={() =>
            onSave(
              draftVoice,
              draftApiKey,
              draftSystemPrompt,
              draftMemory,
              draftAutoMemoryEnabled,
            )
          }
          disabled={!isDirty}
          className="rounded-lg bg-brand-500 px-3 py-1.5 font-body text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:bg-sage-200"
        >
          儲存
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-sage-100">
          <p className="mb-2 font-body text-xs font-medium tracking-wide text-sage-400">
            AI 語音
          </p>
          <VoiceSelect
            value={draftVoice}
            onChange={setDraftVoice}
            onPreview={() => handlePreview(draftVoice)}
            isPreviewing={isPreviewing}
          />
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-sage-100">
          <p className="mb-2 font-body text-xs font-medium tracking-wide text-sage-400">
            OpenAI API Key
          </p>
          <div className="flex items-center gap-2">
            <input
              value={draftApiKey}
              onChange={(e) => setDraftApiKey(e.target.value)}
              type={showApiKey ? "text" : "password"}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="sk-..."
              className="h-10 w-full rounded-lg border border-sage-200 bg-sage-50 px-3 font-body text-sm text-sage-500 outline-none transition-colors focus:border-brand-300 focus:bg-white"
            />
            <button
              onClick={() => setShowApiKey((v) => !v)}
              className="h-10 shrink-0 rounded-lg border border-sage-200 bg-white px-3 font-body text-xs text-sage-500 transition-colors hover:border-brand-200 hover:text-brand-600"
            >
              {showApiKey ? "隱藏" : "顯示"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-sage-300">
            會儲存在此裝置的 localStorage，送出請求時使用這組金鑰。
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-sage-100">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-body text-xs font-medium tracking-wide text-sage-400">
              System Prompt
            </p>
            <button
              onClick={handleResetSettings}
              className="rounded-lg border border-sage-200 bg-white px-2.5 py-1 font-body text-[11px] font-medium text-sage-500 transition-colors hover:border-brand-200 hover:text-brand-600"
            >
              重設設定
            </button>
          </div>
          <textarea
            value={draftSystemPrompt}
            onChange={(e) => setDraftSystemPrompt(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-sage-200 bg-sage-50 px-3 py-2 font-body text-sm text-sage-500 outline-none transition-colors focus:border-brand-300 focus:bg-white"
          />
          <p className="mt-2 text-[11px] text-sage-300">
            每次聊天都會套用這段系統提示詞。按「重設設定」後，請記得按右上角「儲存」。
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-sage-100">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-body text-xs font-medium tracking-wide text-sage-400">
              Memory
            </p>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={draftAutoMemoryEnabled}
                onChange={(e) => setDraftAutoMemoryEnabled(e.target.checked)}
                className="h-4 w-4 accent-brand-500"
              />
              <span className="font-body text-xs text-sage-400">自動記憶</span>
            </label>
          </div>
          <textarea
            value={draftMemory}
            onChange={(e) => setDraftMemory(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-sage-200 bg-sage-50 px-3 py-2 font-body text-sm text-sage-500 outline-none transition-colors focus:border-brand-300 focus:bg-white"
          />
          <p className="mt-2 text-[11px] text-sage-300">
            可手動編輯；開啟自動記憶時，AI 會嘗試更新這段內容。
          </p>
        </section>
      </div>

      {showDiscardModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full rounded-2xl bg-white p-4 shadow-xl sm:max-w-sm">
            <h3 className="font-display text-base font-semibold text-sage-500">放棄未儲存變更？</h3>
            <p className="mt-2 text-sm leading-relaxed text-sage-400">
              你有未儲存的設定，離開後這次修改不會保留。
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowDiscardModal(false)}
                className="h-10 flex-1 rounded-lg border border-sage-200 bg-white font-body text-sm text-sage-500 transition-colors hover:border-sage-300"
              >
                取消
              </button>
              <button
                onClick={() => {
                  setShowDiscardModal(false);
                  onBack();
                }}
                className="h-10 flex-1 rounded-lg bg-brand-500 font-body text-sm font-medium text-white transition-colors hover:bg-brand-600"
              >
                放棄並離開
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
