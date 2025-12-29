// src/routes/files.js

import { Router } from "express";
import { minioClient, UCON_MINIO_BUCKET } from "../lib/minio.js";
import { buildObjectKey } from "../utils/fileKey.js";
import prisma from "../core/prisma.js";

const router = Router();

/**
 * 업로드용 Presigned URL 생성
 * POST /api/ucon/files/presign/upload
 *
 * body:
 *  - engine: "iso" | "esg" | ...
 *  - type: "message" | "guide"
 *  - ownerId: messageId 또는 guideId (UUID)
 *  - filename: 원본 파일명
 */
router.post("/presign/upload", async (req, res) => {
  try {
    const { engine, type, ownerId, filename } = req.body;

    if (!engine || !type || !ownerId || !filename) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const objectKey = buildObjectKey(engine, type, ownerId, filename);

    const url = await minioClient.presignedPutObject(
      UCON_MINIO_BUCKET,
      objectKey,
      600 // 10분
    );

    return res.json({ uploadUrl: url, objectKey });
  } catch (err) {
    console.error("Presign upload error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// BigInt를 JSON으로 내보낼 수 있도록 변환
function normalizeAttachment(row) {
  if (!row) return row;
  return {
    ...row,
    // Prisma BigInt 타입 -> Number 로 변환
    fileSize: row.fileSize != null ? Number(row.fileSize) : null,
  };
}

/**
 * 업로드 완료 후 DB 메타데이터 저장
 *
 * POST /api/ucon/files/commit
 *
 * body:
 *  - engine: "iso" | ...
 *  - type: "message" | "guide"
 *  - ownerId: messageId 또는 guideId (UUID)
 *  - originalName: 원본 파일명
 *  - objectKey: MinIO storage key (presign 시 받은 값)
 *  - mimetype: MIME 타입 (예: "text/plain")
 *  - size: 파일 크기 (number, bytes)
 */
router.post("/commit", async (req, res) => {
  try {
    const {
      engine,
      type,
      ownerId,
      originalName,
      objectKey,
      mimetype,
      size,
    } = req.body;

    if (!type || !ownerId || !objectKey) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const fileName = originalName || "unnamed";
    const fileSize = size != null ? BigInt(size) : BigInt(0);
    const mimeType = mimetype || null;

    let record;

    if (type === "message") {
      // MessageAttachment: messageId 기준
      record = await prisma.messageAttachment.create({
        data: {
          messageId: ownerId,   // ownerId 는 messageId 로 사용
          fileName,
          fileSize,
          mimeType,
          storageKey: objectKey,
        },
      });

      return res.json({
        ok: true,
        engine,
        type,
        attachment: normalizeAttachment(record),
      });
    } else if (type === "guide") {
      // GuideFile: guideId 기준
      record = await prisma.guideFile.create({
        data: {
          guideId: ownerId,     // ownerId 는 guideId 로 사용
          fileName,
          fileSize,
          mimeType,
          storageKey: objectKey,
        },
      });

      return res.json({
        ok: true,
        engine,
        type,
        file: normalizeAttachment(record),
      });
    } else {
      return res.status(400).json({
        error: "Invalid type (use 'message' or 'guide')",
      });
    }
  } catch (err) {
    console.error("Commit file error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * 다운로드용 Presigned URL 생성
 * GET /api/ucon/files/presign/download?key=<objectKey>
 */
router.get("/presign/download", async (req, res) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({ error: "Missing key" });
    }

    const url = await minioClient.presignedGetObject(
      UCON_MINIO_BUCKET,
      String(key),
      180 // 3분
    );

    return res.json({ downloadUrl: url });
  } catch (err) {
    console.error("Presign download error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
