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
  loading: boolean;
  error: string | null;
  onChangeInput: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onDrop: (e: React.DragEvent<HTMLTextAreaElement>) => void;
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
  loading,
  error,
  onChangeInput,
  onSubmit,
  onDrop,
  onRemoveAttachedFile,
  fileInputRef,
  onFileInputChange,
}) => {
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
          className={
            msg.role === "user"
              ? "iso-chat-bubble iso-chat-bubble-user"
              : "iso-chat-bubble iso-chat-bubble-assistant"
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
          선택하고, 이 영역에서는 ISO/IEC 초안·TR/IS 문서를 중심으로 대화를
          진행합니다.
        </div>

        <div className="iso-main-chat">{renderMessages()}</div>

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

        {error && <div className="iso-error">{error}</div>}

        <form className="iso-input-form" onSubmit={onSubmit}>
          <textarea
            className="iso-textarea"
            placeholder="질문을 입력하고 Enter로 전송 (Shift+Enter 줄바꿈)"
            value={input}
            onChange={(e) => onChangeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            onDrop={onDrop}
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
  );
};

export default ChatPanel;
