
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 파일 업로드: 메모리에 올려두기 (지금은 내용은 안 쓰고, 존재만 확인)
const upload = multer({ storage: multer.memoryStorage() });

// OpenAI 클라이언트 (v6.x 기준)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 시스템 프롬프트 로드
// cwd가 backend 디렉토리라고 가정 (npm run dev를 backend에서 실행)
const systemPromptPath = path.join(
  process.cwd(),
  "src",
  "config",
  "systemPrompt.iso.expert.ko-en.txt"
);

let systemPrompt = "";
try {
  systemPrompt = fs.readFileSync(systemPromptPath, "utf8");
  console.log("[SYSTEM PROMPT] Loaded from", systemPromptPath);
} catch (e) {
  console.error("[ERROR] Failed to load system prompt:", e);
  systemPrompt = ""; // 프롬프트 없더라도 동작은 하도록
}

// health check
app.get("/healthz", (req, res) => {
  res.json({
    status: "ok",
    service: "UCONAI_gpt-ISO backend",
  });
});

// 메인 ISO Expert 엔드포인트 (텍스트 전용 안정 버전)
app.post("/api/iso-chat", upload.single("file"), async (req, res) => {
  try {
    const { message, model } = req.body;
    const file = req.file;

    const selectedModel = model || process.env.OPENAI_MODEL || "gpt-5.1";

    console.log("[ISO-CHAT] request", {
      messagePreview: message ? message.slice(0, 50) : null,
      model: selectedModel,
      hasFile: !!file,
    });

    if (!message && !file) {
      return res
        .status(400)
        .json({ error: "message 또는 file 중 하나는 있어야 합니다." });
    }

    // 지금은 파일 내용은 사용하지 않고, 텍스트 기반으로만 응답
    const userContent =
      message ||
      "첨부된 파일을 기반으로 ISO/IEC 표준 작업 관점에서 분석해줘.";

    // OpenAI v6.x: max_tokens → max_completion_tokens
    const completion = await client.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_completion_tokens: 1500,
    });

    const replyMessage = completion.choices[0]?.message;

    console.log("[ISO-CHAT] success, reply length:", replyMessage?.content?.length);

    return res.json({
      reply: replyMessage,
      model: selectedModel,
    });
  } catch (err) {
    console.error("[ISO API ERROR]", err);
    return res.status(500).json({
      error: "ISO Expert API 호출 중 오류",
      detail: err.message,
    });
  }
});

// 루트
app.get("/", (req, res) => {
  res.send(
    "UCONAI_gpt-ISO backend is running. Try GET /healthz or POST /api/iso-chat"
  );
});

const port = process.env.PORT || 4400;
app.listen(port, () => {
  console.log(`UCONAI_gpt-ISO backend listening on port ${port}`);
});
