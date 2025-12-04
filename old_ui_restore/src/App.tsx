import React, { useEffect, useRef, useState } from "react";
import "./App.css";

// ===== API ENDPOINT BASE URL =====
// 운영: https://uconcreative.ddns.net/api/...
// (Caddy에서 /api/* → 127.0.0.1:4400 으로 프록시)
const API_BASE = "/api";

type ModelOption = string;
type RunMode = "chat" | "responses";
type AnswerMode = "strict" | "aggressive";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
};

type GuideFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  createdAt: string;
};

type Guide = {
  id: string;
  scope: "global" | "conversation";
  conversationId?: string;
  title: string;
  content: string;
  files: GuideFile[];
  createdAt: string;
  updatedAt: string;
};

type AttachedFile = {
  id: string;
  name: string;
  file: File;
};

const ClipIcon: React.FC = () => (
  <span style={{ fontSize: 16, display: "inline-flex", alignItems: "center" }}>
    📎
  </span>
);

// =====================================
// GuidePanel 타입 정의
// =====================================
type GuidePanelProps = {
  isOpen: boolean;
  onClose: () => void;
  globalGuides: Guide[];
  conversationGuides: Guide[];
  activeConversationId: string | null;
  onCreateGuide: (scope: "global" | "conversation") => void;
  onUpdateGuide: (guide: Guide) => void;
  onDeleteGuide: (id: string, scope: "global" | "conversation") => void;
  setGlobalGuides: React.Dispatch<React.SetStateAction<Guide[]>>;
  setConversationGuides: React.Dispatch<React.SetStateAction<Record<string, Guide[]>>>;
};

