import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { authLogin, authRegister, AuthTokens, AuthUser } from "./api/auth";
import {
  fetchPendingUsers,
  approveUser as apiApproveUser,
  rejectUser as apiRejectUser,
  deleteUser as apiDeleteUser,
  PendingUser,
} from "./api/admin";

import { fetchModels, requestIsoChat } from "./api/isoChatApi";

import {
  ModelOption,
  RunMode,
  AnswerMode,
  // Message,
  Conversation,
  Guide,
  AttachedFile,
} from "./types/isoChat";

import Sidebar from "./components/Sidebar";
import ChatPanel from "./components/ChatPanel";
import Rightbar from "./components/Rightbar";
import GuidePanel from "./components/GuidePanel";
import {
  fetchGlobalGuides,
  fetchRoomGuides,
  createGuide as apiCreateGuide,
  updateGuide as apiUpdateGuide,
  deleteGuide as apiDeleteGuide,
} from "./api/guides";
import { apiClient } from "./api/client";
import {
  fetchConversations,
  createConversation,
  updateConversation,
  deleteConversation as apiDeleteConversation,
  reorderConversations as apiReorderConversations,
} from "./api/conversations";
import { fetchMessages, addMessage } from "./api/messages";
import {
  presignUpload,
  uploadWithPresignedUrl,
  commitFile,
} from "./api/files";
import { GuideFile } from "./types/isoChat";

const LAST_CONV_KEY = "lastConvId";

// 모델 설명 매핑 (라벨 보강용)
const MODEL_DESCRIPTIONS: Record<string, string> = {
  "gpt-5.1": "복잡한 추론",
  "gpt-4.1": "정확도·근거 중심",
  "gpt-4.1-mini": "빠른 응답",
  "gpt-4.1-adv": "장문 병합·요약",
};

const normalizeGuideScope = (scope: string | null | undefined): "global" | "conversation" => {
  if (typeof scope !== "string") return "global";
  return scope.toLowerCase() === "conversation" ? "conversation" : "global";
};

const sortGuideFilesAsc = (files: GuideFile[]): GuideFile[] => {
  const toTimestamp = (value?: string) => {
    if (!value) return Number.POSITIVE_INFINITY;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  };
  return [...files].sort((a, b) => {
    const diff = toTimestamp(a.createdAt) - toTimestamp(b.createdAt);
    if (diff !== 0) return diff;
    return (a.fileName || "").localeCompare(b.fileName || "");
  });
};

