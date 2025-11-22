import { AVAILABLE_MODELS } from "./config/models.js";



import express from "express";
import path from "path";
import OpenAI from "openai";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { fileURLToPath } from "url";
import fs from "fs";
import fsp from "fs/promises";

dotenv.config();


const app = express();

// 모델 목록 제공 (app 선언 이후에 등록)
app.get("/api/models", (_req, res) => {
  res.json({ models: AVAILABLE_MODELS });
});
app.use(cors());
app.use(express.json());

// --- v1.1 uploaded files in-memory store (나중에 DB/MinIO 메타테이블로 교체 예정) --- 
/**
 * globalFiles: 프로젝트 전체 공통 파일
 * roomFiles:   각 conversationId별 파일 목록
 */
let globalFiles = []; // { id, originalName, filename, size, mimeType, path, createdAt }
let roomFiles = new Map(); // key: conversationId, value: same 구조 배열

function getRoomFiles(conversationId) {
  if (!roomFiles.has(conversationId)) {
    roomFiles.set(conversationId, []);
  }
  return roomFiles.get(conversationId);
}

// __dirname 계산 (ESM 환경)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 업로드 폴더 설정 (예: backend/uploads)
const upload = multer({
  dest: path.join(__dirname, "uploads"),
});

// 정적 파일 서빙 (업로드된 파일)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ---------- File Upload (공통 / 방별) ----------

// 프로젝트 전체 공통 파일 업로드
app.post(
  "/api/files/global",
  upload.array("files"),
  (req, res) => {
    const files = req.files || [];
    const now = new Date().toISOString();

    const metas = files.map((f) => {
      const id =
        "f-global-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2, 8);
      const meta = {
        id,
        originalName: f.originalname,
        filename: f.filename,
        size: f.size,
        mimeType: f.mimetype,
        path: f.path,
        createdAt: now,
      };
      globalFiles.push(meta);
      return meta;
    });

    res.status(201).json({ uploaded: metas });
  }
);

// 방별 파일 업로드
app.post(
  "/api/files/room/:conversationId",
  upload.array("files"),
  (req, res) => {
    const { conversationId } = req.params;
    const files = req.files || [];
    const now = new Date().toISOString();

    const bucket = getRoomFiles(conversationId);
    const metas = files.map((f) => {
      const id =
        "f-room-" +
        conversationId +
        "-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2, 8);
      const meta = {
        id,
        originalName: f.originalname,
        filename: f.filename,
        size: f.size,
        mimeType: f.mimetype,
        path: f.path,
        createdAt: now,
      };
      bucket.push(meta);
      return meta;
    });

    res.status(201).json({ conversationId, uploaded: metas });
  }
);

// ---------- File list & delete ----------

// 공통 파일 목록
app.get("/api/files/global", (req, res) => {
  res.json(globalFiles);
});

// 방별 파일 목록
app.get("/api/files/room/:conversationId", (req, res) => {
  const { conversationId } = req.params;
  const bucket = getRoomFiles(conversationId);
  res.json(bucket);
});

// 공통 파일 삭제
app.delete("/api/files/global/:id", async (req, res) => {
  const { id } = req.params;
  const idx = globalFiles.findIndex((f) => f.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "file not found" });
  }
  const file = globalFiles[idx];

  // 디스크 파일 삭제 (실패해도 서버 다운되지 않게 try)
  try {
    if (file.path && fs.existsSync(file.path)) {
      await fsp.unlink(file.path);
    }
  } catch (err) {
    console.error("[FILE DELETE] error", err);
  }

  globalFiles.splice(idx, 1);
  res.json({ ok: true });
});

// 방별 파일 삭제
app.delete("/api/files/room/:conversationId/:id", async (req, res) => {
  const { conversationId, id } = req.params;
  const bucket = getRoomFiles(conversationId);
  const idx = bucket.findIndex((f) => f.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "file not found" });
  }
  const file = bucket[idx];

  try {
    if (file.path && fs.existsSync(file.path)) {
      await fsp.unlink(file.path);
    }
  } catch (err) {
    console.error("[FILE DELETE] error", err);
  }

  bucket.splice(idx, 1);
  res.json({ ok: true });
});

