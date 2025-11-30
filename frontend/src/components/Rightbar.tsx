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
}) => {
  return (
    <aside className="iso-rightbar">
      <div className="iso-rightbar-header">대화 설정 / 기능</div>

      <div className="iso-rightbar-main">
        {/* 모델 / 실행 방식 설정 */}
        <div className="iso-rightbar-section">
          <div className="iso-rightbar-section-title">모델 / 실행 방식</div>
          <div className="iso-main-controls" style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="iso-main-control">
              <label className="iso-label">모델 선택</label>
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
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            ISO 전용 서버(WSL2/Docker)에서 지정한 모델과 실행 모드를 사용합니다.
          </div>
        </div>

        {/* 답변 모드 설정 */}
        <div className="iso-rightbar-section">
          <div className="iso-rightbar-section-title">답변 모드</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <button
                type="button"
                className={"iso-answer-btn" + (answerMode === "strict" ? " active" : "")}
                onClick={() => setAnswerMode("strict")}
                style={{
                  borderRadius: 999,
                  fontWeight: 600,
                  padding: "6px 18px",
                  background: answerMode === "strict" ? "#5b21b6" : "#111827",
                  color: answerMode === "strict" ? "#fff" : "#e5e7eb",
                  border: 0,
                  fontSize: 13,
                  minWidth: 80,
                  transition: "background 0.2s, color 0.2s",
                }}
              >
                보수형
              </button>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "center" }}>
                근거중심 AI 답변
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <button
                type="button"
                className={"iso-answer-btn" + (answerMode === "aggressive" ? " active" : "")}
                onClick={() => setAnswerMode("aggressive")}
                style={{
                  borderRadius: 999,
                  fontWeight: 600,
                  padding: "6px 18px",
                  background: answerMode === "aggressive" ? "#5b21b6" : "#111827",
                  color: answerMode === "aggressive" ? "#fff" : "#e5e7eb",
                  border: 0,
                  fontSize: 13,
                  minWidth: 80,
                  transition: "background 0.2s, color 0.2s",
                }}
              >
                적극형
              </button>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "center" }}>
                GPT-AI 답번제공
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
              {attachedFiles.map((file: any) => (
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
        </div>
      </div>
    </aside>
  );
};

export default Rightbar;