const normalizeGuideFile = (file: any): GuideFile => {
  if (!file) {
    return {
      id: `gf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: "",
      fileSize: null,
      storageKey: undefined,
      mimeType: undefined,
      downloadUrl: undefined,
    };
  }
  return {
    id: file.id ?? `gf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fileName: file.fileName ?? "",
    fileSize:
      typeof file.fileSize === "number"
        ? file.fileSize
        : file.fileSize != null
          ? Number(file.fileSize)
          : null,
    mimeType: file.mimeType ?? undefined,
    storageKey: file.storageKey ?? undefined,
    downloadUrl: file.downloadUrl ?? file.url ?? undefined,
    createdAt: file.createdAt ?? file.created_at ?? undefined,
  };
};

const normalizeGuide = (guide: any): Guide => {
  const normalizedScope = normalizeGuideScope(guide?.scope);
  const files = Array.isArray(guide?.files)
    ? guide.files.map((file: any) => normalizeGuideFile(file))
    : [];

  return {
    ...guide,
    scope: normalizedScope,
    conversationId: guide?.conversationId ?? undefined,
    title: guide?.title ?? "",
    content: guide?.content ?? "",
    files,
    createdAt: guide?.createdAt ?? new Date().toISOString(),
    updatedAt: guide?.updatedAt ?? guide?.createdAt ?? new Date().toISOString(),
  };
};

const App: React.FC = () => {
  /* --------------------------------
   * 1. 모델 / 실행 모드 상태
   * -------------------------------- */
  const [model, setModel] = useState<ModelOption>("gpt-5.1");
  const [modelList, setModelList] = useState<{ id: string; label: string }[]>(
    []
  );
  const [runMode, setRunMode] = useState<RunMode>("responses");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("strict");

  useEffect(() => {
    fetchModels()
      .then((models) =>
        setModelList(
          models.map((m) => ({
            ...m,
            label: MODEL_DESCRIPTIONS[m.id]
              ? `${m.id} (${MODEL_DESCRIPTIONS[m.id]})`
              : m.label || m.id,
          }))
        )
      )
      .catch(() => {
        setModelList([
          { id: "gpt-5.1", label: "gpt-5.1 (복잡한 추론)" },
          { id: "gpt-4.1", label: "gpt-4.1 (정확도·근거 중심)" },
          { id: "gpt-4.1-mini", label: "gpt-4.1-mini (빠른 응답)" },
          { id: "gpt-4.1-adv", label: "gpt-4.1-adv (장문 병합·요약)" },
        ]);
      });
  }, []);

  /* --------------------------------
   * 2. 대화방 / 메시지 상태
   * -------------------------------- */
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);


  // 인증 상태
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem("authUser");
    return saved ? JSON.parse(saved) : null;
  });
  const [authTokens, setAuthTokens] = useState<AuthTokens | null>(() => {
    const saved = localStorage.getItem("authTokens");
    return saved ? JSON.parse(saved) : null;
  });
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [pendingActionIds, setPendingActionIds] = useState<string[]>([]);
  const [pendingUiState, setPendingUiState] = useState<Record<string, "default" | "approved" | "hold">>({});
  const isSuperAdmin = authUser?.role === "SUPER_ADMIN";

  // 인증 정보 로컬 저장
  useEffect(() => {
    if (authUser) {
      localStorage.setItem("authUser", JSON.stringify(authUser));
    } else {
      localStorage.removeItem("authUser");
    }
  }, [authUser]);

  useEffect(() => {
    if (authTokens) {
      localStorage.setItem("authTokens", JSON.stringify(authTokens));
    } else {
      localStorage.removeItem("authTokens");
    }
    // axios 기본 Authorization 헤더 설정/해제
    if (authTokens?.access) {
      apiClient.defaults.headers.common["Authorization"] =
        `Bearer ${authTokens.access}`;
      try {
        const payload = JSON.parse(atob(authTokens.access.split(".")[1] || ""));
        setAuthUser((prev) => ({
          id: payload.uid || prev?.id || "",
          email: payload.email || prev?.email || "",
          role: payload.role || prev?.role,
          status: prev?.status,
          totpEnabled: prev?.totpEnabled,
        }));
      } catch (decodeError) {
        console.warn("Unable to decode access token", decodeError);
      }
    } else {
      delete apiClient.defaults.headers.common["Authorization"];
    }
  }, [authTokens]);

  const loadPendingUsers = useCallback(async () => {
    if (!authTokens?.access || !isSuperAdmin) {
      setPendingUsers([]);
      setPendingUiState({});
      return;
    }
    setPendingLoading(true);
    setPendingError(null);
    try {
      const list = await fetchPendingUsers(authTokens.access);
      const sorted = [...list].sort((a, b) => {
        const aSuper = a.role === "SUPER_ADMIN";
        const bSuper = b.role === "SUPER_ADMIN";
        if (aSuper && !bSuper) return -1;
        if (!aSuper && bSuper) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setPendingUsers(sorted);
      setPendingUiState((prev) => {
        const next: Record<string, "default" | "approved" | "hold"> = {};
        sorted.forEach((user) => {
          const prevState = prev[user.id];
          if (prevState === "approved") {
            next[user.id] = "approved";
            return;
          }
          if (user.status === "REJECTED") {
            next[user.id] = "hold";
            return;
          }
          next[user.id] = "default";
        });
        return next;
      });
    } catch (e: any) {
      setPendingError(e?.message || "승인 대기 목록을 불러오지 못했습니다.");
    } finally {
      setPendingLoading(false);
    }
  }, [authTokens?.access, isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setPendingUsers([]);
      setPendingError(null);
      setPendingLoading(false);
      setPendingUiState({});
      return;
    }
    loadPendingUsers();
  }, [isSuperAdmin, loadPendingUsers]);

  const togglePendingAction = useCallback((id: string, active: boolean) => {
    setPendingActionIds((prev) => {
      if (active) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  }, []);

  const handleApprovePendingUser = useCallback(
    async (id: string) => {
      if (!authTokens?.access) return;
      togglePendingAction(id, true);
      setPendingError(null);
      try {
        await apiApproveUser(authTokens.access, id);
        setPendingUsers((prev) =>
          prev.map((user) =>
            user.id === id ? { ...user, status: "APPROVED" } : user
          )
        );
        setPendingUiState((prev) => ({ ...prev, [id]: "approved" }));
      } catch (e: any) {
        setPendingError(e?.message || "사용자 승인을 처리하지 못했습니다.");
      } finally {
        togglePendingAction(id, false);
      }
    },
    [authTokens?.access, togglePendingAction]
  );

  const handleHoldPendingUser = useCallback(
    async (id: string) => {
      if (!authTokens?.access) return;
      togglePendingAction(id, true);
      setPendingError(null);
      try {
        await apiRejectUser(authTokens.access, id);
        setPendingUsers((prev) =>
          prev.map((user) =>
            user.id === id ? { ...user, status: "REJECTED" } : user
          )
        );
        setPendingUiState((prev) => ({ ...prev, [id]: "hold" }));
      } catch (e: any) {
        setPendingError(e?.message || "사용자 거부를 처리하지 못했습니다.");
      } finally {
        togglePendingAction(id, false);
      }
    },
    [authTokens?.access, togglePendingAction]
  );

  const handleDeletePendingUser = useCallback(
    async (id: string) => {
      if (!authTokens?.access) return;
      togglePendingAction(id, true);
      setPendingError(null);
      try {
        await apiDeleteUser(authTokens.access, id);
        setPendingUsers((prev) => prev.filter((user) => user.id !== id));
        setPendingUiState((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } catch (e: any) {
        setPendingError(e?.message || "사용자 삭제를 처리하지 못했습니다.");
      } finally {
        togglePendingAction(id, false);
      }
    },
    [authTokens?.access, togglePendingAction]
  );
  // 인증 상태에 따라 서버에서 대화 목록 로드
  useEffect(() => {
    if (!authTokens?.access) {
      setConversations([]);
      setActiveConversationId(null);
      localStorage.removeItem(LAST_CONV_KEY);
      return;
    }
    fetchConversations()
      .then((list) => {
        if (list.length === 0) {
          // 서버에 대화가 없으면 하나 생성
          createConversation("새 테마")
            .then((c) => {
              setConversations([c]);
              setActiveConversationId(c.id);
              localStorage.setItem(LAST_CONV_KEY, c.id);
            })
            .catch((e) => console.error("create default conversation error:", e));
          return;
        }
        setConversations(list);
        setActiveConversationId((prev) => {
          const saved = localStorage.getItem(LAST_CONV_KEY);
          const fallback =
            (saved && list.find((c) => c.id === saved)?.id) ||
            (prev && list.find((c) => c.id === prev)?.id) ||
            list[0]?.id ||
            null;
          if (fallback) {
            localStorage.setItem(LAST_CONV_KEY, fallback);
          }
          return fallback;
        });
      })
      .catch((e) => console.error("fetchConversations error:", e));
  }, [authTokens?.access]);

  const activeConversation: Conversation | null =
    conversations.find((c) => c.id === activeConversationId) || null;

  const handleNewConversation = () => {
    if (!authTokens?.access) {
      setError("로그인 해주세요.");
      loginEmailRef.current?.focus();
      return;
    }
    createConversation("새 테마")
      .then((conv) => {
        setConversations((prev) => {
          const next = [conv, ...prev];
          return next;
        });
        setActiveConversationId(conv.id);
        localStorage.setItem(LAST_CONV_KEY, conv.id);
      })
      .catch((e) => {
        setError(e?.message || "테마 생성에 실패했습니다.");
      });
  };

  const handleDeleteConversation = (id: string) => {
    if (!authTokens?.access) {
      setError("로그인 해주세요.");
      loginEmailRef.current?.focus();
      return;
    }
    apiDeleteConversation(id)
      .then(() => {
        setConversations((prev) => {
          const filtered = prev.filter((c) => c.id !== id);
          if (id === activeConversationId) {
            const nextId = filtered[0]?.id ?? null;
            setActiveConversationId(nextId);
            if (nextId) localStorage.setItem(LAST_CONV_KEY, nextId);
            else localStorage.removeItem(LAST_CONV_KEY);
          }
          return filtered;
        });
      })
      .catch((e) => setError(e?.message || "테마 삭제에 실패했습니다."));
  };

  /* --------------------------------
   * 3. 테마 제목 인라인 수정
   * -------------------------------- */
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const loginEmailRef = useRef<HTMLInputElement | null>(null);

  const handleEditTitleStart = (conv: Conversation) => {
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleEditTitleSave = (id: string) => {
    const newTitle = editingTitle.trim();
    if (!newTitle) {
      setEditingConvId(null);
      setEditingTitle("");
      return;
    }
    updateConversation(id, { title: newTitle })
      .then((updated) => {
        setConversations((prev) => {
          const next = prev.map((c: Conversation) =>
            c.id === id
              ? {
                  ...c,
                  title: updated.title,
                }
              : c
          );
          return next;
        });
        setEditingConvId(null);
        setEditingTitle("");
      })
      .catch((e) => setError(e?.message || "테마 제목 변경에 실패했습니다."));
  };

  /* --------------------------------
   * 4. 지침 / 가이드 상태
   * -------------------------------- */
  const [globalGuides, setGlobalGuides] = useState<Guide[]>([]);
  const [conversationGuides, setConversationGuides] = useState<
    Record<string, Guide[]>
  >({});
  const [isGuidePanelOpen, setIsGuidePanelOpen] = useState(false);

  const activeConvGuides: Guide[] = activeConversationId
    ? conversationGuides[activeConversationId] || []
    : [];

  // 지침 재로드 유틸
  const reloadGlobalGuides = () =>
    fetchGlobalGuides()
      .then((guides) => setGlobalGuides(guides.map((g) => normalizeGuide(g))))
      .catch((e) => console.error("reloadGlobalGuides error:", e));

  const reloadRoomGuides = (convId: string) =>
    fetchRoomGuides(convId)
      .then((guides) =>
        setConversationGuides((prev) => ({
          ...prev,
          [convId]: guides.map((g) => normalizeGuide(g)),
        }))
      )
      .catch((e) => console.error("reloadRoomGuides error:", e));

  // 가이드 패널 열림 상태 로컬 저장/복원
  useEffect(() => {
    const saved = localStorage.getItem("guidePanelOpen");
    if (saved === "true") {
      setIsGuidePanelOpen(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("guidePanelOpen", isGuidePanelOpen ? "true" : "false");
  }, [isGuidePanelOpen]);

  // 지침 로드
  useEffect(() => {
    if (!authTokens?.access) {
      setGlobalGuides([]);
      setConversationGuides({});
      return;
    }
    fetchGlobalGuides()
      .then((guides) => setGlobalGuides(guides.map((g) => normalizeGuide(g))))
      .catch((e) => console.error("fetchGlobalGuides error:", e));
  }, [authTokens?.access]);

  useEffect(() => {
    if (!authTokens?.access || !activeConversationId) return;
    // 메시지 로드
    fetchMessages(activeConversationId)
      .then((msgs) =>
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId ? { ...c, messages: msgs } : c
          )
        )
      )
      .catch((e) => console.error("fetchMessages error:", e));
    fetchRoomGuides(activeConversationId)
      .then((guides) =>
        setConversationGuides((prev) => ({
          ...prev,
          [activeConversationId]: guides.map((g) => normalizeGuide(g)),
        }))
      )
      .catch((e) => console.error("fetchRoomGuides error:", e));
  }, [authTokens?.access, activeConversationId]);

  const handleCreateGuide = async (scope: "global" | "conversation") => {
    if (!authTokens?.access) {
      setError("로그인 해주세요.");
      loginEmailRef.current?.focus();
      return;
    }
    try {
      const defaultTitle = "새 지침";
      const defaultContent = "";
      const createdRaw = await apiCreateGuide(scope, {
        title: defaultTitle,
        content: defaultContent,
        conversationId: scope === "conversation" ? activeConversationId || undefined : undefined,
      });
      const created = normalizeGuide(createdRaw);
      if (scope === "global") {
        setGlobalGuides((prev) => [created, ...prev]);
        reloadGlobalGuides();
      } else if (activeConversationId) {
        setConversationGuides((prev) => ({
          ...prev,
          [activeConversationId]: [created, ...(prev[activeConversationId] || [])],
        }));
        reloadRoomGuides(activeConversationId);
      }
    } catch (e: any) {
      setError(e?.message || "지침 생성에 실패했습니다.");
    }
  };

  const handleUpdateGuide = async (guide: Guide) => {
    if (!authTokens?.access) {
      setError("로그인 해주세요.");
      loginEmailRef.current?.focus();
      return;
    }
    try {
      const scopeForRequest = normalizeGuideScope(guide.scope);
      // 1) 파일 메타 준비: 기존 파일 + 새로 추가된 파일 업로드
      const filesPayload: GuideFile[] = [];
      const files = guide.files || [];
      const conversationIdForGuide =
        scopeForRequest === "conversation"
          ? guide.conversationId || activeConversationId || undefined
          : undefined;
      if (scopeForRequest === "conversation" && !conversationIdForGuide) {
        throw new Error("conversationId is required for conversation guide");
      }

      // 기존 파일(이미 storageKey 있음)
      for (const f of files) {
        if (f.storageKey) {
          filesPayload.push({
            id: f.id,
            fileName: f.fileName,
            fileSize: f.fileSize ?? null,
            mimeType: f.mimeType,
            storageKey: f.storageKey,
            downloadUrl: f.downloadUrl,
          });
        }
      }

      // 새 파일 업로드 후 commit
      for (const f of files) {
        if (!f.storageKey && f.file) {
          const { uploadUrl, objectKey } = await presignUpload({
            engine: "iso",
            type: "guide",
            ownerId: guide.id,
            filename: f.fileName || f.file?.name || "unnamed",
          });
          await uploadWithPresignedUrl(
            uploadUrl,
            f.file,
            f.file.type || f.mimeType || "application/octet-stream"
          );
          const commitResult = await commitFile({
            engine: "iso",
            type: "guide",
            ownerId: guide.id,
            originalName: f.fileName || f.file.name,
            objectKey,
            mimetype: f.file.type || f.mimeType || null,
            size: f.file.size,
          });
          const committedMeta: any = commitResult?.file ?? commitResult?.attachment ?? null;
          const resolvedStorageKey = committedMeta?.storageKey || objectKey;
          const resolvedFileSize =
            typeof committedMeta?.fileSize === "number"
              ? committedMeta.fileSize
              : committedMeta?.fileSize != null
              ? Number(committedMeta.fileSize)
              : f.file.size;
          const committedFile: GuideFile = {
            id: committedMeta?.id || f.id,
            fileName:
              committedMeta?.fileName || f.fileName || f.file.name,
            fileSize: resolvedFileSize ?? null,
            mimeType:
              committedMeta?.mimeType || f.file.type || f.mimeType || null,
            storageKey: resolvedStorageKey,
            downloadUrl: committedMeta?.downloadUrl,
          };
          filesPayload.push(committedFile);
          f.id = committedFile.id;
          f.fileName = committedFile.fileName;
          f.fileSize = committedFile.fileSize ?? null;
          f.mimeType = committedFile.mimeType ?? undefined;
          f.storageKey = committedFile.storageKey;
          f.downloadUrl = committedFile.downloadUrl;
          f.file = undefined;
        }
      }

      const uniquePayload = filesPayload.reduce<GuideFile[]>((acc, item) => {
        const key = item.storageKey || `${item.fileName || ""}::${item.fileSize ?? ""}`;
        if (key && acc.some((f) => (f.storageKey || `${f.fileName || ""}::${f.fileSize ?? ""}`) === key)) {
          return acc;
        }
        acc.push(item);
        return acc;
      }, []);

      const updatePayload: {
        title: string;
        content: string;
        conversationId?: string;
        files?: GuideFile[];
      } = {
        title: guide.title,
        content: guide.content,
        conversationId: conversationIdForGuide,
      };
      if (uniquePayload.length > 0) {
        updatePayload.files = uniquePayload;
      }

      const updatedRaw = await apiUpdateGuide(scopeForRequest, guide.id, updatePayload);
      const updated = normalizeGuide(updatedRaw);
      if (scopeForRequest === "global") {
        setGlobalGuides((prev) =>
          prev.map((g) => (g.id === updated.id ? updated : g))
        );
        return updated;
      }
      const convId = guide.conversationId;
      if (!convId && !conversationIdForGuide) return updated;
      const targetConvId = convId || conversationIdForGuide;
      setConversationGuides((prev) => {
        const list: Guide[] = targetConvId ? prev[targetConvId] || [] : [];
        const idx = list.findIndex((g) => g.id === updated.id);
        if (idx === -1) {
          return {
            ...prev,
            ...(targetConvId
              ? {
                  [targetConvId]: [updated, ...list],
                }
              : {}),
          };
        }
        return {
          ...prev,
          ...(targetConvId
            ? {
                [targetConvId]: list.map((g) =>
                  g.id === updated.id ? updated : g
                ),
              }
            : {}),
        };
      });
      return updated;
    } catch (e: any) {
      setError(e?.message || "지침 저장에 실패했습니다.");
      return;
    }
  };

  const handleDeleteGuide = async (
    id: string,
    scope: "global" | "conversation"
  ) => {
    if (!authTokens?.access) {
      setError("로그인 해주세요.");
      loginEmailRef.current?.focus();
      return;
    }
    try {
      const convId = scope === "conversation" ? activeConversationId : undefined;
      await apiDeleteGuide(scope, id, convId || undefined);
      if (scope === "global") {
        setGlobalGuides((prev) => prev.filter((g: Guide) => g.id !== id));
        reloadGlobalGuides();
      } else if (convId) {
        setConversationGuides((prev) => {
          const list: Guide[] = prev[convId] || [];
          return {
            ...prev,
            [convId]: list.filter((g: Guide) => g.id !== id),
          };
        });
        reloadRoomGuides(convId);
      }
    } catch (e: any) {
      setError(e?.message || "지침 삭제에 실패했습니다.");
    }
  };

  /* --------------------------------
   * 5. 첨부 파일 상태
   * -------------------------------- */
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: File[]) => {
    if (!authTokens?.access) {
      setError("로그인 해주세요.");
      loginEmailRef.current?.focus();
      return;
    }
    if (!files.length) return;
    setAttachedFiles((prev) => [
      ...prev,
      ...files.map<AttachedFile>((file) => ({
        id: `af-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        file,
      })),
    ]);
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files || []));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));

    e.target.value = "";
  };

  const handleRemoveAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // 인증 핸들러
  const handleLogin = async (email: string, password: string, otp?: string) => {
    try {
      setAuthStatus("로그인 중...");
      const res = await authLogin(email, password, otp);
      setAuthUser(res.user);
      setAuthTokens(res.tokens);
      setAuthStatus("로그인 완료");
    } catch (e: any) {
      setAuthStatus(e?.message || "로그인 실패");
    }
  };

  const handleRegister = async (email: string, password: string) => {
    try {
      setAuthStatus("회원가입 중...");
      const res = await authRegister(email, password);
      const message =
        res.message || "계정이 생성되었습니다. 관리자 승인 대기 중입니다.";
      setAuthStatus(message);
    } catch (e: any) {
      setAuthStatus(e?.message || "회원가입 실패");
    }
  };

  const handleLogout = () => {
    setAuthUser(null);
    setAuthTokens(null);
    setAuthStatus("로그아웃됨");
    localStorage.removeItem(LAST_CONV_KEY);
    setPendingUsers([]);
    setPendingActionIds([]);
    setPendingError(null);
    setPendingLoading(false);
    setPendingUiState({});
  };

  /* --------------------------------
   * 6.5. 우측 패널 표시용 첨부/지침 요약
   * -------------------------------- */
  const selectGuideFilesForPanel = (guides: Guide[]) =>
    sortGuideFilesAsc(guides.flatMap((g) => g.files || [])).map((f) => ({
      id: f.id || f.storageKey || f.fileName,
      fileName: f.fileName || "(파일)",
      downloadUrl: f.downloadUrl,
    }));

  const commonGuideFiles = selectGuideFilesForPanel(globalGuides);

  const roomGuideFiles = selectGuideFilesForPanel(activeConvGuides);

  const messageAttachments = (activeConversation?.messages || [])
    .flatMap((m) => m.attachments || [])
    .map((a) => ({
      id: a.id || a.storageKey || a.fileName,
      fileName: a.fileName || "(파일)",
      downloadUrl: a.downloadUrl,
    }));

  /* --------------------------------
   * 6. 입력 / 전송 / 에러 상태
   * -------------------------------- */
  const [input, setInput] = useState("");
  const [lastSentInput, setLastSentInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);

  const handleSubmit = async (
    e?: React.FormEvent,
    forceContent?: string
  ) => {
    if (e) e.preventDefault();
    if (!authTokens?.access) {
      setError("로그인 해주세요.");
      loginEmailRef.current?.focus();
      return;
    }
    if (!activeConversationId) return;

    const trimmed =
      forceContent !== undefined ? forceContent.trim() : input.trim();
    const hasText = trimmed.length > 0;
    if (!hasText && attachedFiles.length === 0) return;
    const messageContent = hasText ? trimmed : "(첨부 전송)";

    const currentConv = conversations.find((c) => c.id === activeConversationId);
    if (!currentConv) return;

    setLastSentInput(hasText ? trimmed : "");
    setInput("");
    setLoading(true);
    setError(null);

    try {
      // 1) 서버에 사용자 메시지 생성 (DB에 저장되어야 첨부파일 ownerId 사용 가능)
      const createdUserMsg = await addMessage(
        activeConversationId,
        "user",
        messageContent
      );

      // 2) 첨부파일 업로드 + 커밋(메타 DB 저장)
      if (attachedFiles.length > 0 && createdUserMsg?.id) {
        for (const f of attachedFiles) {
          const { uploadUrl, objectKey } = await presignUpload({
            engine: "iso",
            type: "message",
            ownerId: createdUserMsg.id,
            filename: f.name,
          });
          await uploadWithPresignedUrl(uploadUrl, f.file, f.file.type);
          await commitFile({
            engine: "iso",
            type: "message",
            ownerId: createdUserMsg.id,
            originalName: f.name,
            objectKey,
            mimetype: f.file.type,
            size: f.file.size,
          });
        }
      }

      setAttachedFiles([]); // 첨부 초기화

      // 3) ISO 챗 호출 (서버에 저장된 메시지 배열 사용)
      // 메시지 목록은 서버에서 최신화된 후 assistant 메시지까지 포함하여 최종 fetch 1회만 수행
      const finalMsgs = await fetchMessages(activeConversationId);

      // ISO 챗 호출
      const payload = {
        message: messageContent,
        model,
        runMode,
        answerMode,
        messages: finalMsgs.map((m) => ({ role: m.role, content: m.content })),
        globalGuides: globalGuides.map((g: Guide) => ({
          id: g.id,
          title: g.title,
          content: g.content,
        })),
        convGuides: activeConvGuides.map((g: Guide) => ({
          id: g.id,
          title: g.title,
          content: g.content,
        })),
        accessToken: authTokens?.access,
      };

      const res = await requestIsoChat(payload);
      const assistantText: string =
        typeof res?.reply === "string"
          ? res.reply
          : res?.reply?.content || res?.content || "";
      // 서버에 어시스턴트 메시지 저장(실제 답변으로 업데이트)
      await addMessage(activeConversationId, "assistant", assistantText && assistantText.trim().length > 0
        ? assistantText
        : "유효한 정보를 찾지 못했습니다. 추가 기초 정보를 제공해 주시면 더 정확한 답변을 드리겠습니다.");

      // 최종 메시지 목록을 다시 동기화
      const syncedMsgs = await fetchMessages(activeConversationId);
      setConversations((prev) =>
        prev.map((c: Conversation) =>
          c.id === activeConversationId ? { ...c, messages: syncedMsgs } : c
        )
      );
    } catch (err: any) {
      console.error(err);
      let msg =
        err?.message ||
        "ISO Expert 서버 호출 중 오류가 발생했습니다. 서버 로그를 확인해 주세요.";
      // JSON 문자열이면 error 필드를 추출
      try {
        const parsed = typeof msg === "string" && msg.trim().startsWith("{")
          ? JSON.parse(msg)
          : null;
        if (parsed?.error) msg = parsed.error;
      } catch (e) {
        /* ignore JSON parse errors */
      }

      if (msg.toLowerCase().includes("auth required") || msg.includes("401")) {
        setError("로그인 해주세요.");
        loginEmailRef.current?.focus();
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------
   * 7. 렌더링: 조립만 담당
   * -------------------------------- */
  return (
    <div className="iso-app-root">
      {/* 좌측: 테마/대화 리스트 (Sidebar 컴포넌트) */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId || ""}
        onNewConversation={handleNewConversation}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          localStorage.setItem(LAST_CONV_KEY, id);
        }}
        onDeleteConversation={handleDeleteConversation}
        editingConvId={editingConvId}
        editingTitle={editingTitle}
        onEditTitleStart={handleEditTitleStart}
        onEditTitleSave={handleEditTitleSave}
        setEditingTitle={setEditingTitle}
        onOpenGuidePanel={() => setIsGuidePanelOpen(true)}
        setEditingConvId={setEditingConvId}
        isAuthed={!!authTokens?.access}
        onReorderConversations={(from, to) => {
          setConversations((prev) => {
            const arr = [...prev];
            const [removed] = arr.splice(from, 1);
            arr.splice(to, 0, removed);
            void apiReorderConversations(arr.map((c) => c.id));
            return arr;
          });
        }}
      />

      {/* 중앙: 채팅 패널 */}
      <ChatPanel
        activeConversation={activeConversation}
        attachedFiles={attachedFiles}
        input={input}
        lastSentInput={lastSentInput}
        loading={loading}
        error={error}
        onChangeInput={setInput}
        onSubmit={handleSubmit}
        onDrop={handleDrop}
        onFilesAdded={addFiles}
        onRemoveAttachedFile={handleRemoveAttachedFile}
        fileInputRef={fileInputRef}
        onFileInputChange={handleFileInputChange}
      />

      {/* 우측: 설정/상태 패널 */}
      <Rightbar
        model={model}
        setModel={(v) => setModel(v as ModelOption)}
        modelList={modelList}
        runMode={runMode}
        setRunMode={(v) => setRunMode(v as RunMode)}
        answerMode={answerMode}
        setAnswerMode={(v) => setAnswerMode(v as AnswerMode)}
        attachedFiles={attachedFiles}
        activeConversationId={activeConversationId}
        commonGuideFiles={commonGuideFiles}
        roomGuideFiles={roomGuideFiles}
        messageAttachments={messageAttachments}
        onRemoveFile={handleRemoveAttachedFile}
        authUser={authUser}
        authStatus={authStatus}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onLogout={handleLogout}
        loginInputRef={loginEmailRef}
        pendingUsers={pendingUsers}
        pendingLoading={pendingLoading}
        pendingError={pendingError}
        pendingActionIds={pendingActionIds}
        pendingUiState={pendingUiState}
        onReloadPending={loadPendingUsers}
        onApprovePendingUser={handleApprovePendingUser}
        onHoldPendingUser={handleHoldPendingUser}
        onDeletePendingUser={handleDeletePendingUser}
      />

      {/* 플로팅 지침/가이드 패널 (GuidePanel.tsx는 기존 버전 유지) */}
      <GuidePanel
        isOpen={isGuidePanelOpen}
        onClose={() => setIsGuidePanelOpen(false)}
        globalGuides={globalGuides}
        conversationGuides={activeConvGuides}
        activeConversationId={activeConversationId}
        onCreateGuide={handleCreateGuide}
        onUpdateGuide={handleUpdateGuide}
        onDeleteGuide={handleDeleteGuide}
        onReloadGlobalGuides={reloadGlobalGuides}
        onReloadRoomGuides={(cid) => {
          const targetId = cid || activeConversationId;
          if (targetId) reloadRoomGuides(targetId);
        }}
      />
    </div>
  );
};

export default App;
