import OpenAI from "openai";
import type { ChatMessage, Voice, TokenUsage } from "../../shared/types.js";
import { DEFAULT_SYSTEM_PROMPT } from "../../shared/types.js";

let _client: OpenAI | null = null;
function getClient(apiKey?: string) {
  const trimmedApiKey = apiKey?.trim();
  if (trimmedApiKey) return new OpenAI({ apiKey: trimmedApiKey });
  if (!_client) _client = new OpenAI();
  return _client;
}

function buildSystemPrompt(systemPrompt?: string, memory?: string): string {
  const basePrompt = systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  const trimmedMemory = memory?.trim();
  if (!trimmedMemory) return basePrompt;

  return `${basePrompt}

Long-term memory about this user:
${trimmedMemory}`;
}

const UPDATE_MEMORY_TOOL = {
  type: "function" as const,
  function: {
    name: "update_memory",
    description:
      "Update long-term memory only when stable user preferences, goals, or level information should be remembered.",
    parameters: {
      type: "object",
      properties: {
        memory: {
          type: "string",
          description: "Full replacement memory text. Keep concise, factual, and under 1200 characters.",
        },
        reason: {
          type: "string",
          description: "Why this memory should be updated.",
        },
      },
      required: ["memory"],
      additionalProperties: false,
    },
  },
};

export async function chat(
  audioBase64: string,
  history: ChatMessage[],
  voice: Voice = "alloy",
  systemPrompt?: string,
  memory?: string,
  autoMemoryEnabled = false,
  apiKey?: string,
): Promise<{
  transcript: string;
  audioBase64: string;
  usage: TokenUsage;
  memoryUpdate?: { memory: string; reason?: string };
}> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(systemPrompt, memory) },
  ];

  for (const msg of history) {
    if (msg.role === "user" && msg.audioBase64) {
      messages.push({
        role: "user",
        content: [{ type: "input_audio", input_audio: { data: msg.audioBase64, format: "wav" } }],
      });
    } else if (msg.role === "assistant" && msg.text) {
      messages.push({ role: "assistant", content: msg.text });
    }
  }

  messages.push({
    role: "user",
    content: [{ type: "input_audio", input_audio: { data: audioBase64, format: "wav" } }],
  });

  const response = await getClient(apiKey).chat.completions.create({
    model: "gpt-4o-mini-audio-preview",
    modalities: ["text", "audio"],
    audio: { voice, format: "wav" },
    messages,
    tools: autoMemoryEnabled ? [UPDATE_MEMORY_TOOL] : undefined,
  });

  const choice = response.choices[0];
  const transcript = choice.message.audio?.transcript ?? choice.message.content ?? "";
  const responseAudio = choice.message.audio?.data ?? "";

  const promptDetails = response.usage?.prompt_tokens_details as Record<string, number> | undefined;
  const completionDetails = response.usage?.completion_tokens_details as Record<string, number> | undefined;

  const usage = {
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
    promptTextTokens: promptDetails?.text_tokens ?? 0,
    promptAudioTokens: promptDetails?.audio_tokens ?? 0,
    completionTextTokens: completionDetails?.text_tokens ?? 0,
    completionAudioTokens: completionDetails?.audio_tokens ?? 0,
  };

  let memoryUpdate: { memory: string; reason?: string } | undefined;
  const toolCalls = choice.message.tool_calls ?? [];
  for (const call of toolCalls) {
    if (call.type !== "function" || call.function.name !== "update_memory") continue;
    try {
      const parsed = JSON.parse(call.function.arguments) as { memory?: string; reason?: string };
      const nextMemory = parsed.memory?.trim();
      if (!nextMemory) continue;
      memoryUpdate = {
        memory: nextMemory.slice(0, 1200),
        reason: parsed.reason?.trim(),
      };
    } catch {
      // ignore malformed tool arguments
    }
  }

  return { transcript, audioBase64: responseAudio, usage, memoryUpdate };
}

const SUMMARIZE_PROMPT = `Based on the conversation above, summarize everything the USER said in first person.
- Combine all the user's statements into a coherent, well-organized passage
- Write in first person as if the user is writing about themselves
- Fix grammar and improve phrasing naturally, but keep the original meaning
- Write in English only
- Do not include anything the assistant said`;

export async function summarize(
  history: ChatMessage[],
  apiKey?: string,
): Promise<{ summary: string; usage: TokenUsage }> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: DEFAULT_SYSTEM_PROMPT },
  ];

  for (const msg of history) {
    if (msg.role === "user" && msg.audioBase64) {
      messages.push({
        role: "user",
        content: [{ type: "input_audio", input_audio: { data: msg.audioBase64, format: "wav" } }],
      });
    } else if (msg.role === "assistant" && msg.text) {
      messages.push({ role: "assistant", content: msg.text });
    }
  }

  messages.push({ role: "user", content: SUMMARIZE_PROMPT });

  const response = await getClient(apiKey).chat.completions.create({
    model: "gpt-4o-mini-audio-preview",
    modalities: ["text"],
    messages,
  });

  const summary = response.choices[0].message.content ?? "";

  const promptDetails = response.usage?.prompt_tokens_details as Record<string, number> | undefined;
  const completionDetails = response.usage?.completion_tokens_details as Record<string, number> | undefined;

  const usage: TokenUsage = {
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
    promptTextTokens: promptDetails?.text_tokens ?? 0,
    promptAudioTokens: promptDetails?.audio_tokens ?? 0,
    completionTextTokens: completionDetails?.text_tokens ?? 0,
    completionAudioTokens: completionDetails?.audio_tokens ?? 0,
  };

  return { summary, usage };
}

export async function previewVoice(voice: Voice, apiKey?: string): Promise<string> {
  const response = await getClient(apiKey).audio.speech.create({
    model: "tts-1",
    voice,
    input: "Hi there! I'm excited to practice English with you today.",
    response_format: "mp3",
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
}

const TRANSLATE_PROMPT = `Translate the user's English text to Traditional Chinese (繁體中文).
- Keep the meaning accurate and natural
- Keep tone and intent
- Return only translated Chinese text with no extra commentary`;

export async function translateToTraditionalChinese(text: string, apiKey?: string): Promise<string> {
  const response = await getClient(apiKey).chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: TRANSLATE_PROMPT },
      { role: "user", content: text },
    ],
  });

  return response.choices[0].message.content?.trim() ?? "";
}
