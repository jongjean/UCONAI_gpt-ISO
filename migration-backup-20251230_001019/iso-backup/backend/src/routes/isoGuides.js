import express from "express";
import prisma from "../core/prisma.js";
import { GuideScope } from "@prisma/client";
import { minioClient, UCON_MINIO_BUCKET } from "../lib/minio.js";

const router = express.Router();

const PRESIGNED_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7일

function normalizeFile(row) {
  if (!row) return row;
  return {
    ...row,
    fileSize: row.fileSize != null ? Number(row.fileSize) : null,
  };
}

async function enrichGuideFiles(rows = []) {
  if (!rows.length) return [];

  return Promise.all(
    rows.map(async (f) => {
      const downloadUrl = await minioClient.presignedGetObject(
        UCON_MINIO_BUCKET,
        f.storageKey,
        PRESIGNED_EXPIRY_SECONDS
      );

      return {
        ...normalizeFile(f),
        downloadUrl,
      };
    })
  );
}

function parseFiles(input) {
  if (!input) return null;
  let files = input;
  if (typeof input === "string") {
    try {
      files = JSON.parse(input);
    } catch {
      files = [];
    }
  }
  return Array.isArray(files) ? files : [];
}

function toGuideFileData(guideId, files) {
  const seen = new Set();
  return files
    .filter((f) => f && f.storageKey)
    .filter((f) => {
      const key = `${f.storageKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((f) => ({
      guideId,
      fileName: f.fileName || "unnamed",
      fileSize: f.fileSize != null ? BigInt(f.fileSize) : BigInt(0),
      mimeType: f.mimeType || null,
      storageKey: f.storageKey,
    }));
}

// =============================
// Global Guides (user-scoped) - DB 저장
// =============================

// GET /api/ucon/iso/guides/global
router.get("/global", async (req, res) => {
  try {
    const guides = await prisma.guide.findMany({
      where: {
        scope: GuideScope.GLOBAL,
        OR: [{ userId: req.user?.uid }, { userId: null }],
      },
      orderBy: [
        { sortIndex: "asc" },
        { createdAt: "asc" },
      ],
      include: { files: true },
    });

    const enriched = await Promise.all(
      guides.map(async (g) => {
        const files = await enrichGuideFiles(g.files || []);
        return { ...g, files };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error("GET /api/ucon/iso/guides/global error:", err);
    res.status(500).json({ error: "Failed to load global guides" });
  }
});

// POST /api/ucon/iso/guides/global
// body: { title: string, content: string }
router.post("/global", async (req, res) => {
  try {
    const { title, content } = req.body;
    const filesInput = parseFiles(req.body.files);
    if (!title?.trim()) {
      return res.status(400).json({ error: "title required" });
    }

    const normalizedContent =
      typeof content === "string" ? content : "";

    const minSort = await prisma.guide.aggregate({
      where: {
        scope: GuideScope.GLOBAL,
        OR: [{ userId: req.user?.uid }, { userId: null }],
      },
      _min: { sortIndex: true },
    });

    const nextSortIndex =
      typeof minSort._min.sortIndex === "number" ? minSort._min.sortIndex - 1 : 0;

    const guide = await prisma.guide.create({
      data: {
        scope: GuideScope.GLOBAL,
        conversationId: null,
        userId: req.user?.uid,
        title: title.trim(),
        content: normalizedContent,
        sortIndex: nextSortIndex,
      },
    });

    if (filesInput) {
      const fileData = toGuideFileData(guide.id, filesInput);
      if (fileData.length > 0) {
        await prisma.guideFile.createMany({ data: fileData });
      }
    }

    const files = await prisma.guideFile.findMany({
      where: { guideId: guide.id },
      orderBy: { createdAt: "asc" },
    });
    const enriched = await enrichGuideFiles(files);

    res.status(201).json({ ...guide, files: enriched });
  } catch (err) {
    console.error("POST /api/ucon/iso/guides/global error:", err);
    res.status(500).json({ error: "Failed to create global guide" });
  }
});

// PUT /api/ucon/iso/guides/global/:id
router.put("/global/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    const filesInput = parseFiles(req.body.files);

    if (
      typeof title === "undefined" &&
      typeof content === "undefined" &&
      typeof req.body.files === "undefined"
    ) {
      return res.status(400).json({ error: "no update payload" });
    }

    const data = {};
    if (typeof title === "string" && title.trim()) data.title = title.trim();
    if (typeof content === "string") data.content = content;

    const updated = await prisma.guide.update({
      where: { id },
      data,
    });

    if (filesInput !== null) {
      const fileData = toGuideFileData(id, filesInput);
      if (fileData.length > 0) {
        await prisma.guideFile.deleteMany({ where: { guideId: id } });
        await prisma.guideFile.createMany({ data: fileData });
      }
    }

    const files = await prisma.guideFile.findMany({
      where: { guideId: id },
      orderBy: { createdAt: "asc" },
    });
    const enriched = await enrichGuideFiles(files);

    res.json({ ...updated, files: enriched });
  } catch (err) {
    console.error("PUT /api/ucon/iso/guides/global/:id error:", err);
    res.status(500).json({ error: "Failed to update global guide" });
  }
});

// DELETE /api/ucon/iso/guides/global/:id
router.delete("/global/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.guide.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/ucon/iso/guides/global/:id error:", err);
    res.status(500).json({ error: "Failed to delete global guide" });
  }
});

// =============================
// Room Guides (conversation-scoped) - DB 저장
// =============================

// GET /api/ucon/iso/guides/room/:conversationId
router.get("/room/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!conversationId) {
      return res.status(400).json({ error: "conversationId required" });
    }

    const guides = await prisma.guide.findMany({
      where: {
        scope: GuideScope.CONVERSATION,
        conversationId,
        userId: req.user?.uid,
      },
      orderBy: [
        { sortIndex: "asc" },
        { createdAt: "asc" },
      ],
      include: { files: true },
    });

    const enriched = await Promise.all(
      guides.map(async (g) => {
        const files = await enrichGuideFiles(g.files || []);
        return { ...g, files };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error("GET /api/ucon/iso/guides/room/:conversationId error:", err);
    res.status(500).json({ error: "Failed to load room guides" });
  }
});

// POST /api/ucon/iso/guides/room/:conversationId
// body: { title, content }
router.post("/room/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title, content } = req.body;
    const filesInput = parseFiles(req.body.files);

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId required" });
    }
    if (!title?.trim()) {
      return res.status(400).json({ error: "title required" });
    }

    const normalizedContent =
      typeof content === "string" ? content : "";

    const minSort = await prisma.guide.aggregate({
      where: {
        scope: GuideScope.CONVERSATION,
        conversationId,
        userId: req.user?.uid,
      },
      _min: { sortIndex: true },
    });
    const nextSortIndex =
      typeof minSort._min.sortIndex === "number" ? minSort._min.sortIndex - 1 : 0;

    const guide = await prisma.guide.create({
      data: {
        scope: GuideScope.CONVERSATION,
        conversationId,
        userId: req.user?.uid,
        title: title.trim(),
        content: normalizedContent,
        sortIndex: nextSortIndex,
      },
    });

    if (filesInput) {
      const fileData = toGuideFileData(guide.id, filesInput);
      if (fileData.length > 0) {
        await prisma.guideFile.createMany({ data: fileData });
      }
    }

    const files = await prisma.guideFile.findMany({
      where: { guideId: guide.id },
      orderBy: { createdAt: "asc" },
    });
    const enriched = await enrichGuideFiles(files);

    res.status(201).json({ ...guide, files: enriched });
  } catch (err) {
    console.error("POST /api/ucon/iso/guides/room/:conversationId error:", err);
    res.status(500).json({ error: "Failed to create room guide" });
  }
});

// PUT /api/ucon/iso/guides/room/:conversationId/:id
router.put("/room/:conversationId/:id", async (req, res) => {
  try {
    const { conversationId, id } = req.params;
    const { title, content } = req.body;
    const filesInput = parseFiles(req.body.files);

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId required" });
    }
    if (
      typeof title === "undefined" &&
      typeof content === "undefined" &&
      typeof req.body.files === "undefined"
    ) {
      return res.status(400).json({ error: "no update payload" });
    }

    const data = {};
    if (typeof title === "string" && title.trim()) data.title = title.trim();
    if (typeof content === "string") data.content = content;

    const updated = await prisma.guide.update({
      where: { id, userId: req.user?.uid },
      data,
    });

    if (filesInput !== null) {
      const fileData = toGuideFileData(id, filesInput);
      if (fileData.length > 0) {
        await prisma.guideFile.deleteMany({ where: { guideId: id } });
        await prisma.guideFile.createMany({ data: fileData });
      }
    }

    const files = await prisma.guideFile.findMany({
      where: { guideId: id },
      orderBy: { createdAt: "asc" },
    });
    const enriched = await enrichGuideFiles(files);

    res.json({ ...updated, files: enriched });
  } catch (err) {
    console.error(
      "PUT /api/ucon/iso/guides/room/:conversationId/:id error:",
      err
    );
    res.status(500).json({ error: "Failed to update room guide" });
  }
});

router.post("/global/reorder", async (req, res) => {
  try {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds must be an array" });
    }

    const userId = req.user?.uid;
    const owned = await prisma.guide.findMany({
      where: {
        scope: GuideScope.GLOBAL,
        OR: [
          { userId },
          { userId: null },
        ],
      },
      select: { id: true },
    });

    const visibleIds = new Set(owned.map((g) => g.id));
    const updates = [];
    let sort = 0;
    for (const id of orderedIds) {
      if (!visibleIds.has(id)) continue;
      updates.push(
        prisma.guide.update({
          where: { id },
          data: { sortIndex: sort++ },
        })
      );
      visibleIds.delete(id);
    }

    if (visibleIds.size > 0) {
      for (const id of visibleIds) {
        updates.push(
          prisma.guide.update({
            where: { id },
            data: { sortIndex: sort++ },
          })
        );
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/ucon/iso/guides/global/reorder error:", err);
    res.status(500).json({ error: "Failed to reorder global guides" });
  }
});

router.post("/room/:conversationId/reorder", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { orderedIds } = req.body || {};
    if (!conversationId) {
      return res.status(400).json({ error: "conversationId required" });
    }
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds must be an array" });
    }

    const userId = req.user?.uid;
    const owned = await prisma.guide.findMany({
      where: {
        scope: GuideScope.CONVERSATION,
        conversationId,
        OR: [
          { userId },
          { userId: null },
        ],
      },
      select: { id: true },
    });

    const ownedIds = new Set(owned.map((g) => g.id));
    const updates = [];
    let sort = 0;
    for (const id of orderedIds) {
      if (!ownedIds.has(id)) continue;
      updates.push(
        prisma.guide.update({
          where: { id },
          data: { sortIndex: sort++ },
        })
      );
      ownedIds.delete(id);
    }

    if (ownedIds.size > 0) {
      for (const id of ownedIds) {
        updates.push(
          prisma.guide.update({
            where: { id },
            data: { sortIndex: sort++ },
          })
        );
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/ucon/iso/guides/room/:conversationId/reorder error:", err);
    res.status(500).json({ error: "Failed to reorder room guides" });
  }
});

// DELETE /api/ucon/iso/guides/room/:conversationId/:id
router.delete("/room/:conversationId/:id", async (req, res) => {
  try {
    const { conversationId, id } = req.params;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId required" });
    }

    await prisma.guide.delete({
      where: { id, userId: req.user?.uid },
    });

    res.status(204).send();
  } catch (err) {
    console.error(
      "DELETE /api/ucon/iso/guides/room/:conversationId/:id error:",
      err
    );
    res.status(500).json({ error: "Failed to delete room guide" });
  }
});

export default router;
