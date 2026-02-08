export interface ChatMessage {
  role: "user" | "assistant" | "summary";
  text?: string;
  audioBase64?: string;
}

export const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"] as const;
export type Voice = (typeof VOICES)[number];

export interface ChatRequest {
  audioBase64: string;
  history: ChatMessage[];
  voice: Voice;
  apiKey?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptTextTokens: number;
  promptAudioTokens: number;
  completionTextTokens: number;
  completionAudioTokens: number;
}

export interface ChatResponse {
  transcript: string;
  audioBase64: string;
  usage: TokenUsage;
}

export interface SummarizeRequest {
  history: ChatMessage[];
  apiKey?: string;
}

export interface SummarizeResponse {
  summary: string;
  usage: TokenUsage;
}

export interface TranslateRequest {
  text: string;
  apiKey?: string;
}

export interface VoicePreviewRequest {
  voice: Voice;
  apiKey?: string;
}

export interface TranslateResponse {
  translatedText: string;
}

export interface Conversation {
  id: string;
  timestamp: number;
  updatedAt: number;
  summary: string | null;
  messageCount: number;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  order: number;
  role: "user" | "assistant" | "summary";
  text?: string;
  audioBase64?: string;
}
