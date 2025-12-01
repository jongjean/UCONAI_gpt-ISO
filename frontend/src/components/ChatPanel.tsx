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

    return activeConversation.messages.map(
      (msg: Message, idx: number) => (
        <div
          key={idx}
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
            </div>
            <div className="iso-chat-bubble-content">{msg.content}</div>
          </div>
        </div>
      )
    );
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

  return (
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
          <span>
            파일/이미지를 드래그하거나 아이콘을 눌러 첨부할 수 있습니다.
          </span>
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
                if (e.key === "Enter" && !e.shiftKey) {
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
            disabled={loading || !input.trim()}
          >
            {loading ? "생성 중..." : "전송"}
          </button>
        </form>
      </div>
    </main>
  );
};

export default ChatPanel;
