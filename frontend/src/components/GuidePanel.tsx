// src/components/GuidePanel.tsx
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { Guide, GuideFile } from "../types/isoChat";
import { reorderGlobalGuides, reorderRoomGuides } from "../api/guides";
import "./GuidePanel.scrollbar.css";

export type GuidePanelProps = {
  isOpen: boolean;
  onClose: () => void;
  globalGuides: Guide[];
  /** 현재 활성 테마의 지침 목록 */
  conversationGuides: Guide[];
  activeConversationId: string | null;
  onCreateGuide: (scope: "global" | "conversation") => void;
  onUpdateGuide: (guide: Guide) => Promise<Guide | void> | void;
  onDeleteGuide: (id: string, scope: "global" | "conversation") => void;
  onReloadGlobalGuides?: () => void;
  onReloadRoomGuides?: (conversationId?: string | null) => void;
};

type Tab = "global" | "conversation";

// 파일 중복 방지를 위한 시그니처
const fileSignature = (f: File) => `${f.name}-${f.size}`;

type GuideDraft = {
  id: string;
  scope: Guide["scope"];
  conversationId?: string;
  title: string;
  content: string;
  updatedAt: string;
};

const DRAFT_STORAGE_KEY = "guideDrafts";

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 10 ? 0 : 1)} ${sizes[i]}`;
};

const reorder = <T,>(list: T[], startIndex: number, endIndex: number): T[] => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

const GuidePanel: React.FC<GuidePanelProps> = ({
  isOpen,
  onClose,
  globalGuides,
  conversationGuides,
  activeConversationId,
  onCreateGuide,
  onUpdateGuide,
  onDeleteGuide,
  onReloadGlobalGuides,
  onReloadRoomGuides,
}) => {
  const initialTab = (): Tab => {
    const saved = localStorage.getItem("guidePanelTab");
    if (saved === "conversation" || saved === "global") return saved;
    return "global";
  };
  const [tab, setTab] = useState<Tab>(initialTab);
  const savedTabRef = useRef<Tab | null>(null);
  const suppressTabPersistenceRef = useRef(false);
  const [editing, setEditing] = useState<Guide | null>(null);

  // 패널 위치/크기
  const [viewport, setViewport] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 720,
  });
  const [pos, setPos] = useState({ x: viewport.width / 2 - 360, y: 60 });
  const [size, setSize] = useState({ width: 720, height: 560 });

  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [resizing, setResizing] = useState(false);
  const resizeStartRef = useRef({
    x: 0,
    y: 0,
    width: 720,
    height: 560,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const skipRenameCommitRef = useRef(false);
  const suppressEditingPersistRef = useRef(false);
  const pendingActiveGuideIdRef = useRef<string | null>(null);
  const restoringActiveGuideRef = useRef(false);
  const manualSelectionRef = useRef(false);
  const restorationAttemptedRef = useRef(false);

  const [orderedGuides, setOrderedGuides] = useState<Guide[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    scope: Tab;
    title?: string | null;
  } | null>(null);
  const deleteCancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteConfirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const deleteDialogLabelId = useId();
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const sendStatusTimerRef = useRef<number | null>(null);
  const draftsRef = useRef<Map<string, GuideDraft>>(new Map());
  const contentSaveTimerRef = useRef<number | null>(null);
  const pendingGuideRef = useRef<Guide | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const lastSavedAtRef = useRef<number>(0);

  const clearSendStatusTimer = useCallback(() => {
    if (sendStatusTimerRef.current !== null) {
      window.clearTimeout(sendStatusTimerRef.current);
      sendStatusTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (viewport.width <= 900) {
      setPos({ x: 0, y: 0 });
      setSize({ width: viewport.width, height: viewport.height });
    }
  }, [viewport.width, viewport.height, isOpen]);

  useEffect(() => {
    restorationAttemptedRef.current = false;
  }, [tab, activeConversationId]);

  const persistDrafts = useCallback(() => {
    try {
      const serialized = JSON.stringify(
        Array.from(draftsRef.current.values())
      );
      localStorage.setItem(DRAFT_STORAGE_KEY, serialized);
    } catch (error) {
      console.warn("failed to persist guide drafts", error);
    }
  }, []);

  const loadDrafts = useCallback(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;
      const pairs: Array<[string, GuideDraft]> = [];
      parsed.forEach((raw: any) => {
        if (!raw || typeof raw.id !== "string") return;
        const scope: Guide["scope"] = raw.scope === "conversation" ? "conversation" : "global";
        const entry: GuideDraft = {
          id: raw.id,
          scope,
          conversationId: typeof raw.conversationId === "string" ? raw.conversationId : undefined,
          title: typeof raw.title === "string" ? raw.title : "",
          content: typeof raw.content === "string" ? raw.content : "",
          updatedAt:
            typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
        };
        pairs.push([entry.id, entry]);
      });
      draftsRef.current = new Map(pairs);
    } catch (error) {
      draftsRef.current = new Map();
      console.warn("failed to load guide drafts", error);
    }
  }, []);

  const removeDraft = useCallback(
    (id: string) => {
      if (!draftsRef.current.has(id)) return;
      draftsRef.current.delete(id);
      persistDrafts();
    },
    [persistDrafts]
  );

  const saveDraft = useCallback(
    (guide: Guide) => {
      const draft: GuideDraft = {
        id: guide.id,
        scope: guide.scope,
        conversationId: guide.conversationId,
        title: guide.title ?? "",
        content: guide.content ?? "",
        updatedAt: guide.updatedAt ?? new Date().toISOString(),
      };
      draftsRef.current.set(guide.id, draft);
      persistDrafts();
    },
    [persistDrafts]
  );


  const applyDraftIfFresher = useCallback((guide: Guide): Guide => {
    const draft = draftsRef.current.get(guide.id);
    if (!draft) return guide;
    if (draft.scope !== guide.scope) return guide;

    const base: Guide =
      draft.scope === "conversation" && draft.conversationId && !guide.conversationId
        ? { ...guide, conversationId: draft.conversationId }
        : guide;

    const draftTs = new Date(draft.updatedAt).getTime();
    const guideTs = new Date(base.updatedAt || draft.updatedAt).getTime();
    if (
      draftTs > guideTs ||
      (!base.content && draft.content) ||
      (!base.title && draft.title)
    ) {
      return {
        ...base,
        title: draft.title || base.title,
        content: draft.content || base.content,
        updatedAt: draft.updatedAt,
      };
    }
    return base;
  }, []);

  const scheduleSendStatusReset = useCallback(() => {
    clearSendStatusTimer();
    sendStatusTimerRef.current = window.setTimeout(() => {
      setSendStatus("idle");
      sendStatusTimerRef.current = null;
    }, 2400);
  }, [clearSendStatusTimer]);

  useEffect(() => {
    if (pendingDelete) {
      deleteCancelButtonRef.current?.focus();
    }
  }, [pendingDelete]);

  useEffect(() => {
    loadDrafts();
    setOrderedGuides((prev) => prev.map((guide) => applyDraftIfFresher(guide)));
    setEditing((prev) => (prev ? applyDraftIfFresher(prev) : prev));
  }, [loadDrafts, applyDraftIfFresher]);

  useEffect(() => {
    return () => {
      clearSendStatusTimer();
    };
  }, [clearSendStatusTimer]);

  useEffect(() => {
    return () => {
      if (contentSaveTimerRef.current !== null) {
        window.clearTimeout(contentSaveTimerRef.current);
        contentSaveTimerRef.current = null;
      }
    };
  }, []);

  const normalizeGuideForSave = useCallback(
    (guide: Guide | null | undefined): Guide | null => {
      if (!guide) return null;
      if (guide.scope === "conversation") {
        const convId = guide.conversationId || activeConversationId;
        if (!convId) {
          console.warn("guide save blocked – missing conversationId", guide.id);
          return null;
        }
        return { ...guide, conversationId: convId };
      }
      return { ...guide };
    },
    [activeConversationId]
  );

  const serializeGuideSnapshot = useCallback((guide: Guide): string => {
    const files = (guide.files || []).map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
      storageKey: f.storageKey,
      downloadUrl: f.downloadUrl,
      createdAt: f.createdAt,
    }));
    return JSON.stringify({
      id: guide.id,
      scope: guide.scope,
      conversationId: guide.conversationId,
      title: guide.title,
      content: guide.content,
      files,
    });
  }, []);

  const performGuideSave = useCallback(
    async (guide: Guide) => {
      try {
        const result = await Promise.resolve(onUpdateGuide(guide));
        const applied = result ?? guide;
        setEditing((prev) => (prev && prev.id === applied.id ? applied : prev));
        setOrderedGuides((prev) =>
          prev.map((g) =>
            g.id === applied.id
              ? {
                  ...g,
                  title: applied.title,
                  content: applied.content,
                  updatedAt: applied.updatedAt,
                }
              : g
          )
        );
        saveDraft(applied);
        lastSavedSnapshotRef.current = serializeGuideSnapshot(applied);
        return { ok: true as const, guide: applied };
      } catch (error) {
        console.error("guide auto-save failed", error);
        return { ok: false as const, error };
      }
    },
    [onUpdateGuide, saveDraft, serializeGuideSnapshot]
  );

  const flushPendingGuide = useCallback(
    async (overrideGuide?: Guide) => {
      const candidate = overrideGuide ?? pendingGuideRef.current ?? editing;
      const normalized = normalizeGuideForSave(candidate);
      if (!normalized) {
        return { ok: false as const, error: new Error("missing conversationId") };
      }
      const snapshot = serializeGuideSnapshot(normalized);
      const now = Date.now();
      if (lastSavedSnapshotRef.current && lastSavedSnapshotRef.current === snapshot) {
        pendingGuideRef.current = null;
        return { ok: true as const, guide: normalized };
      }
      if (now - lastSavedAtRef.current < 2000) {
        pendingGuideRef.current = null;
        return { ok: true as const, guide: normalized };
      }
      pendingGuideRef.current = null;

      return new Promise<{ ok: true; guide: Guide } | { ok: false; error: unknown }>((resolve) => {
        saveQueueRef.current = saveQueueRef.current
          .catch(() => {
            /* ignored: previous error already handled */
          })
          .then(async () => {
            const outcome = await performGuideSave(normalized);
            if (outcome.ok) {
              lastSavedAtRef.current = Date.now();
            }
            resolve(outcome);
          });
      });
    },
    [editing, normalizeGuideForSave, performGuideSave, serializeGuideSnapshot]
  );

  const scheduleGuideSave = useCallback(
    (guide: Guide) => {
      pendingGuideRef.current = guide;
      if (contentSaveTimerRef.current !== null) {
        window.clearTimeout(contentSaveTimerRef.current);
      }
      contentSaveTimerRef.current = window.setTimeout(() => {
        contentSaveTimerRef.current = null;
        void flushPendingGuide();
      }, 2000);
    },
    [flushPendingGuide]
  );

  useEffect(() => {
    if (!isOpen) {
      clearSendStatusTimer();
      void flushPendingGuide();
    }
  }, [isOpen, flushPendingGuide]);


  useEffect(() => {
    clearSendStatusTimer();
    setSendStatus("idle");
  }, [editing?.id, clearSendStatusTimer]);

  const requestDeleteGuide = (id: string, scope: Tab, title?: string | null) => {
    setPendingDelete({ id, scope, title: title ?? null });
  };

  const clearDeleteDialog = () => setPendingDelete(null);

  const confirmDeleteGuide = async () => {
    if (!pendingDelete) return;
    try {
      await Promise.resolve(onDeleteGuide(pendingDelete.id, pendingDelete.scope));
      removeDraft(pendingDelete.id);
    } finally {
      setPendingDelete(null);
    }
  };

  const handleDeleteConfirmKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      confirmDeleteGuide();
    }
  };

  const handleDeleteCancelKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      clearDeleteDialog();
    }
  };

  const renderDeleteConfirm = () => {
    if (!pendingDelete) return null;

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const cancelBtn = deleteCancelButtonRef.current;
        const confirmBtn = deleteConfirmButtonRef.current;
        if (!cancelBtn || !confirmBtn) return;
        const active = document.activeElement;
        if (active === cancelBtn) {
          confirmBtn.focus();
        } else if (active === confirmBtn) {
          cancelBtn.focus();
        } else {
          (event.key === "ArrowRight" ? confirmBtn : cancelBtn).focus();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        clearDeleteDialog();
        return;
      }
      if (event.key === "Enter" && event.target === event.currentTarget) {
        event.preventDefault();
        confirmDeleteGuide();
      }
    };

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 4000,
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={deleteDialogLabelId}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 18,
            width: 300,
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            outline: "none",
          }}
        >
          <div
            id={deleteDialogLabelId}
            style={{ fontWeight: 700, marginBottom: 10 }}
          >
            {pendingDelete.title
              ? `"${pendingDelete.title}" 지침을 삭제할까요?`
              : "지침을 삭제하시겠습니까?"}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              ref={deleteCancelButtonRef}
              onClick={clearDeleteDialog}
              onKeyDown={handleDeleteCancelKeyDown}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              취소
            </button>
            <button
              type="button"
              ref={deleteConfirmButtonRef}
              onClick={confirmDeleteGuide}
              onKeyDown={handleDeleteConfirmKeyDown}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: 0,
                background: "#b91c1c",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    );
  };
  // 탭 유지: 마지막 선택 탭을 localStorage에 저장/복원
  useEffect(() => {
    const savedTab = localStorage.getItem("guidePanelTab");
    if (savedTab === "global" || savedTab === "conversation") {
      savedTabRef.current = savedTab as Tab;
      setTab(savedTab as Tab);
    } else {
      savedTabRef.current = tab;
    }
  }, []);

  useEffect(() => {
    if (suppressTabPersistenceRef.current) {
      suppressTabPersistenceRef.current = false;
      return;
    }
    localStorage.setItem("guidePanelTab", tab);
    savedTabRef.current = tab;
  }, [tab]);

  // 활성 테마가 있을 때는 저장된 탭이 conversation이면 복원
  // 활성 테마가 없으면 전역 탭으로 전환
  useEffect(() => {
    const savedTabVal = savedTabRef.current;
    const savedIsConversation = savedTabVal === "conversation";
    if (!activeConversationId) {
      if (tab === "conversation") {
        if (contentSaveTimerRef.current !== null) {
          window.clearTimeout(contentSaveTimerRef.current);
          contentSaveTimerRef.current = null;
        }
        void flushPendingGuide();
        suppressTabPersistenceRef.current = true;
        setTab("global");
      }
      return;
    }
    if (savedIsConversation) {
      if (tab !== "conversation") {
        if (contentSaveTimerRef.current !== null) {
          window.clearTimeout(contentSaveTimerRef.current);
          contentSaveTimerRef.current = null;
        }
        void flushPendingGuide();
        setTab("conversation");
      }
    } else if (tab === "conversation" && !savedIsConversation) {
      if (contentSaveTimerRef.current !== null) {
        window.clearTimeout(contentSaveTimerRef.current);
        contentSaveTimerRef.current = null;
      }
      void flushPendingGuide();
      setTab("global");
    }
  }, [activeConversationId, tab, flushPendingGuide]);
    // 체크박스 선택 토글
    const toggleSelect = (id: string) => {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    };

    // 선택 해제
    const clearSelection = () => setSelectedIds([]);

    // 합치기(머지) 기능
    const handleMergeGuides = async () => {
      if (selectedIds.length < 2) return;
      const guidesToMerge = orderedGuides.filter((g) => selectedIds.includes(g.id));
      if (guidesToMerge.length < 2) return;

      const [primary] = guidesToMerge;
      if (!primary) return;

      const mergedTitle = guidesToMerge
        .map((g, i) => (i === 0 ? g.title : `[${g.title || "제목없음"}]`))
        .join(" ");
      const mergedContent = guidesToMerge
        .map((g) => g.content)
        .filter(Boolean)
        .join("\n\n");
      const fileMap = new Map<string, GuideFile>();
      guidesToMerge.forEach((g) => (g.files || []).forEach((f) => fileMap.set(f.id, f)));
      const mergedFiles = Array.from(fileMap.values());
      const now = new Date().toISOString();

      const mergedGuide: Guide = {
        ...primary,
        title: mergedTitle,
        content: mergedContent,
        files: mergedFiles,
        scope: tab === "global" ? "global" : "conversation",
        conversationId:
          tab === "conversation"
            ? activeConversationId || primary.conversationId
            : undefined,
        updatedAt: now,
      };

      // 나머지 지침(id) 목록
      const restIds = guidesToMerge
        .filter((g) => g.id !== primary.id)
        .map((g) => g.id);

      try {
        // 서버 반영 (업데이트 후 실제 응답을 활용)
        const updated = (await Promise.resolve(onUpdateGuide(mergedGuide))) || mergedGuide;

        for (const id of restIds) {
          await Promise.resolve(onDeleteGuide(id, tab));
        }

        // 성공 시 UI 반영: 병합 대상 제거 + 대표 지침 업데이트
        const updatedList = orderedGuides
          .filter((g) => !restIds.includes(g.id))
          .map((g) => (g.id === primary.id ? updated : g));
        setOrderedGuides(updatedList);
        setEditing(updated);
        clearSelection();
        // 최신 상태 새로고침
        if (tab === "global") {
          onReloadGlobalGuides?.();
        } else {
          onReloadRoomGuides?.(activeConversationId);
        }
      } catch (err) {
        console.error("merge guides failed", err);
      }
    };
  const currentList: Guide[] = tab === "global" ? globalGuides : conversationGuides;

  // currentList가 바뀌면 orderedGuides도 동기화
  useEffect(() => {
    const hydrated = currentList.map((guide) => applyDraftIfFresher(guide));
    setOrderedGuides(hydrated);
  }, [currentList, applyDraftIfFresher]);

  const getActiveEditingKey = useCallback(() => {
    if (tab === "global") {
      return "guidePanelActiveGlobal";
    }
    if (!activeConversationId) return null;
    return `guidePanelActiveConversation:${activeConversationId}`;
  }, [tab, activeConversationId]);

  useEffect(() => {
    if (manualSelectionRef.current) {
      restorationAttemptedRef.current = true;
      return;
    }

    if (currentList.length === 0) {
      restorationAttemptedRef.current = false;
      return;
    }

    const key = getActiveEditingKey();
    if (!key) {
      pendingActiveGuideIdRef.current = null;
      restorationAttemptedRef.current = true;
      return;
    }

    try {
      const saved = localStorage.getItem(key);
      if (!saved) {
        pendingActiveGuideIdRef.current = null;
        restorationAttemptedRef.current = true;
        return;
      }
      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object") {
        pendingActiveGuideIdRef.current = null;
        restorationAttemptedRef.current = true;
        return;
      }
      const { guideId } = parsed as { guideId?: string | null };
      if (!guideId) {
        pendingActiveGuideIdRef.current = null;
        restorationAttemptedRef.current = true;
        return;
      }

      if (editing?.id === guideId) {
        pendingActiveGuideIdRef.current = null;
        restorationAttemptedRef.current = true;
        return;
      }

      pendingActiveGuideIdRef.current = guideId;
      const sourceList = tab === "global" ? globalGuides : conversationGuides;
      const target = sourceList.find((g) => g.id === guideId) || currentList.find((g) => g.id === guideId);
      if (target) {
        suppressEditingPersistRef.current = true;
        const hydrated = applyDraftIfFresher({ ...target });
        const normalized =
          hydrated.scope === "conversation" && !hydrated.conversationId && activeConversationId
            ? { ...hydrated, conversationId: activeConversationId }
            : hydrated;
        manualSelectionRef.current = false;
        restoringActiveGuideRef.current = true;
        setEditing(normalized);
        pendingActiveGuideIdRef.current = null;
        restorationAttemptedRef.current = true;
        return;
      }
      pendingActiveGuideIdRef.current = null;
    } catch (error) {
      console.warn("failed to restore active guide", error);
      pendingActiveGuideIdRef.current = null;
    }

    restorationAttemptedRef.current = true;
  }, [tab, activeConversationId, getActiveEditingKey, currentList, applyDraftIfFresher, globalGuides, conversationGuides, editing?.id]);

  useEffect(() => {
    if (suppressEditingPersistRef.current) {
      suppressEditingPersistRef.current = false;
      return;
    }
    if (!restorationAttemptedRef.current) {
      return;
    }
    if (pendingActiveGuideIdRef.current || restoringActiveGuideRef.current) {
      return;
    }
    const key = getActiveEditingKey();
    if (!key) return;
    try {
      if (!editing) {
        localStorage.removeItem(key);
        return;
      }
      localStorage.setItem(
        key,
        JSON.stringify({ guideId: editing.id, scope: editing.scope, updatedAt: editing.updatedAt })
      );
      manualSelectionRef.current = false;
    } catch (error) {
      console.warn("failed to persist active guide", error);
    }
  }, [editing, getActiveEditingKey]);

  useEffect(() => {
    const pendingId = pendingActiveGuideIdRef.current;
    if (!pendingId) return;
    const target = orderedGuides.find((g) => g.id === pendingId);
    if (!target) return;
    suppressEditingPersistRef.current = true;
    const hydrated = applyDraftIfFresher({ ...target });
    const normalized =
      hydrated.scope === "conversation" && !hydrated.conversationId && activeConversationId
        ? { ...hydrated, conversationId: activeConversationId }
        : hydrated;
    restoringActiveGuideRef.current = true;
    setEditing(normalized);
    pendingActiveGuideIdRef.current = null;
  }, [orderedGuides, activeConversationId, applyDraftIfFresher]);

  useEffect(() => {
    if (editing && editing.id && !lastSavedSnapshotRef.current) {
      lastSavedSnapshotRef.current = serializeGuideSnapshot(editing);
    }
  }, [editing, serializeGuideSnapshot]);

  useEffect(() => {
    if (!restoringActiveGuideRef.current) return;
    restoringActiveGuideRef.current = false;
  }, [editing?.id]);

  useEffect(() => {
    if (renamingId) {
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    } else {
      renameInputRef.current = null;
    }
  }, [renamingId]);

  const persistGuideOrder = useCallback(
    async (guides: Guide[]) => {
      const guideIds = guides.map((guide) => guide.id);
      try {
        if (tab === "global") {
          await reorderGlobalGuides(guideIds);
          onReloadGlobalGuides?.();
          return;
        }
        if (!activeConversationId) {
          return;
        }
        await reorderRoomGuides(activeConversationId, guideIds);
        onReloadRoomGuides?.(activeConversationId);
      } catch (error) {
        console.error("failed to persist guide order", error);
        if (tab === "global") {
          onReloadGlobalGuides?.();
        } else if (activeConversationId) {
          onReloadRoomGuides?.(activeConversationId);
        }
      }
    },
    [tab, activeConversationId, onReloadGlobalGuides, onReloadRoomGuides]
  );

  // 드래그 앤 드롭 완료 시 순서 반영
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    const newOrder = reorder(orderedGuides, result.source.index, result.destination.index);
    setOrderedGuides(newOrder);
    void persistGuideOrder(newOrder);
  };

  const beginRename = (guide: Guide) => {
    setRenamingId(guide.id);
    setRenameDraft(guide.title || "");
    skipRenameCommitRef.current = false;
  };

  const clearRenameState = () => {
    setRenamingId(null);
    setRenameDraft("");
  };

  const handleSelectGuideItem = (guide: Guide, startRename = false) => {
    if (editing && editing.id !== guide.id) {
      void flushPendingGuide(editing);
    }
    const hydrated = applyDraftIfFresher({ ...guide });
    const normalized =
      hydrated.scope === "conversation" && !hydrated.conversationId && activeConversationId
        ? { ...hydrated, conversationId: activeConversationId }
        : hydrated;
    manualSelectionRef.current = true;
    const key = getActiveEditingKey();
    if (key) {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ guideId: normalized.id, scope: normalized.scope, updatedAt: normalized.updatedAt })
        );
      } catch (error) {
        console.warn("failed to persist active guide from selection", error);
      }
    }
    setEditing(normalized);
    if (startRename) {
      beginRename(guide);
    } else {
      clearRenameState();
      skipRenameCommitRef.current = false;
    }
  };

  const finishRename = (shouldSave: boolean): boolean => {
    if (!renamingId) return false;
    const target =
      orderedGuides.find((g) => g.id === renamingId) ||
      (editing && editing.id === renamingId ? editing : null);
    const nextTitle = renameDraft.trim();
    const originalTitle = target?.title || "";
    clearRenameState();
    const shouldCommit = shouldSave && !!target && nextTitle !== originalTitle;
    skipRenameCommitRef.current = false;
    if (!shouldCommit || !target) return false;
    handleChangeTitle(nextTitle, target);
    return true;
  };

  const handleRenameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finishRename(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      skipRenameCommitRef.current = true;
      clearRenameState();
    }
  };

  const handleRenameBlur = () => {
    if (skipRenameCommitRef.current) {
      skipRenameCommitRef.current = false;
      return;
    }
    finishRename(true);
  };


  const handleSendGuide = useCallback(async () => {
    if (!editing) return;
    clearSendStatusTimer();
    setSendStatus("sending");
    if (contentSaveTimerRef.current !== null) {
      window.clearTimeout(contentSaveTimerRef.current);
      contentSaveTimerRef.current = null;
    }
    if (renamingId) {
      const renamed = finishRename(true);
      if (renamed) {
        setSendStatus("success");
        scheduleSendStatusReset();
        return;
      }
    }
    const result = await flushPendingGuide(editing);
    if (result.ok) {
      setSendStatus("success");
    } else {
      setSendStatus("error");
    }
    scheduleSendStatusReset();
  }, [editing, renamingId, clearSendStatusTimer, finishRename, flushPendingGuide, scheduleSendStatusReset]);

  const handleClosePanel = () => {
    if (contentSaveTimerRef.current !== null) {
      window.clearTimeout(contentSaveTimerRef.current);
      contentSaveTimerRef.current = null;
    }
    void flushPendingGuide();
    onClose();
  };

  const handleTabClick = (next: Tab) => {
    if (next === tab) return;
    if (contentSaveTimerRef.current !== null) {
      window.clearTimeout(contentSaveTimerRef.current);
      contentSaveTimerRef.current = null;
    }
    void flushPendingGuide();
    setTab(next);
  };

  /* ------------------------------------------------
   * 1. 기본 선택 로직 (새 지침 자동 선택 포함)
   * ------------------------------------------------ */
  useEffect(() => {
    if (!isOpen) {
      setEditing(null);
      clearRenameState();
      return;
    }

    if (!restorationAttemptedRef.current || pendingActiveGuideIdRef.current || restoringActiveGuideRef.current) {
      return;
    }

    const list = orderedGuides;
    if (list.length === 0) {
      setEditing(null);
      clearRenameState();
      return;
    }

    // 1순위: 방금 추가된 "비어 있는" 지침 (title/content 둘 다 없음)
    const newestBlank = [...list]
      .filter((g) => !g.title && !g.content)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

    if (newestBlank && (!editing || editing.id !== newestBlank.id)) {
      const hydrated = applyDraftIfFresher({ ...newestBlank });
      const normalized =
        hydrated.scope === "conversation" && !hydrated.conversationId && activeConversationId
          ? { ...hydrated, conversationId: activeConversationId }
          : hydrated;
      manualSelectionRef.current = false;
      setEditing(normalized);
      beginRename(newestBlank);
      return;
    }

    // 2순위: 기존 editing 이 아직 목록에 있다면 그대로 유지
    if (editing && list.some((g) => g.id === editing.id)) {
      if (renamingId && !list.some((g) => g.id === renamingId)) {
        clearRenameState();
      }
      return;
    }

    // 3순위: 없으면 첫 번째 항목 선택
    const hydrated = applyDraftIfFresher({ ...list[0] });
    const normalized =
      hydrated.scope === "conversation" && !hydrated.conversationId && activeConversationId
        ? { ...hydrated, conversationId: activeConversationId }
        : hydrated;
    manualSelectionRef.current = false;
    setEditing(normalized);
    clearRenameState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tab, orderedGuides, activeConversationId]);

  /* ------------------------------------------------
   * 2. 패널 드래그 / 리사이즈
   * ------------------------------------------------ */
  const isMobileViewport = viewport.width <= 900;

  const beginDrag = (clientX: number, clientY: number) => {
    if (isMobileViewport) return;
    setDragging(true);
    dragOffsetRef.current = { x: clientX - pos.x, y: clientY - pos.y };
  };

  const beginResize = (clientX: number, clientY: number) => {
    if (isMobileViewport) return;
    setResizing(true);
    resizeStartRef.current = {
      x: clientX,
      y: clientY,
      width: size.width,
      height: size.height,
    };
  };

  const handleDragMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (isMobileViewport) return;
    const point = "touches" in e ? e.touches[0] : e;
    if (!point) return;
    beginDrag(point.clientX, point.clientY);
  };

  const handleResizeMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMobileViewport) return;
    const point = "touches" in e ? e.touches[0] : e;
    if (!point) return;
    beginResize(point.clientX, point.clientY);
  };

  useEffect(() => {
    if (!dragging && !resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragging) {
        const { x: ox, y: oy } = dragOffsetRef.current;
        const rawX = e.clientX - ox;
        const rawY = e.clientY - oy;

        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - size.height;

        setPos({
          x: Math.max(0, Math.min(maxX, rawX)),
          y: Math.max(0, Math.min(maxY, rawY)),
        });
      } else if (resizing) {
        const start = resizeStartRef.current;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;

        let newWidth = start.width + dx;
        let newHeight = start.height + dy;

        const maxWidth = window.innerWidth * 0.95;
        const maxHeight = window.innerHeight * 0.9;

        newWidth = Math.max(480, Math.min(maxWidth, newWidth));
        newHeight = Math.max(360, Math.min(maxHeight, newHeight));

        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
      setResizing(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (dragging) {
        const { x: ox, y: oy } = dragOffsetRef.current;
        const rawX = t.clientX - ox;
        const rawY = t.clientY - oy;
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - size.height;
        setPos({
          x: Math.max(0, Math.min(maxX, rawX)),
          y: Math.max(0, Math.min(maxY, rawY)),
        });
      } else if (resizing) {
        const start = resizeStartRef.current;
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;

        const maxWidth = window.innerWidth * 0.95;
        const maxHeight = window.innerHeight * 0.9;
        const newWidth = Math.max(480, Math.min(maxWidth, start.width + dx));
        const newHeight = Math.max(360, Math.min(maxHeight, start.height + dy));
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleTouchEnd = () => {
      setDragging(false);
      setResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [dragging, resizing, size.width, size.height]);

  /* ------------------------------------------------
   * 3. 파일 첨부 공통 로직 (중복 방지)
   * ------------------------------------------------ */
  const safeAddFiles = (files: File[]) => {
    if (!editing) return;
    if (!files.length) return;

    const existing = new Set(
      (editing.files || []).map((f: GuideFile) => `${f.fileName}-${f.fileSize ?? ""}`)
    );

    const filtered = files.filter(
      (f) => !existing.has(fileSignature(f))
    );
    if (!filtered.length) return;

    const now = new Date().toISOString();
    const newGuideFiles: GuideFile[] = filtered.map((f) => ({
      id: `gf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: f.name,
      fileSize: f.size,
      mimeType: f.type,
      storageKey: "",
      downloadUrl: "",
      createdAt: now,
      file: f,
    }));

    const updated: Guide = {
      ...editing,
      files: [...(editing.files || []), ...newGuideFiles],
      updatedAt: now,
    };

    setEditing(updated);
    saveDraft(updated);
    scheduleGuideSave(updated);
  };

  // 패널 열려 있는 동안 전역 Ctrl+V 지원
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: ClipboardEvent) => {
      if (!editing) return;
      const files = Array.from(e.clipboardData?.files || []);
      if (!files.length) return;
      e.preventDefault();
      safeAddFiles(files);
    };

    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [isOpen, editing]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    safeAddFiles(files);
    e.target.value = "";
  };

  // 삭제 버튼은 노출하되 실제 파일은 보존 (서버 정책)
  const handleRemoveGuideFile = () => {
    window.alert("서버 보존 정책으로 첨부파일은 삭제되지 않습니다.");
  };

  /* ------------------------------------------------
   * 4. 제목/내용 변경
   * ------------------------------------------------ */
  const handleChangeTitle = (value: string, guideOverride?: Guide) => {
    const base = guideOverride ?? editing;
    if (!base) return;
    const updated: Guide = {
      ...base,
      title: value,
      updatedAt: new Date().toISOString(),
    };
    setEditing((prev) => (prev && prev.id === updated.id ? updated : prev));
    setOrderedGuides((prev) =>
      prev.map((g) =>
        g.id === updated.id ? { ...g, title: updated.title, updatedAt: updated.updatedAt } : g
      )
    );
    saveDraft(updated);
    scheduleGuideSave(updated);
  };

  const handleChangeContent = (value: string) => {
    if (!editing) return;
    const updated: Guide = {
      ...editing,
      content: value,
      updatedAt: new Date().toISOString(),
    };
    setEditing(updated);
    setOrderedGuides((prev) =>
      prev.map((g) =>
        g.id === updated.id
          ? {
              ...g,
              content: updated.content,
              updatedAt: updated.updatedAt,
            }
          : g
      )
    );
    saveDraft(updated);
    scheduleGuideSave(updated);
  };

  if (!isOpen) return null;

  const isEditingActive = Boolean(editing);

  /* ------------------------------------------------
   * 5. 렌더링
   * ------------------------------------------------ */
  return (
    <>
      {renderDeleteConfirm()}
      {/* 어두운 배경 – 드래그/리사이즈 중에는 닫히지 않게 */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 1000,
        }}
      />

      {/* 플로팅 패널 */}
      <div
        style={{
          position: "fixed",
          left: isMobileViewport ? 0 : pos.x,
          top: isMobileViewport ? 0 : pos.y,
          width: isMobileViewport ? viewport.width : size.width,
          height: isMobileViewport ? viewport.height : size.height,
          maxWidth: isMobileViewport ? "100vw" : "95vw",
          maxHeight: isMobileViewport ? "100vh" : "90vh",
          background: "#020617",
          color: "#f9fafb",
          borderRadius: isMobileViewport ? 0 : 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          padding: isMobileViewport ? 12 : 20,
          cursor: dragging ? "grabbing" : "default",
        }}
      >
        {/* 상단 헤더 + 드래그 핸들 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 12,
            gap: 8,
          }}
        >
          <div
            onMouseDown={handleDragMouseDown}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
              background: "rgba(148,163,184,0.08)",
              userSelect: "none",
            }}
            title="패널 이동"
          >
            <span style={{ fontSize: 16, opacity: 0.8 }}>⋮⋮</span>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              지침 / 가이드 관리
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#9ca3af",
                marginTop: 2,
              }}
            >
              프로젝트 공통 지침과 테마방 지침을 구분해 관리합니다.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => {
                void handleSendGuide();
              }}
              disabled={!isEditingActive}
              style={{
                borderRadius: 999,
                border: "1px solid #7c3aed",
                background: isEditingActive ? "#7c3aed" : "#4c1d95",
                color: "#fff",
                padding: "6px 16px",
                fontSize: 12,
                fontWeight: 600,
                cursor: isEditingActive ? "pointer" : "not-allowed",
                opacity: isEditingActive ? 1 : 0.6,
              }}
              aria-label="지침 전송"
            >
              전송
            </button>
            {sendStatus !== "idle" && (
              <span
                style={{
                  fontSize: 11,
                  color:
                    sendStatus === "success"
                      ? "#c4b5fd"
                      : sendStatus === "error"
                      ? "#fca5a5"
                      : "#d1d5db",
                }}
              >
                {sendStatus === "sending"
                  ? "전송 중..."
                  : sendStatus === "success"
                  ? "전송 완료"
                  : "전송 실패"}
              </span>
            )}
            <button
              type="button"
              onClick={handleClosePanel}
              style={{
                border: 0,
                borderRadius: "999px",
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#111827",
                color: "#e5e7eb",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 16,
              }}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={() => handleTabClick("global")}
            style={{
              flex: 1,
              borderRadius: 999,
              border: 0,
              padding: "6px 10px",
              fontSize: 12,
              cursor: "pointer",
              background: tab === "global" ? "#7c3aed" : "#111827",
              color: tab === "global" ? "#fff" : "#e5e7eb",
            }}
          >
            프로젝트 공통 지침
          </button>
          <button
            type="button"
            onClick={() => handleTabClick("conversation")}
            disabled={!activeConversationId}
            style={{
              flex: 1,
              borderRadius: 999,
              border: 0,
              padding: "6px 10px",
              fontSize: 12,
              cursor: activeConversationId ? "pointer" : "not-allowed",
              opacity: activeConversationId ? 1 : 0.5,
              background: tab === "conversation" ? "#7c3aed" : "#111827",
              color: tab === "conversation" ? "#fff" : "#e5e7eb",
            }}
          >
            테마방 지침
          </button>
        </div>

        {/* 본문: 좌측 리스트 / 우측 편집 */}
        <div
          style={{
            flex: 1,
            display: "flex",
            gap: 16,
            minHeight: 0,
            minWidth: 0,
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/* 좌측: 리스트 */}
          <div
            style={{
              flex: "0 0 260px",
              maxWidth: 300,
              minWidth: 180,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              height: "100%",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: 8, gap: 24 }}>
              <button
                type="button"
                onClick={() => onCreateGuide(tab)}
                style={{
                  borderRadius: 8,
                  border: 0,
                  padding: "8px 18px",
                  fontSize: 13,
                  background: "#7c3aed",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  minWidth: 110,
                  letterSpacing: 0.5,
                }}
              >
                새지침추가
              </button>
              <button
                type="button"
                onClick={handleMergeGuides}
                disabled={selectedIds.length < 2}
                style={{
                  borderRadius: 8,
                  border: 0,
                  padding: "8px 18px",
                  fontSize: 13,
                  background: selectedIds.length >= 2 ? "#7c3aed" : "#4b5563",
                  color: "#fff",
                  cursor: selectedIds.length >= 2 ? "pointer" : "not-allowed",
                  opacity: selectedIds.length >= 2 ? 1 : 0.6,
                  fontWeight: 600,
                  minWidth: 110,
                  letterSpacing: 0.5,
                }}
              >
                지침 합치기
              </button>
            </div>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="guide-list-droppable">
                {(provided: import("react-beautiful-dnd").DroppableProvided) => (
                  <div
                    style={{
                      height: "100%",
                      minHeight: 0,
                      background: "#020617",
                      overflowY: "auto",
                      overflowX: "auto",
                      minWidth: 0,
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      whiteSpace: "nowrap",
                    }}
                    className="guide-list-scrollbox"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {orderedGuides.length === 0 ? (
                      <div
                        style={{
                          padding: 10,
                          fontSize: 12,
                          color: "#9ca3af",
                        }}
                      >
                        아직 등록된 지침이 없습니다.
                      </div>
                    ) : (
                      <>
                        {orderedGuides.map((g, idx) => (
                          <Draggable key={g.id} draggableId={g.id} index={idx}>
                            {(provided: import("react-beautiful-dnd").DraggableProvided, snapshot: import("react-beautiful-dnd").DraggableStateSnapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`guide-list-item${editing && editing.id === g.id ? " selected" : ""}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "0 8px",
                                  borderBottom: "1px solid #1e293b",
                                  cursor: snapshot.isDragging ? "grabbing" : "pointer",
                                  background: editing && editing.id === g.id ? "#312e81" : snapshot.isDragging ? "#3730a3" : "transparent",
                                  color: editing && editing.id === g.id ? "#f9fafb" : "#d1d5db",
                                  fontWeight: editing && editing.id === g.id ? 600 : 400,
                                  fontSize: 13,
                                  height: 24,
                                  minHeight: 0,
                                  transition: "background 0.15s",
                                  ...provided.draggableProps.style,
                                }}
                                onClick={() => handleSelectGuideItem(g)}
                                onDoubleClick={(event) => {
                                  event.preventDefault();
                                  handleSelectGuideItem(g, true);
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(g.id)}
                                  onChange={() => toggleSelect(g.id)}
                                  style={{ marginRight: 6 }}
                                  onClick={e => e.stopPropagation()}
                                />
                                {renamingId === g.id ? (
                                  <input
                                    ref={(el) => {
                                      if (renamingId === g.id) {
                                        renameInputRef.current = el;
                                      }
                                    }}
                                    value={renameDraft}
                                    onChange={(e) => setRenameDraft(e.target.value)}
                                    onKeyDown={handleRenameKeyDown}
                                    onBlur={handleRenameBlur}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      flex: 1,
                                      padding: "2px 4px",
                                      borderRadius: 6,
                                      border: "1px solid #4c1d95",
                                      background: "#1e1b4b",
                                      color: "#f9fafb",
                                      fontSize: 13,
                                    }}
                                  />
                                ) : (
                                  <span
                                    style={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      flex: 1,
                                    }}
                                  >
                                    {g.title || "(제목 없음)"}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestDeleteGuide(g.id, tab, g.title);
                                  }}
                                  style={{
                                    marginLeft: 4,
                                    border: 0,
                                    background: "transparent",
                                    color: "#f97373",
                                    cursor: "pointer",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    height: 24,
                                    lineHeight: "24px",
                                    padding: 0,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                      </>
                    )}
                    {provided.placeholder}
                    <div style={{ fontSize: 11, color: "#9ca3af", margin: "8px 0 0 0", textAlign: "left" }}>
                      순서변경이 가능합니다.
                    </div>
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {/* 우측: 편집 영역 */}
          <div
            style={{
              flex: "1 1 0%",
              minWidth: 0,
              minHeight: 0,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            >
            {editing ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                  minWidth: 0,
                  height: "100%",
                  overflow: "auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 10,
                    width: "100%",
                  }}
                >
                  {/* (1) 파일 첨부 박스 */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const items = Array.from(
                        e.dataTransfer.files || []
                      );
                      if (items.length > 0) safeAddFiles(items);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                      flex: 1,
                      border: "2px dashed #7c3aed",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 13,
                      textAlign: "center",
                      color: "#d1d5db",
                      cursor: "pointer",
                      background: "rgba(124, 58, 237, 0.08)",
                      userSelect: "none",
                    }}
                  >
                    첨부하기
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      onChange={handleFileInputChange}
                      accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.txt,.zip,.ppt,.pptx,.csv"
                    />
                  </div>
                  {/* (2) 복사 붙여넣기 박스 (Ctrl+V) */}
                  <div
                    onPaste={(e) => {
                      const items = Array.from(
                        e.clipboardData.files || []
                      );
                      if (items.length > 0) {
                        e.preventDefault();
                        safeAddFiles(items);
                      }
                    }}
                    style={{
                      flex: 1,
                      border: "2px dashed #7c3aed",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 13,
                      textAlign: "center",
                      color: "#d1d5db",
                      userSelect: "none",
                      background: "rgba(124, 58, 237, 0.05)",
                    }}
                  >
                    붙여넣기
                  </div>
                </div>
                {/* 첨부 파일 리스트 */}
                {editing.files && editing.files.length > 0 && (
                  <div
                    style={{
                      marginBottom: 8,
                      padding: 8,
                      borderRadius: 8,
                      border: "1px solid #1f2937",
                      background: "#020617",
                      maxHeight: 60,
                      overflowY: "auto",
                    }}
                  >
                    {editing.files.map((f) => (
                      <div
                        key={f.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 11,
                          padding: "2px 0",
                          borderBottom: "1px solid #0f172a",
                        }}
                      >
                        <span
                          style={{
                            maxWidth: 260,
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {f.fileName || "(파일명 없음)"} ({formatBytes(f.fileSize || 0)})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveGuideFile()}
                          style={{
                            border: 0,
                            background: "transparent",
                            color: "#f97373",
                            cursor: "pointer",
                            fontSize: 11,
                          }}
                        >
                          삭제
                        </button>
                        {/* 삭제 버튼 제거 (영구 보존) */}
                      </div>
                    ))}
                  </div>
                )}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <textarea
                    value={editing.content}
                    onChange={(e) => handleChangeContent(e.target.value)}
                    placeholder="지침/참고 내용 입력"
                    style={{
                      flex: 1,
                      minHeight: 0,
                      width: "100%",
                      borderRadius: 8,
                      border: "1px solid #1f2937",
                      padding: 10,
                      fontSize: 13,
                      background: "#020617",
                      color: "#f9fafb",
                      resize: "none",
                    }}
                  />
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "#9ca3af",
                    }}
                  >
                    {/* 안내 문구 등 필요시 추가 */}
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  color: "#9ca3af",
                  textAlign: "center",
                }}
              >
                좌측에서 지침을 선택하거나 &quot;새 지침 추가&quot; 버튼을 눌러
                편집을 시작하세요.
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽 아래 리사이즈 핸들 */}
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: "absolute",
            right: 10,
            bottom: 6,
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            fontSize: 16,
            color: "#6b7280",
            cursor: "nwse-resize",
            userSelect: "none",
          }}
          title="크기 조절"
        >
          ↘
        </div>
      </div>
    </>
  );
};

export default GuidePanel;
