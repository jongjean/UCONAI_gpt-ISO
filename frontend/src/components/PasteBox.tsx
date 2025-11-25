import React, { useEffect, useRef, useState } from "react";

type PasteBoxProps = {
  onFilesPasted: (files: File[]) => void;
};

const PasteBox: React.FC<PasteBoxProps> = ({ onFilesPasted }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
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
    return () => {
      ref.removeEventListener("paste", handlePaste as any);
    };
  }, [onFilesPasted]);

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      style={{
        border: "2px dashed #7c3aed",
        borderRadius: 8,
        padding: 16,
        textAlign: "center",
        color: isFocused ? "#fff" : "#a5b4fc",
        background: isFocused ? "#312e81" : "#1e293b",
        outline: isFocused ? "2px solid #7c3aed" : "none",
        marginBottom: 8,
        cursor: "pointer",
        fontSize: 13,
        transition: "background 0.15s, color 0.15s, outline 0.15s",
        userSelect: "none",
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onClick={() => boxRef.current?.focus()}
      title="여기를 클릭하고 Ctrl+V로 파일을 붙여넣으세요."
      aria-label="파일 붙여넣기 영역"
    >
      <span style={{ pointerEvents: "none" }}>
        <b>여기를 클릭</b>한 뒤 <b>Ctrl+V</b>로 파일을 붙여넣으세요.<br />
        (이미지, PDF, 워드 등 첨부 가능)
      </span>
    </div>
  );
};

export default PasteBox;
