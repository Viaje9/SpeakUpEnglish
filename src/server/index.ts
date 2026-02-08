import "dotenv/config";
import express from "express";
import cors from "cors";
import chatRouter from "./routes/chat.js";

const app = express();
const PORT = process.env.PORT ?? 3847;
const HOST = process.env.HOST ?? "0.0.0.0";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/api", chatRouter);

app.listen(Number(PORT), HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`Server running on http://${displayHost}:${PORT}`);
});
