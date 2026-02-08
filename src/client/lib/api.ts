import type {
  ChatMessage,
  ChatResponse,
  SummarizeResponse,
  TranslateResponse,
  Voice,
} from "../../shared/types";

export async function sendChat(
  audioBase64: string,
  history: ChatMessage[],
  voice: Voice,
  apiKey?: string,
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64, history, voice, apiKey }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function sendSummarize(
  history: ChatMessage[],
  apiKey?: string,
): Promise<SummarizeResponse> {
  const res = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, apiKey }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function sendTranslate(text: string, apiKey?: string): Promise<TranslateResponse> {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, apiKey }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function sendVoicePreview(voice: Voice, apiKey?: string): Promise<{ audioBase64: string }> {
  const res = await fetch("/api/voice-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice, apiKey }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
