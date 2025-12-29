// src/routes/isoMessages.js

import { Router } from "express";
import prisma from "../core/prisma.js";
import { minioClient, UCON_MINIO_BUCKET } from "../lib/minio.js";

const router = Router();

/**
 * BigInt를 JSON으로 내보내기 위해 fileSize를 Number로 변환
 */
function normalizeAttachment(row) {
  if (!row) return row;
  return {
    ...row,
    fileSize:
      row.fileSize != null
        ? Number(row.fileSize)
        : null,
  };
}

const PRESIGNED_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7일

/**
 * 첨부파일 presigned download URL을 붙여 반환
 */
async function enrichAttachments(rows = []) {
  if (!rows.length) return [];

  return Promise.all(
    rows.map(async (f) => {
      const downloadUrl = await minioClient.presignedGetObject(
        UCON_MINIO_BUCKET,
        f.storageKey,
        PRESIGNED_EXPIRY_SECONDS
      );

      return {
        ...normalizeAttachment(f),
        downloadUrl,
      };
    })
  );
}

/**
 * [GET] /api/ucon/iso/messages?conversationId=...
 * - 해당 대화방의 메시지 목록 + 첨부파일 + presigned downloadUrl
 */
router.get("/", async (req, res) => {
  try {
    const { conversationId } = req.query;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }

    // 1) 메시지 + 첨부파일(attachments) 함께 조회
    const messages = await prisma.message.findMany({
      where: { conversationId: String(conversationId) },
      orderBy: { createdAt: "asc" },
      include: {
        attachments: true, // MessageAttachment[]
      },
    });

    // 2) 각 메시지의 attachments에 presigned downloadUrl 추가 + BigInt 정규화
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        if (!msg.attachments || msg.attachments.length === 0) {
          return {
            ...msg,
            attachments: [],
          };
        }

        const enrichedAttachments = await Promise.all(
          msg.attachments.map(async (f) => {
            const downloadUrl = await minioClient.presignedGetObject(
              UCON_MINIO_BUCKET,
              f.storageKey,
              PRESIGNED_EXPIRY_SECONDS
            );

            return {
              ...normalizeAttachment(f),
              downloadUrl,
            };
          })
        );

        return {
          ...msg,
          attachments: enrichedAttachments,
        };
      })
    );

    return res.json(enriched);
  } catch (e) {
    console.error("GET /api/ucon/iso/messages error:", e);
    return res.status(500).json({ error: e.message });
  }
});

/**
 * [GET] /api/ucon/iso/messages/:id
 * - 단일 메시지 + 첨부파일 + presigned downloadUrl
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const msg = await prisma.message.findUnique({
      where: { id },
      include: { attachments: true },
    });

    if (!msg) {
      return res.status(404).json({ error: "Message not found" });
    }

    const attachments =
      msg.attachments && msg.attachments.length > 0
        ? await Promise.all(
            msg.attachments.map(async (f) => {
              const downloadUrl = await minioClient.presignedGetObject(
                UCON_MINIO_BUCKET,
                f.storageKey,
                PRESIGNED_EXPIRY_SECONDS
              );
              return {
                ...normalizeAttachment(f),
                downloadUrl,
              };
            })
          )
        : [];

    return res.json({
      ...msg,
      attachments,
    });
  } catch (e) {
    console.error("GET /api/ucon/iso/messages/:id error:", e);
    return res.status(500).json({ error: e.message });
  }
});

/**
 * [POST] /api/ucon/iso/messages
 * - 새 메시지 생성 (DB 저장)
 * body:
 *  - conversationId: string (UUID)
 *  - role: "USER" | "ASSISTANT" | "SYSTEM"
 *  - content: string
 *  - attachments?: [{ storageKey, fileName, fileSize, mimeType }]
 */
router.post("/", async (req, res) => {
  try {
    const { conversationId, role, content } = req.body;
    let { attachments } = req.body;

    if (!conversationId || !content) {
      return res
        .status(400)
        .json({ error: "conversationId and content are required" });
    }

    // role이 없으면 기본값 USER
    const messageRole =
      role && ["USER", "ASSISTANT", "SYSTEM"].includes(role)
        ? role
        : "USER";

    const created = await prisma.message.create({
      data: {
        conversationId,
        role: messageRole,
        content,
      },
    });

    // attachments 입력값 정규화 (JSON 문자열로 올 경우도 대비)
    if (typeof attachments === "string") {
      try {
        attachments = JSON.parse(attachments);
      } catch {
        attachments = [];
      }
    }
    const attachmentInputs = Array.isArray(attachments) ? attachments : [];

    // 저장 가능한 데이터만 남김
    const attachmentData = attachmentInputs
      .filter((a) => a && a.storageKey)
      .map((a) => ({
        messageId: created.id,
        fileName: a.fileName || "unnamed",
        fileSize: a.fileSize != null ? BigInt(a.fileSize) : BigInt(0),
        mimeType: a.mimeType || null,
        storageKey: a.storageKey,
      }));

    if (attachmentData.length > 0) {
      await prisma.messageAttachment.createMany({
        data: attachmentData,
      });
    }

    // 첨부 조회 + presigned url 부착
    const dbAttachments =
      attachmentData.length > 0
        ? await prisma.messageAttachment.findMany({
            where: { messageId: created.id },
            orderBy: { createdAt: "asc" },
          })
        : [];

    const enriched = await enrichAttachments(dbAttachments);

    return res.status(201).json({
      ...created,
      attachments: enriched,
    });
  } catch (e) {
    console.error("POST /api/ucon/iso/messages error:", e);
    return res.status(500).json({ error: e.message });
  }
});

export default router;
