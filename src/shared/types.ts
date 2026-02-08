export interface ChatMessage {
  role: "user" | "assistant";
  text?: string;
  audioBase64?: string;
}

export interface ChatRequest {
  audioBase64: string;
  history: ChatMessage[];
}

export interface ChatResponse {
  transcript: string;
  audioBase64: string;
}
