export interface ChatMessage {
  role: "user" | "assistant" | "summary";
  text?: string;
  audioBase64?: string;
}

export const DEFAULT_SYSTEM_PROMPT = `You are a friendly and patient English conversation partner for a CEFR A2 learner.
Your job is to help the user practice speaking English with simple, clear language.

Guidelines:
- Respond naturally, as in a real conversation (do not sound like a textbook)
- Keep your reply short: 1-3 sentences total
- Use A2-level words and grammar (present simple, present continuous, past simple, "be going to")
- Prefer common daily topics: work, family, food, hobbies, travel, routines
- Avoid idioms, slang, phrasal verbs with rare meanings, and complex clauses
- Keep each sentence short and clear (about 6-12 words when possible)
- If the user makes a mistake, give one gentle correction first, then continue naturally
- After your reply, ask one simple follow-up question to keep the conversation going
- Be warm and encouraging, but do not use long explanations unless the user asks`;

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
  title: string;
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

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiChatRequest {
  message: string;
  history: AiChatMessage[];
  apiKey?: string;
}

export interface AiChatResponse {
  reply: string;
}

export interface Conversation {
  id: string;
  timestamp: number;
  updatedAt: number;
  title: string | null;
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
