import { Router } from "express";
import type { ChatRequest, ChatResponse } from "../../shared/types.js";
import { chat } from "../lib/openai.js";

const router = Router();

router.post("/chat", async (req, res) => {
  try {
    const { audioBase64, history } = req.body as ChatRequest;

    if (!audioBase64) {
      res.status(400).json({ error: "audioBase64 is required" });
      return;
    }

    const result = await chat(audioBase64, history ?? []);
    const response: ChatResponse = result;
    res.json(response);
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Failed to process chat request" });
  }
});

export default router;
