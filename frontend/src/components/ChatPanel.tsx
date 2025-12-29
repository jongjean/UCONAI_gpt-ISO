import React from "react";
import {
  Conversation,
  AttachedFile,
  Message,
} from "../types/isoChat";

type ChatPanelProps = {
  activeConversation: Conversation | null;
  attachedFiles: AttachedFile[];
  input: string;
  lastSentInput: string;
  loading: boolean;
  error: string | null;
  onChangeInput: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onDrop: (e: React.DragEvent<HTMLTextAreaElement>) => void;
  onFilesAdded: (files: File[]) => void;
  onRemoveAttachedFile: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

// App.tsx 안에 있던 클립 아이콘을 이쪽으로 이동
const ClipIcon: React.FC = () => (
  <span style={{ fontSize: 16, display: "inline-flex", alignItems: "center" }}>
    📎
  </span>
);

const ChatPanel: React.FC<ChatPanelProps> = ({
  activeConversation,
  attachedFiles,
  input,
  lastSentInput,
  loading,
  error,
  onChangeInput,
  onSubmit,
  onDrop,
  onFilesAdded,
  onRemoveAttachedFile,
  fileInputRef,
  onFileInputChange,
}) => {
  const [inputHeight, setInputHeight] = React.useState<number>(120);
  const resizingRef = React.useRef<{
    startY: number;
    startHeight: number;
  } | null>(null);
  const messagesRef = React.useRef<HTMLDivElement | null>(null);

  // 새 메시지가 추가될 때마다 자동 스크롤
  React.useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [activeConversation?.id, activeConversation?.messages.length]);

  const [hiddenMessages, setHiddenMessages] = React.useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = React.useState<string | null>(null);
  const cancelConfirmRef = React.useRef<HTMLButtonElement | null>(null);
  const deleteConfirmRef = React.useRef<HTMLButtonElement | null>(null);
  const confirmDialogLabelId = React.useId();

  React.useEffect(() => {
    if (confirmTarget) {
      cancelConfirmRef.current?.focus();
    }
  }, [confirmTarget]);

  const storageKey = React.useMemo(
    () => (activeConversation?.id ? `hiddenMessages:${activeConversation.id}` : "hiddenMessages:none"),
    [activeConversation?.id]
  );

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const arr: string[] = JSON.parse(raw);
        setHiddenMessages(new Set(arr));
        return;
      }
    } catch {
      // ignore parse errors
    }
    setHiddenMessages(new Set());
  }, [storageKey]);

  const persistHidden = (next: Set<string>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
    } catch {
      // ignore storage errors
    }
  };

  const hideMessage = (key: string) => {
    setHiddenMessages((prev) => {
      const next = new Set(prev);
      next.add(key);
      persistHidden(next);
      return next;
    });
  };

  const [hiddenAttIds, setHiddenAttIds] = React.useState<Set<string>>(new Set());

  const attStorageKey = React.useMemo(
    () =>
      activeConversation?.id
        ? `hiddenAtt:${activeConversation.id}`
        : null,
    [activeConversation?.id]
  );

  const loadHiddenAtt = React.useCallback(() => {
    if (!attStorageKey) {
      setHiddenAttIds(new Set());
      return;
    }
    try {
      const raw = localStorage.getItem(attStorageKey);
      if (!raw) {
        setHiddenAttIds(new Set());
        return;
      }
      const arr: string[] = JSON.parse(raw);
      setHiddenAttIds(new Set(Array.isArray(arr) ? arr : []));
    } catch {
      setHiddenAttIds(new Set());
    }
  }, [attStorageKey]);

  React.useEffect(() => {
    loadHiddenAtt();
  }, [loadHiddenAtt, activeConversation?.id, activeConversation?.messages.length]);

  React.useEffect(() => {
    const handler = () => loadHiddenAtt();
    window.addEventListener("hiddenAttUpdated", handler);
    return () => window.removeEventListener("hiddenAttUpdated", handler);
  }, [loadHiddenAtt]);

  const renderMessages = () => {
    if (!activeConversation || activeConversation.messages.length === 0) {
      return (
        <div
          style={{
            fontSize: 13,
            color: "#9ca3af",
            padding: "16px 0",
            textAlign: "center",
          }}
        >
          아직 대화가 없습니다.
        </div>
      );
    }

    return activeConversation.messages.map((msg: Message, idx: number) => {
      const msgKey = msg.id || `local-${idx}`;
      if (hiddenMessages.has(msgKey)) return null;

      const hideButton = (
        <button
          type="button"
          aria-label="메시지 숨기기"
          onClick={() => setConfirmTarget(msgKey)}
          style={{
            border: 0,
            background: "transparent",
            color: "#9ca3af",
            fontSize: 10,
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      );

      return (
        <div
          key={msgKey}
          style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
          }}
        >
          <div
            className={
              msg.role === "user"
                ? "iso-chat-bubble iso-chat-bubble-user"
                : "iso-chat-bubble iso-chat-bubble-assistant"
            }
            style={{ textAlign: msg.role === "user" ? "right" : "left" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: 2,
                justifyContent:
                  msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {msg.role !== "user" && <span style={{ marginRight: 6 }}>{hideButton}</span>}
              <span
                style={{
                  background: "#5b21b6",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "2px 16px",
                  fontWeight: 600,
                  fontSize: 12,
                  marginRight: msg.role === "assistant" ? 8 : 0,
                  marginLeft: msg.role === "user" ? 8 : 0,
                  display: "inline-block",
                  minWidth: 36,
                  textAlign: "center",
                }}
              >
                {msg.role === "user" ? "강박사님" : "유코나이-ISO Expert"}
              </span>
              {msg.role === "user" && <span style={{ marginLeft: 6 }}>{hideButton}</span>}
            </div>
            {msg.createdAt && (
              <div
                style={{
                  fontSize: 10,
                  color: "#9ca3af",
                  marginBottom: 6,
                  textAlign: msg.role === "user" ? "right" : "left",
                }}
              >
                {new Date(msg.createdAt).toLocaleString("ko-KR")}
              </div>
            )}
            <div className="iso-chat-bubble-content">{msg.content}</div>
            {msg.attachments && msg.attachments.length > 0 && (
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  fontSize: 12,
                }}
              >
                {msg.attachments.map((att) => {
                  const isHidden = att.id && hiddenAttIds.has(att.id);
                  if (isHidden) {
                    return (
                      <span
                        key={att.id || att.storageKey}
                        style={{ color: "#9ca3af", fontStyle: "italic" }}
                      >
                        📎 삭제됨
                      </span>
                    );
                  }
                  return (
                    <a
                      key={att.id || att.storageKey}
                      href={att.downloadUrl || "#"}
                      target={att.downloadUrl ? "_blank" : undefined}
                      rel="noreferrer"
                      style={{
                        color: "#1d4ed8",
                        textDecoration: "underline",
                        wordBreak: "break-all",
                      }}
                    >
                      📎 {att.fileName || att.storageKey}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  const renderAttachedFilesInline = () => {
    if (attachedFiles.length === 0) return null;
    return (
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
        {attachedFiles.map((file: AttachedFile) => (
          <span key={file.id} className="iso-attached-file-pill">
            {file.name}
            <button
              type="button"
              onClick={() => onRemoveAttachedFile(file.id)}
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
  };

  const handleConfirmSubmit = React.useCallback(() => {
    if (!confirmTarget) return;
    hideMessage(confirmTarget);
    setConfirmTarget(null);
  }, [confirmTarget]);

  const handleConfirmKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleConfirmSubmit();
    }
  };

  const renderConfirmModal = () => {
    if (!confirmTarget) return null;

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setConfirmTarget(null);
        return;
      }
      if (event.key === "Enter" && event.target === event.currentTarget) {
        event.preventDefault();
        handleConfirmSubmit();
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
          zIndex: 2000,
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={confirmDialogLabelId}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 16,
            width: 280,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            outline: "none",
          }}
        >
          <div
            id={confirmDialogLabelId}
            style={{ fontWeight: 700, marginBottom: 8 }}
          >
            삭제하시겠습니까?
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              ref={cancelConfirmRef}
              onClick={() => setConfirmTarget(null)}
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
              ref={deleteConfirmRef}
              onClick={handleConfirmSubmit}
              onKeyDown={handleConfirmKeyDown}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: 0,
                background: "#5b21b6",
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

  return (
    <main className="iso-main">
      <div className="iso-main-card">
        <div className="iso-main-card-header">
          <h1 className="iso-main-title">ISO/IEC개발 AI 서포터 - 유코나이</h1>
          <p className="iso-main-subtitle">Metaverse LET ISO 개발 지원</p>
        </div>

        <div className="iso-main-description" />

        <div className="iso-main-chat" ref={messagesRef}>
          {renderMessages()}
        </div>

        {renderAttachedFilesInline()}

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
          <span>파일첨부</span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={onFileInputChange}
            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.txt,.zip,.hwp,.ppt,.pptx,.csv"
          />
        </div>

        {/* 파일 드래그/붙여넣기 안내 영역 */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <div
            onDrop={(e) => {
              e.preventDefault();
              onFilesAdded(Array.from(e.dataTransfer.files || []));
            }}
            onDragOver={(e) => e.preventDefault()}
            style={{
              flex: 1,
              minWidth: 200,
              border: "2px dashed #7c3aed",
              borderRadius: 10,
              padding: 10,
              background: "rgba(124,58,237,0.05)",
              color: "#4c1d95",
              fontSize: 12,
            }}
          >
            ⬇️ 파일 드래그&드롭 박스
          </div>
          <div
            onPaste={(e) => {
              const files = Array.from(e.clipboardData?.files || []);
              if (files.length) {
                e.preventDefault();
                onFilesAdded(files);
              }
            }}
            tabIndex={0}
            style={{
              flex: 1,
              minWidth: 200,
              border: "2px dashed #2563eb",
              borderRadius: 10,
              padding: 10,
              background: "rgba(37,99,235,0.05)",
              color: "#1d4ed8",
              fontSize: 12,
              outline: "none",
            }}
            title="클릭 후 Ctrl+V로 파일 붙여넣기"
          >
            📋 붙여넣기 박스 (클릭 후 Ctrl+V)
          </div>
        </div>

        {error && <div className="iso-error">{error}</div>}

        <form className="iso-input-form" onSubmit={onSubmit}>
          <div className="iso-textarea-wrapper">
            <textarea
              className="iso-textarea"
              style={{ height: inputHeight }}
              placeholder="질문을 입력하고 Enter로 전송 (Shift+Enter 줄바꿈)"
              value={input}
              onChange={(e) => onChangeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" && !input.trim()) {
                  if (lastSentInput) {
                    e.preventDefault();
                    onChangeInput(lastSentInput);
                  }
                }
                if (e.key === "Enter" && e.ctrlKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
            />
            <span
              className="iso-textarea-resize"
              onMouseDown={(e) => {
                resizingRef.current = {
                  startY: e.clientY,
                  startHeight: inputHeight,
                };
                const move = (ev: MouseEvent) => {
                  if (!resizingRef.current) return;
                  const delta = resizingRef.current.startY - ev.clientY;
                  setInputHeight(
                    Math.min(
                      320,
                      Math.max(100, resizingRef.current.startHeight + delta)
                    )
                  );
                };
                const up = () => {
                  resizingRef.current = null;
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
              title="위아래로 드래그하여 크기 조절"
            >
              ↕
            </span>
          </div>
          <button
            type="submit"
            className="iso-submit-btn"
            disabled={loading || (!input.trim() && attachedFiles.length === 0)}
          >
            {loading ? "답변 준비 중...." : "전송"}
          </button>
        </form>
      </div>
      {renderConfirmModal()}
    </main>
  );
};

export default ChatPanel;
