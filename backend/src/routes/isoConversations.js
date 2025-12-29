// src/routes/isoConversations.js
import express from "express";
import prisma from "../core/prisma.js";

const router = express.Router();

// GET /api/ucon/iso/conversations
router.get("/", async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.user?.uid },
      orderBy: [
        { sortIndex: "asc" },
        { createdAt: "desc" },
      ],
    });
    res.json(conversations);
  } catch (err) {
    console.error("GET /api/ucon/iso/conversations error:", err);
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

// 새 대화방 생성
router.post("/", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const userId = req.user?.uid;
    const minSort = await prisma.conversation.aggregate({
      where: { userId },
      _min: { sortIndex: true },
    });
    const nextSortIndex =
      typeof minSort._min.sortIndex === "number"
        ? minSort._min.sortIndex - 1
        : 0;

    const convo = await prisma.conversation.create({
      data: {
        title: title.trim(),
        userId,
        sortIndex: nextSortIndex,
      },
    });

    res.status(201).json(convo);
  } catch (err) {
    console.error("POST /api/ucon/iso/conversations error:", err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// 특정 대화방 제목 변경
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const updated = await prisma.conversation.update({
      where: { id, userId: req.user?.uid }, // 소유자 필터
      data: { title: title.trim() },
    });

    res.json(updated);
  } catch (err) {
    console.error("PATCH /api/ucon/iso/conversations/:id error:", err);
    res.status(500).json({ error: "Failed to update conversation" });
  }
});

router.post("/reorder", async (req, res) => {
  try {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds must be an array" });
    }

    const userId = req.user?.uid;
    const owned = await prisma.conversation.findMany({
      where: { userId },
      select: { id: true },
    });

    const ownedIds = new Set(owned.map((c) => c.id));
    const updates = [];
    let sort = 0;
    for (const id of orderedIds) {
      if (!ownedIds.has(id)) continue;
      updates.push(
        prisma.conversation.update({
          where: { id, userId },
          data: { sortIndex: sort++ },
        })
      );
      ownedIds.delete(id);
    }

    if (ownedIds.size > 0) {
      for (const id of ownedIds) {
        updates.push(
          prisma.conversation.update({
            where: { id, userId },
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
    console.error("POST /api/ucon/iso/conversations/reorder error:", err);
    res.status(500).json({ error: "Failed to reorder conversations" });
  }
});

// 대화방 삭제 (관련 메시지/지침은 ON DELETE CASCADE로 같이 삭제)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.conversation.delete({
      where: { id, userId: req.user?.uid }, // 소유자 필터
    });

    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/ucon/iso/conversations/:id error:", err);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

export default router;
