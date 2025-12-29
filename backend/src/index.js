import express from "express";
import path from "path";
import OpenAI from "openai";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { fileURLToPath } from "url";
import fs from "fs";

import prisma from "./core/prisma.js";      // ★ 새로 추가

import { AVAILABLE_MODELS } from "./config/models.js";
import isoConversationsRouter from "./routes/isoConversations.js";
import isoMessagesRouter from "./routes/isoMessages.js";
import isoGuidesRouter from "./routes/isoGuides.js";
import filesRouter from "./routes/files.js";
import authRouter from "./routes/auth.js";
import { requireAuth } from "./middlewares/auth.js";

dotenv.config();

const app = express();

// CORS, JSON 파서
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Auth (public)
app.use("/api/auth", authRouter);

// All other APIs require auth
app.use("/api/iso-chat", requireAuth);
app.use("/api/ucon/iso/conversations", requireAuth, isoConversationsRouter);
app.use("/api/ucon/iso/messages", requireAuth, isoMessagesRouter);
app.use("/api/ucon/iso/guides", requireAuth, isoGuidesRouter);
app.use("/api/ucon/files", requireAuth, filesRouter);

// ===== 업로드 폴더/정적경로 설정 =====

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 업로드 폴더 설정 (기본: backend/uploads, 환경변수로 외부 지정 가능)
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
});

// 정적 파일 서빙 (업로드된 파일)
app.use("/uploads", express.static(uploadDir));

// =============================
// OpenAI 클라이언트 & 시스템 프롬프트
// =============================

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// 시스템 프롬프트 로드
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
  systemPrompt = "";
}

// 정보 부족/오류 시 공통 fallback 메시지
const FALLBACK_MESSAGE =
  "유효한 정보가 없습니다. 관련 기초 정보를 제공해 주시면 심층 학습하여 더 나은 정보를 드리겠습니다.";

// =============================
// Health check
// =============================

// /api/health (프론트/외부용)
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "UCONAI_gpt-ISO backend",
    ts: new Date().toISOString(),
  });
});

// /healthz (내부/모니터링용)
app.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    service: "UCONAI_gpt-ISO backend",
  });
});

// =============================
//   ISO Expert 챗 API
// =============================

app.post("/api/iso-chat", upload.single("file"), async (req, res) => {
  try {
    const {
      message,
      model,
      conversationId: clientConversationId,
    } = req.body;
    const file = req.file;

    const selectedModel = model || process.env.OPENAI_MODEL || "gpt-5.1";

    console.log("[ISO-CHAT] request", {
      ts: new Date().toISOString(),
      messagePreview: message ? message.slice(0, 80) : null,
      model: selectedModel,
      hasFile: !!file,
      clientConversationId,
    });

    if (!message && !file) {
      return res
        .status(400)
        .json({ error: "message 또는 file 중 하나는 있어야 합니다." });
    }

    // 1) conversationId 준비
    //    - 클라이언트에서 보낸 것이 있으면 그대로 쓰고
    //    - 없으면 새 conversation을 만든 후 그 id를 사용
    let conversationId = clientConversationId;

    if (!conversationId) {
      const convTitle =
        (message && typeof message === "string"
          ? message.slice(0, 80)
          : "ISO 대화") || "ISO 대화";

      const newConv = await prisma.conversation.create({
        data: {
          title: convTitle, // ★ 필수 필드 채워줌
          // Conversation 모델에 project/type 같은 다른 필수 필드가 있다면
          // 여기서 같이 채워주면 됨. (에러가 또 뜨면 그 필드 이름 보고 추가)
        },
      });

      conversationId = newConv.id;
    }

    // GPT에 넘길 userContent (기존 로직 유지)
    const userContent =
      message ||
      "이 대화는 ISO/IEC 관련 지원을 위한 테스트입니다. ISO/IEC 관련 질문을 자유롭게 입력해 주세요.";

    // DB에 저장할 사용자 메시지 (메시지가 없으면 파일만 있는 요청이라는 표시)
    const userMessageForDb =
      message || "[auto] 파일만 포함된 요청 (본문 텍스트 없음)";

    // 2) USER 메시지 DB 저장
    await prisma.message.create({
      data: {
        conversationId,
        role: "USER",
        content: userMessageForDb,
      },
    });

    // 3) GPT 호출
    const completion = await client.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_completion_tokens: 1500,
    });

    const choice = completion.choices?.[0];
    let replyMessage = choice?.message || null;

    let rawContent = "";
    if (replyMessage) {
      if (typeof replyMessage.content === "string") {
        rawContent = replyMessage.content;
      } else if (Array.isArray(replyMessage.content)) {
        rawContent = replyMessage.content
          .map((part) => {
            if (typeof part === "string") return part;
            if (part && typeof part === "object" && "text" in part) {
              return part.text || "";
            }
            return "";
          })
          .join("\n");
      }
    }

    if (!rawContent || rawContent.trim().length === 0) {
      replyMessage = {
        role: "assistant",
        content: FALLBACK_MESSAGE,
      };
      rawContent = FALLBACK_MESSAGE;
    } else if (replyMessage && typeof replyMessage.content !== "string") {
      replyMessage = {
        role: replyMessage.role || "assistant",
        content: rawContent,
      };
    }

    console.log(
      "[ISO-CHAT] success, reply length:",
      (replyMessage?.content || "").length
    );

    // 4) ASSISTANT 메시지 DB 저장
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        content: rawContent,
      },
    });

    // 5) conversationId 포함해서 응답
    return res.json({
      conversationId,
      reply: {
        role: "assistant",
        content: assistantMessage.content,
      },
      model: selectedModel,
    });
  } catch (err) {
    console.error("[ISO API ERROR]", err);

    return res.status(200).json({
      reply: {
        role: "assistant",
        content: FALLBACK_MESSAGE,
      },
      model: "error",
      error: err?.message || String(err),
    });
  }
});

// 루트
app.get("/", (_req, res) => {
  res.send(
    "UCONAI_gpt-ISO backend is running. Try GET /healthz or POST /api/iso-chat"
  );
});

// 서버 시작
const port = process.env.PORT || 4400;
app.listen(port, () => {
  console.log(`UCONAI_gpt-ISO backend listening on port ${port}`);
});
