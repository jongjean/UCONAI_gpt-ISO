
import * as React from "react";

type Role = "user" | "assistant";



interface ChatMessage {
  role: Role;
  content: string;
}

interface AttachedFile {
  id: string;
  file: File;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
  guidanceText: string;
  files: AttachedFile[];
}

type ApiMode = "chat" | "responses";

const createConversation = (): Conversation => {
  const id =
    (typeof crypto !== "undefined" && (crypto as any).randomUUID?.()) ||
    `conv-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    title: "새 대화",
    createdAt: Date.now(),
    messages: [],
    guidanceText: "",
    files: [],
  };
};


const App = () => {
  const [conversations, setConversations] = React.useState<Conversation[]>([
    createConversation(),
  ]);
  const [activeId, setActiveId] = React.useState<string>(conversations[0].id);

  const [input, setInput] = React.useState("");
  const [model, setModel] = React.useState("gpt-5.1");
  const [apiMode, setApiMode] = React.useState<ApiMode>("chat");
  const [isLoading, setIsLoading] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const activeConv =
    conversations.find((c: Conversation) => c.id === activeId) ?? conversations[0];

  /* ---------- 좌측 패널: 대화/지침/파일 상태 변경 헬퍼 ---------- */

  const updateConversation = (id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev: Conversation[]) =>
      prev.map((c: Conversation) => (c.id === id ? updater(c) : c))
    );
  };

  const handleNewConversation = () => {
    const newConv = createConversation();
    setConversations((prev: Conversation[]) => [newConv, ...prev]);
    setActiveId(newConv.id);
  };

  const addFilesToActive = (files: FileList | null) => {
    if (!files || !activeConv) return;
    const arr = Array.from(files);

    updateConversation(activeConv.id, (c: Conversation) => {
      const existingNames = new Set(c.files.map((f: AttachedFile) => f.file.name));
      const newFiles: AttachedFile[] = arr
        .filter((f) => !existingNames.has(f.name))
        .map((f: File) => ({
          id:
            (typeof crypto !== "undefined" &&
              (crypto as any).randomUUID?.()) ||
            `file-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          file: f,
        }));
      return { ...c, files: [...c.files, ...newFiles] };
    });
  };

  const removeFileFromActive = (fileId: string) => {
    if (!activeConv) return;
    updateConversation(activeConv.id, (c: Conversation) => ({
      ...c,
      files: c.files.filter((f: AttachedFile) => f.id !== fileId),
    }));
  };

  const clearGuidanceForActive = () => {
    if (!activeConv) return;
    updateConversation(activeConv.id, (c: Conversation) => ({
      ...c,
      guidanceText: "",
      files: [],
    }));
  };

  const handleGuidanceChange = (value: string) => {
    if (!activeConv) return;
    updateConversation(activeConv.id, (c: Conversation) => ({
      ...c,
      guidanceText: value,
    }));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    addFilesToActive(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  /* ---------- 메시지 전송 ---------- */

  const handleSend = async () => {
    if (!input.trim() || isLoading || !activeConv) return;

    const userVisibleMessage = input;
    setInput("");

    // 1) 사용자 메시지를 현재 대화에 추가
    updateConversation(activeConv.id, (c) => {
      const newMessages = [
        ...c.messages,
        { role: "user" as Role, content: userVisibleMessage },
      ];
      // 첫 메시지라면 제목 자동 생성
      const newTitle =
        c.messages.length === 0 && userVisibleMessage.trim().length > 0
          ? userVisibleMessage.trim().slice(0, 24)
          : c.title;
      return { ...c, messages: newMessages, title: newTitle };
    });

    setIsLoading(true);

    // 2) 백엔드로 전송할 프롬프트 구성
    const convSnapshot =
      conversations.find((c) => c.id === activeConv.id) || activeConv;

    let prefix = "";

    if (convSnapshot.guidanceText.trim()) {
      prefix += `지침/가이드:\n${convSnapshot.guidanceText.trim()}\n\n`;
    }

    if (convSnapshot.files.length > 0) {
      const lines = convSnapshot.files.map((f) => {
        const file = f.file;
        return `- ${file.name} (${Math.round(file.size / 1024)} KB, ${
          file.type || "unknown"
        })`;
      });
      prefix += `참고용 첨부 파일 목록:\n${lines.join("\n")}\n\n`;
    }

    const finalMessage = prefix + `질문:\n` + userVisibleMessage;

    try {
      const res = await fetch("http://localhost:4400/api/iso-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: finalMessage,
          model,
          apiMode,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const errorMsg =
          data.error || `HTTP ${res.status} 오류가 발생했습니다.`;
        updateConversation(activeConv.id, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            { role: "assistant", content: `[시스템] ${errorMsg}` },
          ],
        }));
        return;
      }

      const replyText: string =
        data.reply?.content || "[내용 없음: 모델 응답이 비어 있습니다.]";

      updateConversation(activeConv.id, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          { role: "assistant", content: replyText },
        ],
      }));
    } catch (err: any) {
      console.error("ISO chat error:", err);
      updateConversation(activeConv.id, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          {
            role: "assistant",
            content: `[시스템] 클라이언트 오류: ${
              err?.message || String(err)
            }`,
          },
        ],
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messagesToShow = activeConv?.messages ?? [];

  /* ---------- 렌더링 ---------- */

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "#f3f4f6",
      }}
    >
      {/* 좌측 패널 */}
      <aside
        style={{
          width: 260,
          borderRight: "1px solid #e5e7eb",
          background: "#111827",
          color: "#e5e7eb",
          display: "flex",
          flexDirection: "column",
          padding: "16px 12px",
        }}
      >
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>대화 & 지침</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
            각 대화마다 지침/가이드와 첨부 파일을 따로 관리합니다.
          </div>
        </div>

        <button
          type="button"
          onClick={handleNewConversation}
          style={{
            marginBottom: 12,
            width: "100%",
            padding: "6px 0",
            borderRadius: 999,
            border: "none",
            background: "#8b5cf6",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + 새 대화 만들기
        </button>

        {/* 대화 목록 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            marginBottom: 12,
          }}
        >
          {conversations.map((c) => {
            const isActive = c.id === activeId;
            return (
              <div
                key={c.id}
                onClick={() => setActiveId(c.id)}
                style={{
                  padding: "6px 8px",
                  borderRadius: 8,
                  marginBottom: 4,
                  cursor: "pointer",
                  background: isActive ? "#1f2937" : "transparent",
                  border: isActive ? "1px solid #8b5cf6" : "1px solid transparent",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#e5e7eb",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                  }}
                >
                  {c.title || "새 대화"}
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: 10,
                    color: "#9ca3af",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>
                    {new Date(c.createdAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>{c.messages.length} 메시지</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 지침/가이드 & 파일 편집 */}
        {activeConv && (
          <div
            style={{
              borderTop: "1px solid #374151",
              paddingTop: 8,
              fontSize: 11,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ fontWeight: 600 }}>지침 / 가이드</span>
              <button
                type="button"
                onClick={clearGuidanceForActive}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#9ca3af",
                  cursor: "pointer",
                  fontSize: 10,
                  textDecoration: "underline",
                }}
              >
                초기화
              </button>
            </div>
            <textarea
              value={activeConv.guidanceText}
              onChange={(e) => handleGuidanceChange(e.target.value)}
              placeholder="예: 이 대화는 PWI 26255 WD 초안용. 1 Scope는 기존 TR 25468과 정합성 유지..."
              style={{
                width: "100%",
                minHeight: 70,
                maxHeight: 90,
                resize: "vertical",
                fontSize: 11,
                padding: "4px 6px",
                borderRadius: 6,
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
                marginBottom: 6,
              }}
            />

            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                border: "1px dashed #6d28d9",
                borderRadius: 6,
                padding: 6,
                background: "#020617",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 2,
                }}
              >
                <span style={{ color: "#a5b4fc" }}>
                  파일 드롭 또는 선택 (여러 개 가능)
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "none",
                    background: "#8b5cf6",
                    color: "#ffffff",
                    fontSize: 10,
                    cursor: "pointer",
                  }}
                >
                  파일 선택
                </button>
              </div>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={(e) => addFilesToActive(e.target.files)}
              />
              {activeConv.files.length === 0 ? (
                <div style={{ color: "#9ca3af" }}>
                  첨부된 파일이 없습니다.
                </div>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    maxHeight: 80,
                    overflowY: "auto",
                  }}
                >
                  {activeConv.files.map((f) => (
                    <li
                      key={f.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "1px 0",
                        fontSize: 10,
                        color: "#e5e7eb",
                      }}
                    >
                      <span
                        style={{
                          marginRight: 6,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flex: 1,
                        }}
                      >
                        {f.file.name} (
                        {Math.round(f.file.size / 1024)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFileFromActive(f.id)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#fca5a5",
                          cursor: "pointer",
                          fontSize: 10,
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
        )}
      </aside>

      {/* 우측 메인 카드 (기존 디자인 유지) */}
      <main
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "420px",
            maxHeight: "90vh",
            background: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 20px 40px rgba(15,23,42,0.15)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* 헤더 */}
          <div
            style={{
              padding: "16px 20px 8px",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: "18px", fontWeight: 700 }}>
              UCONAI gpt-ISO Expert
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
                marginTop: "4px",
              }}
            >
              ISO/IEC JTC 1 SC 36 · PWI 26255 · TR 25468 전용 전문가 어시스턴트
            </div>

            {/* 모델 / API 모드 선택 */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "10px",
                fontSize: "11px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: "2px" }}>모델</div>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "4px 6px",
                    fontSize: "11px",
                  }}
                >
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4.1">gpt-4.1</option>
                  <option value="gpt-5.1">gpt-5.1</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: "2px" }}>실행 방식</div>
                <select
                  value={apiMode}
                  onChange={(e) =>
                    setApiMode(e.target.value as ApiMode)
                  }
                  style={{
                    width: "100%",
                    padding: "4px 6px",
                    fontSize: "11px",
                  }}
                >
                  <option value="chat">일반 실행 (Chat API)</option>
                  <option value="responses">고급 실행 (Responses API)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 메시지 영역 */}
          <div
            style={{
              flex: 1,
              padding: "12px 16px",
              overflowY: "auto",
              background: "#f9fafb",
            }}
          >
            {messagesToShow.length === 0 && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  textAlign: "center",
                  marginTop: "40px",
                }}
              >
                ISO/IEC 표준, PWI 26255, TR 25468, 메타버스 LET 등에 대해
                질문해 보세요.
              </div>
            )}

            {messagesToShow.map((m, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: "8px",
                  display: "flex",
                  justifyContent:
                    m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "8px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    whiteSpace: "pre-wrap",
                    background:
                      m.role === "user" ? "#6366f1" : "#e5e7eb",
                    color: m.role === "user" ? "#ffffff" : "#111827",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          {/* 입력 영역 */}
          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              padding: "8px 12px",
              background: "#ffffff",
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="질문을 입력하고 Enter로 전송 (Shift+Enter 줄바꿈)"
              style={{
                width: "100%",
                minHeight: "56px",
                maxHeight: "120px",
                resize: "none",
                fontSize: "12px",
                padding: "6px 8px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
              }}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              style={{
                marginTop: "6px",
                width: "100%",
                padding: "6px 0",
                borderRadius: "999px",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                background: isLoading ? "#9ca3af" : "#8b5cf6",
                color: "#ffffff",
                cursor:
                  isLoading || !input.trim()
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {isLoading ? "생성 중…" : "생성"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

