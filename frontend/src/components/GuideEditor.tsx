// src/components/GuideEditor.tsx
import React from "react";
import FileDropZone from "./FileDropZone";
import { Guide, GuideFile } from "../types/isoChat";

/** 붙여넣기(Ctrl+V) 전용 상자 */
function PasteBox({ onFilesPasted }: { onFilesPasted: (files: File[]) => void }) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    const ref = boxRef.current;
    if (!ref) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (document.activeElement !== ref) return;
      if (e.clipboardData) {
        const files: File[] = Array.from(e.clipboardData.files);
        if (files.length > 0) {
          e.preventDefault();
          onFilesPasted(files);
        }
      }
    };

    ref.addEventListener("paste", handlePaste as any);
    return () => ref.removeEventListener("paste", handlePaste as any);
  }, [onFilesPasted]);

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      style={{
        border: "2px dashed #7c3aed",
        borderRadius: 8,
        padding: 12,
        textAlign: "center",
        color: isFocused ? "#fff" : "#a5b4fc",
        background: isFocused ? "#312e81" : "#1e293b",
        outline: isFocused ? "2px solid #7c3aed" : "none",
        marginBottom: 4,
        cursor: "pointer",
        fontSize: 11,
        transition: "background 0.15s, color 0.15s, outline 0.15s",
        userSelect: "none",
        maxWidth: "260px",
        alignSelf: "flex-start",
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onClick={() => boxRef.current?.focus()}
      title="여기를 클릭하고 Ctrl+V로 파일을 붙여넣으세요."
      aria-label="파일 붙여넣기 영역"
    >
      <span style={{ pointerEvents: "none" }}>
        <b>클릭</b> 후 <b>Ctrl+V</b>로 파일 붙여넣기
        <br />
        (이미지, PDF, 워드 등)
      </span>
    </div>
  );
}

export type GuideEditorProps = {
  editing: Guide | null;
  onChangeTitle: (value: string) => void;
  onChangeContent: (value: string) => void;
  onAttachFiles: (files: File[]) => void;
  onRemoveFile: (fileId: string) => void;
};

const GuideEditor: React.FC<GuideEditorProps> = ({
  editing,
  onChangeTitle,
  onChangeContent,
  onAttachFiles,
  onRemoveFile,
}) => {
  if (!editing) {
    return (
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
    );
  }

  const files: GuideFile[] = editing.files || [];

  return (
    <div
      style={{
        flex: "1 1 auto",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <input
        value={editing.title}
        onChange={(e) => onChangeTitle(e.target.value)}
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

      {/* 파일 첨부 DropZone */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          marginBottom: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <FileDropZone
            label="지침/가이드에 파일 첨부 (드래그 또는 클릭)"
            inputId="guide-panel-file-input"
            onFilesSelected={onAttachFiles}
          />
        </div>

        {/* 붙여넣기 전용 상자 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            flex: "0 0 auto",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#a5b4fc",
              marginBottom: 4,
              fontWeight: 600,
            }}
          >
            ⬇️ 파일 붙여넣기(Ctrl+V)
          </div>
          <PasteBox onFilesPasted={onAttachFiles} />
        </div>
      </div>

      {/* 첨부 파일 리스트 */}
      {files.length > 0 && (
        <div
          style={{
            marginBottom: 8,
            padding: 8,
            borderRadius: 6,
            border: "1px solid #1f2937",
            background: "#020617",
            maxHeight: 120,
            overflowY: "auto",
          }}
        >
          {files.map((file) => (
            <div
              key={file.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11,
                padding: "2px 0",
                borderBottom: "1px solid #111827",
              }}
            >
              <span
                style={{
                  maxWidth: 220,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {file.fileName || "(파일명 없음)"}
              </span>
              <button
                type="button"
                onClick={() => onRemoveFile(file.id)}
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

      <textarea
        value={editing.content}
        onChange={(e) => onChangeContent(e.target.value)}
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
        ※ PDF/워드/이미지 등은 첨부만 해 두고, 지침 본문에는 요약·핵심 규칙을
        텍스트로 정리하는 것을 권장합니다.
      </div>
    </div>
  );
};

export default GuideEditor;
