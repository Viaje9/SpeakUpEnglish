import type { ChatMessage, ChatResponse, Voice } from "../../shared/types";

export async function sendChat(
  audioBase64: string,
  history: ChatMessage[],
  voice: Voice,
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64, history, voice }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
