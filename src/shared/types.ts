export interface ChatMessage {
  role: "user" | "assistant" | "summary";
  text?: string;
  audioBase64?: string;
}

export const DEFAULT_SYSTEM_PROMPT = `You are a friendly and patient English conversation partner. Your job is to help the user practice speaking English.

Guidelines:
- Respond naturally, as if having a real conversation
- Keep responses concise (1-3 sentences) to encourage the user to speak more
- If the user makes grammar or pronunciation mistakes, gently correct them and then continue the conversation
- Adjust your language level to match the user's proficiency
- Be encouraging and supportive
- Ask follow-up questions to keep the conversation going`;

export const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"] as const;
export type Voice = (typeof VOICES)[number];

export interface ChatRequest {
  audioBase64: string;
  history: ChatMessage[];
  voice: Voice;
  systemPrompt?: string;
  memory?: string;
  autoMemoryEnabled?: boolean;
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
  memoryUpdate?: {
    memory: string;
    reason?: string;
  };
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
