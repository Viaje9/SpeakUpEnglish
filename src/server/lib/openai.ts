import OpenAI from "openai";
import type { ChatMessage, Voice, TokenUsage } from "../../shared/types.js";

let _client: OpenAI | null = null;
function getClient() {
  if (!_client) _client = new OpenAI();
  return _client;
}

const SYSTEM_PROMPT = `You are a friendly and patient English conversation partner. Your job is to help the user practice speaking English.

Guidelines:
- Respond naturally, as if having a real conversation
- Keep responses concise (1-3 sentences) to encourage the user to speak more
- If the user makes grammar or pronunciation mistakes, gently correct them and then continue the conversation
- Adjust your language level to match the user's proficiency
- Be encouraging and supportive
- Ask follow-up questions to keep the conversation going`;

export async function chat(
  audioBase64: string,
  history: ChatMessage[],
  voice: Voice = "alloy",
): Promise<{ transcript: string; audioBase64: string; usage: TokenUsage }> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
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

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini-audio-preview",
    modalities: ["text", "audio"],
    audio: { voice, format: "wav" },
    messages,
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

  return { transcript, audioBase64: responseAudio, usage };
}

const SUMMARIZE_PROMPT = `Based on the conversation above, summarize everything the USER said in first person.
- Combine all the user's statements into a coherent, well-organized passage
- Write in first person as if the user is writing about themselves
- Fix grammar and improve phrasing naturally, but keep the original meaning
- Write in English only
- Do not include anything the assistant said`;

export async function summarize(
  history: ChatMessage[],
): Promise<{ summary: string; usage: TokenUsage }> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
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

  const response = await getClient().chat.completions.create({
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

export async function previewVoice(voice: Voice): Promise<string> {
  const response = await getClient().audio.speech.create({
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

export async function translateToTraditionalChinese(text: string): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: TRANSLATE_PROMPT },
      { role: "user", content: text },
    ],
  });

  return response.choices[0].message.content?.trim() ?? "";
}
