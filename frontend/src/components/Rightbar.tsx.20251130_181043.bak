import React from "react";

export type RightbarProps = {
  model: string;
  setModel: (v: string) => void;
  modelList: { id: string; label: string }[];
  runMode: string;
  setRunMode: (v: string) => void;
  answerMode: string;
  setAnswerMode: (v: string) => void;
  attachedFiles: any[];
  onRemoveFile: (id: string) => void;
  onOpenGuidePanel: () => void;
};

const Rightbar: React.FC<RightbarProps> = ({
  model,
  setModel,
  modelList,
  runMode,
  setRunMode,
  answerMode,
  setAnswerMode,
  attachedFiles,
  onRemoveFile,
  // removed unused props
  onOpenGuidePanel,
}) => {
  return (
    <aside className="iso-rightbar">
      {/* 모델 / 실행 방식 */}
      <div className="iso-main-controls">
        <div className="iso-main-control">
          <label className="iso-label">모델</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
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
            onChange={(e) => setRunMode(e.target.value)}
          >
            <option value="chat">일반 실행 (Chat API)</option>
            <option value="responses">고급 실행 (Responses API)</option>
          </select>
        </div>
      </div>

      {/* 답변 모드 */}
      <div className="iso-main-controls" style={{ marginTop: 4 }}>
        <div className="iso-main-control" style={{ flex: 1 }}>
          <label className="iso-label">답변 모드</label>
          <div
            style={{
              display: "flex",
              gap: 32,
              justifyContent: "center",
              marginTop: 4,
            }}
          >
            <div
              style={{
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
                    answerMode === "strict" ? "#5b21b6" : "#ede9fe",
                  color: answerMode === "strict" ? "#fff" : "#5b21b6",
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
                  fontSize: 13,
                  color:
                    answerMode === "strict" ? "#5b21b6" : "#6b7280",
                  marginTop: 2,
                  fontWeight: 700,
                }}
              >
                실체적 정보만 제공
              </div>
            </div>
            <div
              style={{
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
                    answerMode === "aggressive" ? "#5b21b6" : "#ede9fe",
                  color: answerMode === "aggressive" ? "#fff" : "#5b21b6",
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
                  fontSize: 13,
                  color:
                    answerMode === "aggressive" ? "#5b21b6" : "#6b7280",
                  marginTop: 2,
                  fontWeight: 700,
                }}
              >
                생성형AI 정보 포함
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="iso-main-description">
        ISO/IEC 표준, PWI 26255, TR 25468, 메타버스 LET 등에 대해 질문하면,
        보수형 또는 적극형 모드에 따라 답변합니다.
      </div>

      {/* 첨부파일 미리보기 */}
      {attachedFiles.length > 0 && (
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
          {attachedFiles.map((file) => (
            <span
              key={file.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 6px",
                borderRadius: 999,
                background: "#e5e7eb",
                marginRight: 4,
                marginBottom: 2,
              }}
            >
              {file.name}
              <button
                type="button"
                onClick={() => onRemoveFile(file.id)}
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
      )}

      {/* 가이드 패널 오픈 버튼 */}
      <button
        type="button"
        onClick={onOpenGuidePanel}
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
    </aside>
  );
};

export default Rightbar;
