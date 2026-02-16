import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import chatRouter from "./routes/chat.js";

const app = express();
const PORT = process.env.PORT ?? 3847;
const HOST = process.env.HOST ?? "0.0.0.0";
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? "500mb";

app.use(cors());
app.use(express.json({ limit: JSON_BODY_LIMIT }));

app.use("/api", chatRouter);

const clientDistPath = path.resolve(process.cwd(), "dist");
const clientIndexPath = path.join(clientDistPath, "index.html");
const hasClientBuild = fs.existsSync(clientIndexPath);

if (hasClientBuild) {
  app.use(express.static(clientDistPath, { index: false }));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(clientIndexPath);
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  const payloadErr = err as { type?: string };
  if (payloadErr?.type === "entity.too.large") {
    res.status(413).json({
      error: `Payload too large. Reduce audio/history size or set JSON_BODY_LIMIT higher (current: ${JSON_BODY_LIMIT}).`,
    });
    return;
  }
  next(err);
});

app.listen(Number(PORT), HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`Server running on http://${displayHost}:${PORT}`);
  if (hasClientBuild) {
    console.log(`Serving frontend from ${clientDistPath}`);
  } else {
    console.log("Frontend build not found. Run `npm run build` to serve static files.");
  }
});