// =====================================
// GuidePanel 컴포넌트
// =====================================
const GuidePanel: React.FC<GuidePanelProps> = ({
  isOpen,
  onClose,
  globalGuides,
  conversationGuides,
  activeConversationId,
  onCreateGuide,
  onUpdateGuide,
  onDeleteGuide,
  setGlobalGuides,
  setConversationGuides,
}) => {
  const [tab, setTab] = useState<"global" | "conversation">("global");
  const [editing, setEditing] = useState<Guide | null>(null);

  // 드래그 이동용 상태
  const [pos, setPos] = useState<{ x: number; y: number }>({
    x: window.innerWidth / 2 - 360,
    y: window.innerHeight / 2 - 320,
  });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  // 리사이즈 상태
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 720, height: 640 });
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  // 리사이즈 핸들러
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
  };

  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStart.current) return;
      const dx = e.clientX - resizeStart.current.x;
      const dy = e.clientY - resizeStart.current.y;
      setSize(() => {
        let newWidth = Math.max(400, Math.min(resizeStart.current!.width + dx, window.innerWidth * 0.9));
        let newHeight = Math.max(300, Math.min(resizeStart.current!.height + dy, window.innerHeight * 0.8));
        return { width: newWidth, height: newHeight };
      });
    };
    const handleMouseUp = () => {
      setResizing(false);
      // 리사이즈 종료 후, 패널 위치를 새 size에 맞게 보정
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;
      setPos((pos) => ({
        x: Math.max(0, Math.min(pos.x, maxX)),
        y: Math.max(0, Math.min(pos.y, maxY)),
      }));
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  useEffect(() => {
    setEditing(null);
  }, [tab, activeConversationId]);

  // 항상 배열만 다루도록 수정
  const currentList = tab === "global" ? globalGuides : conversationGuides;

  // 드래그앤드롭 상태
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // 순서 변경 함수 (드래그 후 상태 초기화 및 강제 리렌더)
  const moveGuide = (from: number, to: number) => {
    if (from === to) return;
    const list = Array.isArray(currentList) ? [...currentList] : [];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    if (tab === "global") {
      onUpdateGuideOrder(list, "global");
    } else {
      onUpdateGuideOrder(list, "conversation");
    }
    setDragIndex(null);
    setHoverIndex(null);
  };

  // Guide 순서 변경 핸들러(부모에서 내려줌)
  const onUpdateGuideOrder = (newList: Guide[], scope: "global" | "conversation") => {
    if (scope === "global") {
      setGlobalGuides(newList);
    } else if (scope === "conversation" && activeConversationId) {
      setConversationGuides((prev: Record<string, Guide[]>) => ({
        ...prev,
        [activeConversationId]: newList,
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    setDragging(true);
    setOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;
      setPos({
        x: Math.max(0, Math.min(maxX, e.clientX - offset.x)),
        y: Math.max(0, Math.min(maxY, e.clientY - offset.y)),
      });
    };
    const handleMouseUp = () => setDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, offset]);

  useEffect(() => {
    setPos((pos) => ({
      x: Math.min(pos.x, window.innerWidth - size.width),
      y: Math.min(pos.y, window.innerHeight - size.height),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  if (!isOpen) return null;

  const handleChangeTitle = (value: string) => {
    if (!editing) return;
    const updated: Guide = {
      ...editing,
      title: value,
      updatedAt: new Date().toISOString(),
    };
    setEditing(updated);
    onUpdateGuide(updated);
  };

  const handleChangeContent = (value: string) => {
    if (!editing) return;
    const updated: Guide = {
      ...editing,
      content: value,
      updatedAt: new Date().toISOString(),
    };
    setEditing(updated);
    onUpdateGuide(updated);
  };

  const handleDelete = (guideId: string) => {
    const scope: "global" | "conversation" = tab;
    if (!window.confirm("이 지침을 삭제하시겠습니까?")) return;
    onDeleteGuide(guideId, scope);
    if (editing?.id === guideId) {
      setEditing(null);
    }
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0,0,0,0.4)",
        }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          zIndex: 1001,
          background: "#111827",
          width: size.width,
          height: size.height,
          maxWidth: window.innerWidth * 0.9,
          maxHeight: window.innerHeight * 0.8,
          minWidth: 400,
          minHeight: 300,
          borderRadius: 16,
          padding: 24,
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          cursor: dragging ? "grabbing" : undefined,
          userSelect: dragging ? "none" : undefined,
          boxSizing: "border-box",
        }}
      >
                {/* 리사이즈 핸들 */}
                <div
                  onMouseDown={handleResizeMouseDown}
                  style={{
                    position: "absolute",
                    right: 4,
                    bottom: 4,
                    width: 24,
                    height: 24,
                    cursor: "nwse-resize",
                    zIndex: 10,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "flex-end",
                    userSelect: "none",
                    color: "#aaa",
                  }}
                  title="크기 조절"
                >
                  <span style={{ fontSize: 20, pointerEvents: "none" }}>↘</span>
                </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
            userSelect: "none",
            position: "relative",
            gap: 8,
          }}
        >
          {/* 드래그 핸들 */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
              marginRight: 8,
              borderRadius: 8,
              transition: "background 0.15s",
              userSelect: "none",
            }}
            title="패널 이동"
            tabIndex={0}
            aria-label="패널 이동 드래그 핸들"
          >
            {/* Grip dots icon */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="5" cy="5" r="1.5" fill="#aaa" />
              <circle cx="5" cy="9" r="1.5" fill="#aaa" />
              <circle cx="5" cy="13" r="1.5" fill="#aaa" />
              <circle cx="13" cy="5" r="1.5" fill="#aaa" />
              <circle cx="13" cy="9" r="1.5" fill="#aaa" />
              <circle cx="13" cy="13" r="1.5" fill="#aaa" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>지침 / 가이드 관리</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
              프로젝트 공통 지침과 대화방별 지침을 구분해서 관리합니다.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              background: "#1f2937",
              color: "#fff",
              border: 0,
              borderRadius: "50%",
              width: 28,
              height: 28,
              fontWeight: 700,
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
              zIndex: 2,
              lineHeight: 1,
              padding: 0,
              transition: "background 0.15s",
            }}
            aria-label="닫기"
          >
            X
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => setTab("global")}
            style={{
              flex: 1,
              border: 0,
              borderRadius: 999,
              padding: "6px 10px",
              background: tab === "global" ? "#7c3aed" : "#1f2937",
              color: tab === "global" ? "#fff" : "#9ca3af",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            프로젝트 공통 지침
          </button>
          <button
            onClick={() => setTab("conversation")}
            style={{
              flex: 1,
              border: 0,
              borderRadius: 999,
              padding: "6px 10px",
              background: tab === "conversation" ? "#7c3aed" : "#1f2937",
              color: tab === "conversation" ? "#fff" : "#9ca3af",
              fontSize: 12,
              cursor: activeConversationId ? "pointer" : "not-allowed",
              opacity: activeConversationId ? 1 : 0.5,
            }}
            disabled={!activeConversationId}
          >
            테마방 지침
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            gap: 16,
            minHeight: 260,
            minWidth: 0,
          }}
        >
          <div
            style={{
              flex: "0 0 260px",
              maxWidth: 300,
              minWidth: 220,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <button
              onClick={() => onCreateGuide(tab)}
              style={{
                alignSelf: "flex-start",
                marginBottom: 8,
                border: 0,
                borderRadius: 8,
                padding: "4px 10px",
                background: "#7c3aed",
                color: "#fff",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              + 새 지침 추가
            </button>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                borderRadius: 8,
                border: "1px solid #1f2937",
                padding: 4,
              }}
            >
              {currentList.length === 0 ? (
                <div style={{ fontSize: 12, color: "#9ca3af", padding: 8 }}>
                  아직 등록된 지침이 없습니다.
                </div>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    fontSize: 12,
                  }}
                >
                  {currentList.map((g, idx) => (
                    <li
                      key={g.id}
                      draggable
                      onDragStart={() => setDragIndex(idx)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setHoverIndex(idx);
                      }}
                      onDrop={() => {
                        if (dragIndex !== null && dragIndex !== idx) {
                          moveGuide(dragIndex, idx);
                        } else {
                          setDragIndex(null);
                          setHoverIndex(null);
                        }
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setHoverIndex(null);
                      }}
                      style={{
                        padding: 6,
                        borderRadius: 6,
                        marginBottom: 4,
                        cursor: "pointer",
                        background:
                          editing?.id === g.id
                            ? "#1f2937"
                            : hoverIndex === idx && dragIndex !== null
                            ? "#312e81"
                            : "transparent",
                        boxShadow:
                          dragIndex === idx
                            ? "0 0 0 2px #7c3aed, 0 4px 16px rgba(124,58,237,0.10)"
                            : undefined,
                        opacity: dragIndex === idx ? 0.7 : 1,
                        transition: "background 0.15s, box-shadow 0.15s, opacity 0.15s",
                      }}
                      onClick={() => setEditing(g)}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {g.title || "(제목 없음)"}
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          color: "#9ca3af",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                        }}
                      >
                        {(g.content || "내용 없음")
                          .replace(/\s+/g, " ")
                          .slice(0, 80)}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(g.id);
                        }}
                        style={{
                          marginTop: 4,
                          border: 0,
                          background: "none",
                          color: "#f97373",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div
            style={{
              flex: "1 1 auto",
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {editing ? (
              <>
                <input
                  value={editing.title}
                  onChange={(e) => handleChangeTitle(e.target.value)}
                  placeholder="지침 제목"
                  style={{
                    width: "100%",
                    marginBottom: 8,
                    borderRadius: 6,
                    border: "1px solid #374151",
                    padding: 8,
                    fontSize: 13,
                    background: "#111827",
                    color: "#f9fafb",
                  }}
                />
                <textarea
                  value={editing.content}
                  onChange={(e) => handleChangeContent(e.target.value)}
                  placeholder="지침 내용 또는 ISO/법률 작성 가이드라인을 입력하세요."
                  style={{
                    flex: 1,
                    width: "100%",
                    borderRadius: 6,
                    border: "1px solid #374151",
                    padding: 8,
                    fontSize: 13,
                    background: "#111827",
                    color: "#f9fafb",
                    resize: "none",
                  }}
                />
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: "#9ca3af",
                  }}
                >
                  ※ PDF/워드/이미지 등은 메인 화면 하단의 첨부 기능을 사용하고,
                  지침은 텍스트/코드 형태로 관리하는 것을 기본으로 합니다.
                </div>
              </>
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
      </div>
    </>
  );
};

const App: React.FC = () => {
  const [model, setModel] = useState<ModelOption>("gpt-5.1");
  const [modelList, setModelList] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/models`)
      .then((res) => res.json())
      .then((data) => setModelList(data.models))
      .catch(() => {
        setModelList([
          { id: "gpt-5.1", label: "gpt-5.1" },
          { id: "gpt-4.1", label: "gpt-4.1" },
          { id: "gpt-4.1-mini", label: "gpt-4.1-mini" },
        ]);
      });
  }, []);

  const [runMode, setRunMode] = useState<RunMode>("responses");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("strict");

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem("conversations");
    if (saved) return JSON.parse(saved);
    return [
      {
        id: "default",
        title: "신규테마",
        createdAt: new Date().toLocaleString("ko-KR"),
        messages: [],
      },
    ];
  });

  const [activeConversationId, setActiveConversationId] =
    useState<string>(() => {
      return localStorage.getItem("activeConversationId") || "default";
    });

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>(() => {
    const saved = localStorage.getItem("attachedFiles");
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [globalGuides, setGlobalGuides] = useState<Guide[]>(() => {
    const saved = localStorage.getItem("globalGuides");
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [conversationGuides, setConversationGuides] = useState<
    Record<string, Guide[]>
  >(() => {
    const saved = localStorage.getItem("conversationGuides");
    if (saved) return JSON.parse(saved);
    return {};
  });

  useEffect(() => {
    localStorage.setItem("conversations", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem("activeConversationId", activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    localStorage.setItem("attachedFiles", JSON.stringify(attachedFiles));
  }, [attachedFiles]);

  useEffect(() => {
    localStorage.setItem("globalGuides", JSON.stringify(globalGuides));
  }, [globalGuides]);

  useEffect(() => {
    localStorage.setItem(
      "conversationGuides",
      JSON.stringify(conversationGuides)
    );
  }, [conversationGuides]);

  const [isGuidePanelOpen, setIsGuidePanelOpen] = useState(false);

  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  );

  const activeConvGuides: Guide[] =
    conversationGuides[activeConversationId] || [];

  const handleNewConversation = () => {
    const id = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id,
      title: "새 테마",
      createdAt: new Date().toLocaleString("ko-KR"),
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(id);
  };

  const handleEditTitleStart = (conv: Conversation) => {
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
  };

  const handleEditTitleSave = (id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, title: editingTitle || c.title } : c
      )
    );
    setEditingConvId(null);
    setEditingTitle("");
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setAttachedFiles((prev) => [
      ...prev,
      ...files.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: f.name,
        file: f,
      })),
    ]);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files?.length) return;
    const files = Array.from(e.dataTransfer.files);
    setAttachedFiles((prev) => [
      ...prev,
      ...files.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: f.name,
        file: f,
      })),
    ]);
  };

  const handleRemoveAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const renderMessages = () => {
    if (!activeConversation || activeConversation.messages.length === 0) {
      return <div className="iso-chat-empty">아직 대화가 없습니다.</div>;
    }

    return (
      <div className="iso-chat-messages">
        {activeConversation.messages.map((msg, idx) => (
          <div
            key={idx}
            className={
              "iso-chat-bubble " + (msg.role === "user" ? "user" : "ai")
            }
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 2,
              }}
            >
              <span
                style={{
                  background: "#5b21b6",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "2px 16px",
                  fontWeight: 600,
                  fontSize: 12,
                  marginRight: 8,
                  display: "inline-block",
                  minWidth: 36,
                  textAlign: "center",
                }}
              >
                {msg.role === "user" ? "강박사님" : "유코나이-ISO Expert"}
              </span>
            </div>
            <div className="iso-chat-bubble-content">{msg.content}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderAttachedFilesInline = () => (
    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
      {attachedFiles.map((file) => (
        <span key={file.id} className="iso-attached-file-pill">
          {file.name}
          <button
            type="button"
            onClick={() => handleRemoveAttachedFile(file.id)}
            style={{
              marginLeft: 4,
              border: 0,
              background: "transparent",
              color: "#b91c1c",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !activeConversation) return;

    setError(null);
    setLoading(true);

    const userMessage: Message = { role: "user", content: trimmed };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? { ...c, messages: [...c.messages, userMessage] }
          : c
      )
    );
    setInput("");

    try {
      const payload = {
        message: trimmed,
        model,
        mode: runMode,
        answerMode,
        globalGuides: globalGuides.map((g) => ({
          id: g.id,
          title: g.title,
          content: g.content,
        })),
        convGuides: activeConvGuides.map((g) => ({
          id: g.id,
          title: g.title,
          content: g.content,
        })),
      };

      console.log("[ISO-CHAT] request", {
        messagePreview: trimmed.slice(0, 60),
        model,
        runMode,
        answerMode,
      });

      const res = await fetch(`${API_BASE}/iso-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("[ISO-CHAT] error response", text);
        throw new Error(text || "ISO API error");
      }

      const data = await res.json();
      const assistantText: string =
        data?.reply?.content || data?.reply || data?.content || "";

      console.log("[ISO-CHAT] success, reply length:", assistantText.length);

      const assistantMessage: Message = {
        role: "assistant",
        content:
          assistantText && assistantText.trim().length > 0
            ? assistantText
            : "유효한 정보가 없습니다. 관련 기초 정보를 제공해 주시면 심층 학습하여 더 나은 정보를 드리겠습니다.",
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? { ...c, messages: [...c.messages, assistantMessage] }
            : c
        )
      );
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          "ISO Expert 서버 호출 중 오류가 발생했습니다. 터미널 로그를 확인해 주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGuide = (scope: "global" | "conversation") => {
    const id = `g-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const base: Guide = {
      id,
      scope,
      conversationId:
        scope === "conversation" ? activeConversationId || undefined : undefined,
      title: "",
      content: "",
      files: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (scope === "global") {
      setGlobalGuides((prev) => [base, ...prev]);
    } else if (activeConversationId) {
      setConversationGuides((prev) => ({
        ...prev,
        [activeConversationId]: [base, ...(prev[activeConversationId] || [])],
      }));
    }
  };

  const handleUpdateGuide = (guide: Guide) => {
    if (guide.scope === "global") {
      setGlobalGuides((prev) =>
        prev.map((g) => (g.id === guide.id ? guide : g))
      );
    } else if (guide.scope === "conversation" && guide.conversationId) {
      setConversationGuides((prev) => {
        const list = prev[guide.conversationId!] || [];
        return {
          ...prev,
          [guide.conversationId!]: list.map((g) =>
            g.id === guide.id ? guide : g
          ),
        };
      });
    }
  };

  const handleDeleteGuide = (id: string, scope: "global" | "conversation") => {
    if (scope === "global") {
      setGlobalGuides((prev) => prev.filter((g) => g.id !== id));
    } else if (scope === "conversation" && activeConversationId) {
      setConversationGuides((prev) => ({
        ...prev,
        [activeConversationId]: (prev[activeConversationId] || []).filter(
          (g) => g.id !== id
        ),
      }));
    }
  };

  return (
    <div className="iso-app-root">
      {/* 좌측 사이드바 (테마 리스트) */}
      <aside className="iso-sidebar">
        <div className="iso-sidebar-header">
          <div className="iso-sidebar-title">UCONAI gpt-ISO Expert</div>
          <div className="iso-sidebar-sub">
            ISO/IEC JTC 1 SC 36 · PWI 26255 · TR 25468 국제 표준 작업 전용 어시스턴트
          </div>
          <button
            className="iso-sidebar-new-btn"
            type="button"
            onClick={handleNewConversation}
          >
            + 새 테마
          </button>
        </div>

        <div className="iso-sidebar-section theme-list">
          <div className="iso-sidebar-section-title">테마 목록</div>
          <ul className="iso-sidebar-conv-list">
            {conversations.map((c) => (
              <li
                key={c.id}
                className={
                  c.id === activeConversationId
                    ? "iso-sidebar-conv-item active"
                    : "iso-sidebar-conv-item"
                }
                onClick={() => setActiveConversationId(c.id)}
              >
                <div style={{ position: "relative", minHeight: 16 }}>
                  {conversations.length > 1 && (
                    <button
                      type="button"
                      title="테마 삭제"
                      className="iso-sidebar-conv-xbtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          window.confirm("정말 이 테마를 삭제하시겠습니까?")
                        ) {
                          setConversations((prev) => {
                            const filtered = prev.filter(
                              (conv) => conv.id !== c.id
                            );
                            if (
                              c.id === activeConversationId &&
                              filtered.length > 0
                            ) {
                              setActiveConversationId(filtered[0].id);
                            }
                            return filtered;
                          });
                        }
                      }}
                      tabIndex={-1}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          lineHeight: 1,
                          pointerEvents: "none",
                        }}
                      >
                        ×
                      </span>
                    </button>
                  )}
                  <div
                    className="iso-sidebar-conv-title"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditTitleStart(c);
                    }}
                  >
                    {editingConvId === c.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        autoFocus
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleEditTitleSave(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleEditTitleSave(c.id);
                          if (e.key === "Escape") {
                            setEditingConvId(null);
                            setEditingTitle("");
                          }
                        }}
                      />
                    ) : (
                      <span>{c.title}</span>
                    )}
                  </div>
                  <div className="iso-sidebar-conv-meta">
                    {(() => {
                      const dateMatch = c.createdAt.match(
                        /^(\d{4}\. ?\d{1,2}\. ?\d{1,2}\.)/
                      );
                      const timeMatch = c.createdAt.match(
                        /(오전|오후)\s*\d{1,2}:\d{2}/
                      );
                      const date = dateMatch ? dateMatch[1].trim() : "";
                      const time = timeMatch ? timeMatch[0] : "";
                      return (
                        date +
                        (time ? " " + time : "") +
                        " · " +
                        c.messages.length +
                        " 메시지"
                      );
                    })()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="iso-sidebar-section guides">
          <div className="iso-sidebar-section-title">지침 / 가이드</div>
          <div className="iso-sidebar-guides-desc">
            프로젝트 공통 지침과 대화방 지침을 통합 관리합니다.
          </div>
          <button
            type="button"
            onClick={() => setIsGuidePanelOpen(true)}
            style={{
              marginTop: 8,
              width: "100%",
              borderRadius: 999,
              border: "1px solid #4b5563",
              background: "transparent",
              color: "#e5e7eb",
              fontSize: 12,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            지침 / 가이드 관리
          </button>
        </div>
      </aside>

      {/* 중앙 메인 (채팅 카드) */}
      <main className="iso-main">
        <div className="iso-main-card">
          <div className="iso-main-card-header">
            <h1 className="iso-main-title">ISO/IEC개발 AI 서포터 - 유코나이</h1>
            <p className="iso-main-subtitle">
              ISO/IEC TR 25468 / IS-PWI 26255 - Metaverse LET 개발 지원
            </p>
          </div>

          <div className="iso-main-description">
            우측 &quot;대화 설정 / 기능&quot; 패널에서 모델·실행 방식·답변 모드를
            선택하고, 이 영역에서는 ISO/IEC 초안·TR/IS 문서를 중심으로 대화를 진행합니다.
          </div>

          <div className="iso-main-chat">{renderMessages()}</div>

          {attachedFiles.length > 0 && renderAttachedFilesInline()}

          <div className="attach-bar">
            <button
              type="button"
              aria-label="첨부파일"
              onClick={() => fileInputRef.current?.click()}
              style={{
                borderRadius: 999,
                border: "1px solid #e5e7eb",
                width: 28,
                height: 28,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f9fafb",
                cursor: "pointer",
              }}
            >
              <ClipIcon />
            </button>
            <span>
              파일/이미지를 드래그하거나 아이콘을 눌러 첨부할 수 있습니다.
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={handleFileInputChange}
              accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.txt,.zip,.hwp,.ppt,.pptx,.csv"
            />
          </div>

          {error && <div className="iso-error">{error}</div>}

          <form className="iso-input-form" onSubmit={handleSubmit}>
            <textarea
              className="iso-textarea"
              placeholder="질문을 입력하고 Enter로 전송 (Shift+Enter 줄바꿈)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            />
            <button
              type="submit"
              className="iso-submit-btn"
              disabled={loading || !input.trim()}
            >
              {loading ? "생성 중..." : "전송"}
            </button>
          </form>
        </div>
      </main>

      {/* 우측 사이드바 (펑션/상태 패널) */}
      <aside className="iso-rightbar">
        <div className="iso-rightbar-header">대화 설정 / 기능</div>

        <div className="iso-rightbar-main">
          {/* 현재 테마 정보 */}
          <div className="iso-rightbar-section">
            <div className="iso-rightbar-section-title">현재 테마 정보</div>
            {activeConversation ? (
              <>
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  제목: <strong>{activeConversation.title}</strong>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    marginBottom: 4,
                  }}
                >
                  생성: {activeConversation.createdAt}
                </div>
                <div style={{ fontSize: 12 }}>
                  메시지 수: {activeConversation.messages.length}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                활성화된 테마가 없습니다.
              </div>
            )}
          </div>

          {/* 모델 / 실행 방식 설정 */}
          <div className="iso-rightbar-section">
            <div className="iso-rightbar-section-title">모델 / 실행 방식</div>
            <div className="iso-main-controls" style={{ marginBottom: 8 }}>
              <div className="iso-main-control">
                <label className="iso-label">모델 선택</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as ModelOption)}
                >
                  {modelList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="iso-main-control">
                <label className="iso-label">실행 방식</label>
                <select
                  value={runMode}
                  onChange={(e) => setRunMode(e.target.value as RunMode)}
                >
                  <option value="chat">일반 실행 (Chat API)</option>
                  <option value="responses">고급 실행 (Responses API)</option>
                </select>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              ISO 전용 서버(WSL2/Docker)에서 지정한 모델과 실행 모드를 사용합니다.
            </div>
          </div>

          {/* 답변 모드 설정 */}
          <div className="iso-rightbar-section">
            <div className="iso-rightbar-section-title">답변 모드</div>
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  className={
                    "iso-answer-btn" + (answerMode === "strict" ? " active" : "")
                  }
                  onClick={() => setAnswerMode("strict")}
                  style={{
                    borderRadius: 999,
                    fontWeight: 600,
                    padding: "6px 18px",
                    background:
                      answerMode === "strict" ? "#5b21b6" : "#111827",
                    color: answerMode === "strict" ? "#fff" : "#e5e7eb",
                    border: 0,
                    fontSize: 13,
                    minWidth: 80,
                    transition: "background 0.2s, color 0.2s",
                  }}
                >
                  보수형
                </button>
                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  공인 문서·실재 근거 위주의
                  <br />
                  정보만 사용
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  className={
                    "iso-answer-btn" +
                    (answerMode === "aggressive" ? " active" : "")
                  }
                  onClick={() => setAnswerMode("aggressive")}
                  style={{
                    borderRadius: 999,
                    fontWeight: 600,
                    padding: "6px 18px",
                    background:
                      answerMode === "aggressive" ? "#5b21b6" : "#111827",
                    color: answerMode === "aggressive" ? "#fff" : "#e5e7eb",
                    border: 0,
                    fontSize: 13,
                    minWidth: 80,
                    transition: "background 0.2s, color 0.2s",
                  }}
                >
                  적극형
                </button>
                <div
                  style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  ISO 논리 구조는 유지하되
                  <br />
                  생성형 보조 설명 허용
                </div>
              </div>
            </div>
          </div>

          {/* 첨부 파일 요약 */}
          <div className="iso-rightbar-section">
            <div className="iso-rightbar-section-title">첨부 파일</div>
            {attachedFiles.length === 0 ? (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                아직 첨부된 파일이 없습니다.
              </div>
            ) : (
              <div className="iso-rightbar-files">
                {attachedFiles.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 12,
                      padding: "4px 0",
                      borderBottom: "1px solid #111827",
                    }}
                  >
                    <span
                      style={{
                        maxWidth: 160,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachedFile(file.id)}
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 지침 / 가이드 요약 + 진입 */}
        <div className="iso-rightbar-section">
          <div className="iso-rightbar-section-title">지침 / 가이드</div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            공통 지침: {" "}
            <span style={{ fontWeight: 700 }}>{globalGuides.length}</span> 개
          </div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            이 대화방 지침: {" "}
            <span style={{ fontWeight: 700 }}>{activeConvGuides.length}</span> 개
          </div>
          <button
            type="button"
            onClick={() => setIsGuidePanelOpen(true)}
            style={{
              width: "100%",
              borderRadius: 999,
              border: "1px solid #4b5563",
              background: "#111827",
              color: "#e5e7eb",
              fontSize: 12,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            지침 / 가이드 패널 열기
          </button>
        </div>
      </aside>

      {/* 지침/가이드 패널 (플로팅) */}
      <GuidePanel
        isOpen={isGuidePanelOpen}
        onClose={() => setIsGuidePanelOpen(false)}
        globalGuides={globalGuides}
        // 항상 배열만 전달
        conversationGuides={activeConvGuides}
        activeConversationId={activeConversationId}
        onCreateGuide={handleCreateGuide}
        onUpdateGuide={handleUpdateGuide}
        onDeleteGuide={handleDeleteGuide}
        setGlobalGuides={setGlobalGuides}
        setConversationGuides={setConversationGuides}
      />
    </div>
  );
};

export default App;
