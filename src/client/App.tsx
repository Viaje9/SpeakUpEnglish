import { useState, useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType, Voice } from "../shared/types";
import { VOICES } from "../shared/types";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { blobToWavBase64 } from "./lib/audioUtils";
import { sendChat } from "./lib/api";
import ChatMessage from "./components/ChatMessage";
import AudioRecorder from "./components/AudioRecorder";

export default function App() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [voice, setVoice] = useState<Voice>("nova");
  const [isPreviewing, setIsPreviewing] = useState(false);
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

      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      previewAudioRef.current = audio;
      await audio.play();
    } catch {
      alert("Failed to preview voice.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleStart = async () => {
    try {
      await start();
    } catch {
      alert("Could not access microphone. Please allow microphone permission.");
    }
  };

  const handleStop = async () => {
    const blob = await stop();
    if (blob.size === 0) return;

    setIsLoading(true);

    try {
      const audioBase64 = await blobToWavBase64(blob);

      // Add user message with audio
      const userMessage: ChatMessageType = { role: "user", audioBase64 };
      setMessages((prev) => [...prev, userMessage]);

      const response = await sendChat(audioBase64, messages, voice);

      const assistantMessage: ChatMessageType = {
        role: "assistant",
        text: response.transcript,
        audioBase64: response.audioBase64,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Send failed:", err);
      // Remove the user message placeholder on error
      setMessages((prev) => prev.slice(0, -1));
      alert("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-white">
      {/* Header */}
      <header className="border-b bg-white px-4 py-3">
        <h1 className="text-center text-lg font-semibold text-gray-800">
          SpeakUp English
        </h1>
        <div className="mt-1 flex items-center justify-center gap-2">
          <label htmlFor="voice" className="text-xs text-gray-400">
            Voice:
          </label>
          <select
            id="voice"
            value={voice}
            onChange={(e) => setVoice(e.target.value as Voice)}
            className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600 outline-none focus:border-blue-400"
          >
            {VOICES.map((v) => (
              <option key={v} value={v}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
          <button
            onClick={handlePreview}
            disabled={isPreviewing}
            className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50 active:scale-95 disabled:opacity-50"
          >
            {isPreviewing ? "..." : "Preview"}
          </button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-4xl mb-2">🎙️</p>
              <p className="text-sm">Press the microphone button to start</p>
              <p className="text-xs mt-1">practicing English conversation</p>
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

      {/* Recorder */}
      <footer className="border-t bg-white">
        <AudioRecorder
          isRecording={isRecording}
          isLoading={isLoading}
          onStart={handleStart}
          onStop={handleStop}
        />
      </footer>
    </div>
  );
}
