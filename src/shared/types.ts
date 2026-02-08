export interface ChatMessage {
  role: "user" | "assistant";
  text?: string;
  audioBase64?: string;
}

export const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"] as const;
export type Voice = (typeof VOICES)[number];

export interface ChatRequest {
  audioBase64: string;
  history: ChatMessage[];
  voice: Voice;
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
