import { Router } from "express";
import type { ChatRequest, ChatResponse, SummarizeRequest, SummarizeResponse, Voice } from "../../shared/types.js";
import { VOICES } from "../../shared/types.js";
import { chat, summarize, previewVoice } from "../lib/openai.js";

const router = Router();

router.post("/chat", async (req, res) => {
  try {
    const { audioBase64, history, voice } = req.body as ChatRequest;

    if (!audioBase64) {
      res.status(400).json({ error: "audioBase64 is required" });
      return;
    }

    const result = await chat(audioBase64, history ?? [], voice ?? "alloy");
    const response: ChatResponse = result;
    res.json(response);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Failed to process chat request" });
  }
});

router.post("/summarize", async (req, res) => {
  try {
    const { history } = req.body as SummarizeRequest;

    if (!history || history.length === 0) {
      res.status(400).json({ error: "history is required" });
      return;
    }

    const result = await summarize(history);
    const response: SummarizeResponse = result;
    res.json(response);
  } catch (err) {
    console.error("Summarize error:", err);
    res.status(500).json({ error: "Failed to summarize conversation" });
  }
});

router.get("/voice-preview", async (req, res) => {
  try {
    const voice = req.query.voice as string;
    if (!voice || !VOICES.includes(voice as Voice)) {
      res.status(400).json({ error: "Invalid voice" });
      return;
    }

    const audioBase64 = await previewVoice(voice as Voice);
    res.json({ audioBase64 });
  } catch (err) {
    console.error("Voice preview error:", err);
    res.status(500).json({ error: "Failed to generate voice preview" });
  }
});

export default router;