dotenv.config();


// ---------- Global Guides (프로젝트 공통 지침) ----------
// 목록 조회
app.get("/api/guides/global", (req, res) => {
  res.json(globalGuides);
});
// 추가
app.post("/api/guides/global", (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "title과 content는 필수입니다." });
  }
  const now = new Date().toISOString();
  const guide = {
    id: `g-global-${Date.now()}`,
    title,
    content,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  globalGuides.push(guide);
  res.status(201).json(guide);
});
// 수정
app.put("/api/guides/global/:id", (req, res) => {
  const { id } = req.params;
  const { title, content, isActive } = req.body;
  const idx = globalGuides.findIndex((g) => g.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "guide not found" });
  }
  const orig = globalGuides[idx];
  const updated = {
    ...orig,
    title: title ?? orig.title,
    content: content ?? orig.content,
    isActive:
      typeof isActive === "boolean" ? isActive : orig.isActive,
    updatedAt: new Date().toISOString(),
  };
  globalGuides[idx] = updated;
  res.json(updated);
});
// 삭제(소프트 삭제 느낌으로 isActive=false 처리)
app.delete("/api/guides/global/:id", (req, res) => {
  const { id } = req.params;
  const idx = globalGuides.findIndex((g) => g.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "guide not found" });
  }
  globalGuides[idx].isActive = false;
  globalGuides[idx].updatedAt = new Date().toISOString();
  res.json({ ok: true });
});

// ---------- Room Guides (각 방 지침) ----------
// 목록 조회
app.get("/api/guides/room/:conversationId", (req, res) => {
  const { conversationId } = req.params;
  const guides = getRoomGuides(conversationId);
  res.json(guides);
});
// 추가
app.post("/api/guides/room/:conversationId", (req, res) => {
  const { conversationId } = req.params;
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "title과 content는 필수입니다." });
  }
  const now = new Date().toISOString();
  const guides = getRoomGuides(conversationId);
  const guide = {
    id: `g-room-${conversationId}-${Date.now()}`,
    title,
    content,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  guides.push(guide);
  res.status(201).json(guide);
});
// 수정
app.put("/api/guides/room/:conversationId/:id", (req, res) => {
  const { conversationId, id } = req.params;
  const { title, content, isActive } = req.body;
  const guides = getRoomGuides(conversationId);
  const idx = guides.findIndex((g) => g.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "guide not found" });
  }
  const orig = guides[idx];
  const updated = {
    ...orig,
    title: title ?? orig.title,
    content: content ?? orig.content,
    isActive:
      typeof isActive === "boolean" ? isActive : orig.isActive,
    updatedAt: new Date().toISOString(),
  };
  guides[idx] = updated;
  res.json(updated);
});
// 삭제 (isActive=false)
app.delete("/api/guides/room/:conversationId/:id", (req, res) => {
  const { conversationId, id } = req.params;
  const guides = getRoomGuides(conversationId);
  const idx = guides.findIndex((g) => g.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "guide not found" });
  }
  guides[idx].isActive = false;
  guides[idx].updatedAt = new Date().toISOString();
  res.json({ ok: true });
});

// ---------- File Upload (공통 / 방별) ----------
// 프로젝트 전체 공통 파일
app.post(
  "/api/files/global",
  upload.array("files"),
  (req, res) => {
    // TODO: 나중에 DB에 메타데이터 저장
    const files = req.files || [];
    res.status(201).json({
      uploaded: files.map((f) => ({
        filename: f.filename,
        originalName: f.originalname,
        size: f.size,
        mimeType: f.mimetype,
        path: f.path,
      })),
    });
  }
);
// 방별 파일
app.post(
  "/api/files/room/:conversationId",
  upload.array("files"),
  (req, res) => {
    const { conversationId } = req.params;
    const files = req.files || [];
    // TODO: 나중에 room_files 테이블에 저장
    res.status(201).json({
      conversationId,
      uploaded: files.map((f) => ({
        filename: f.filename,
        originalName: f.originalname,
        size: f.size,
        mimeType: f.mimetype,
        path: f.path,
      })),
    });
  }
);

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
