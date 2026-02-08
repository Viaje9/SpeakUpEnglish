import OpenAI from "openai";
import type { ChatMessage, Voice } from "../../shared/types.js";

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
): Promise<{ transcript: string; audioBase64: string; usage: import("../../shared/types.js").TokenUsage }> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  for (const msg of history) {
    if (msg.role === "assistant" && msg.text) {
      messages.push({ role: "assistant", content: msg.text });
    }
  }

  messages.push({
    role: "user",
    content: [
      {
        type: "input_audio",
        input_audio: { data: audioBase64, format: "wav" },
      },
    ],
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
