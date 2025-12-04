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
  activeConversationId: string | null;
  commonGuideFiles: { id: string; fileName: string; downloadUrl?: string }[];
  roomGuideFiles: { id: string; fileName: string; downloadUrl?: string }[];
  messageAttachments: { id: string; fileName: string; downloadUrl?: string }[];
  onRemoveFile: (id: string) => void;
  authUser: { id: string; email: string } | null;
  authStatus: string | null;
  onLogin: (email: string, password: string) => void;
  onRegister: (email: string, password: string) => void;
  onLogout: () => void;
  loginInputRef?: React.RefObject<HTMLInputElement>;
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
  activeConversationId,
  commonGuideFiles,
  roomGuideFiles,
  messageAttachments,
  onRemoveFile,
  authUser,
  authStatus,
  onLogin,
  onRegister,
  onLogout,
  loginInputRef,
}) => {
  const [authEmail, setAuthEmail] = React.useState("");
  const [authPassword, setAuthPassword] = React.useState("");
  const [hiddenMessageAttIds, setHiddenMessageAttIds] = React.useState<
    Set<string>
  >(new Set());
  const storageKey = activeConversationId
    ? `hiddenAtt:${activeConversationId}`
    : null;
  const [confirmTarget, setConfirmTarget] = React.useState<{
    id: string;
    type: "message" | "pending";
  } | null>(null);

  // 대화방 전환 시 숨김 상태 로드
  React.useEffect(() => {
    if (!storageKey) {
      setHiddenMessageAttIds(new Set());
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setHiddenMessageAttIds(new Set());
        return;
      }
      const parsed = JSON.parse(raw);
      setHiddenMessageAttIds(new Set(Array.isArray(parsed) ? parsed : []));
    } catch {
      setHiddenMessageAttIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // 숨김 상태 저장
  React.useEffect(() => {
    if (!storageKey) return;
    const arr = Array.from(hiddenMessageAttIds);
    localStorage.setItem(storageKey, JSON.stringify(arr));
  }, [hiddenMessageAttIds, storageKey]);

  const handleAuthKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onLogin(authEmail, authPassword);
    }
  };

  const renderConfirm = () => {
    if (!confirmTarget) return null;
    const onConfirm = () => {
      if (confirmTarget.type === "message") {
        setHiddenMessageAttIds((prev) => {
          const next = new Set(prev);
          next.add(confirmTarget.id);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("hiddenAttUpdated"));
          }
          return next;
        });
      } else {
        onRemoveFile(confirmTarget.id);
      }
      setConfirmTarget(null);
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
          zIndex: 3000,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 16,
            width: 260,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 12 }}>삭제하시겠습니까?</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
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
              onClick={onConfirm}
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

  const renderFileRow = (
    key: string,
    name: string,
    downloadUrl?: string,
    removable?: { type: "message" | "pending" },
    hidden?: boolean
  ) => {
    return (
      <div
        key={key}
        className="iso-file-row"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
      >
        <span className="iso-file-name" style={{ flex: 1, minWidth: 0 }}>
          {hidden ? "삭제됨" : name}
        </span>
        {!hidden && downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="iso-file-link"
          >
            보기
          </a>
        )}
        {removable && !hidden && (
          <button
            type="button"
            aria-label="파일 숨기기"
            onClick={() => setConfirmTarget({ id: key, type: removable.type })}
            style={{
              border: 0,
              background: "transparent",
              color: "#9ca3af",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <aside className="iso-rightbar">
      <div className="iso-rightbar-header">대화 설정 / 기능 / DB</div>

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
                생성형 AI 답변
              </div>
            </div>
          </div>
        </div>

        {/* 첨부 파일 요약 */}
        <div className="iso-rightbar-section">
          <div className="iso-rightbar-section-title">첨부 파일</div>

          {/* 통합공용 첨부파일 */}
          <div style={{ marginBottom: 10 }}>
            <div className="iso-rightbar-subtitle">통합공용</div>
            {commonGuideFiles.length === 0 ? (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>없음</div>
            ) : (
              <div className="iso-rightbar-files">
                {commonGuideFiles.map((f) => (
                  <div
                    key={f.id}
                    className="iso-file-row"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                  >
                    <span className="iso-file-name" style={{ flex: 1, minWidth: 0 }}>{f.fileName}</span>
                    {f.downloadUrl && (
                      <a
                        href={f.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="iso-file-link"
                      >
                        보기
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 테마전용 첨부파일 */}
          <div style={{ marginBottom: 10 }}>
            <div className="iso-rightbar-subtitle">테마전용</div>
            {roomGuideFiles.length === 0 ? (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>없음</div>
            ) : (
              <div className="iso-rightbar-files">
                {roomGuideFiles.map((f) => (
                  <div
                    key={f.id}
                    className="iso-file-row"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
                  >
                    <span className="iso-file-name" style={{ flex: 1, minWidth: 0 }}>{f.fileName}</span>
                    {f.downloadUrl && (
                      <a
                        href={f.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="iso-file-link"
                      >
                        보기
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 일시참고 첨부파일 */}
          <div>
            <div className="iso-rightbar-subtitle">일시참고</div>
        {messageAttachments.length === 0 && attachedFiles.length === 0 ? (
          <div style={{ fontSize: 12, color: "#9ca3af" }}>없음</div>
        ) : (
          <div className="iso-rightbar-files">
            {/* 이미 전송된 첨부(읽기전용) */}
        {messageAttachments.map((f) =>
                  renderFileRow(
                    f.id,
                    f.fileName,
                    f.downloadUrl,
                    { type: "message" },
                    hiddenMessageAttIds.has(f.id)
                  )
                )}
            {/* 전송 대기 첨부(현재 attachedFiles) */}
            {attachedFiles.map((file: any) =>
                  renderFileRow(
                    file.id,
                    file.name,
                    undefined,
                    { type: "pending" }
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* 로그인 섹션 */}
        <div className="iso-rightbar-section">
          <div className="iso-rightbar-section-title">로그인</div>
          {authUser ? (
            <div style={{ fontSize: 12, color: "#e5e7eb", display: "flex", flexDirection: "column", gap: 6 }}>
              <div>사용자: <strong>{authUser.email}</strong></div>
              <button
                type="button"
                className="iso-submit-btn"
                style={{ background: "#ef4444" }}
                onClick={onLogout}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                type="email"
                placeholder="이메일"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                onKeyDown={handleAuthKeyDown}
                ref={loginInputRef}
                style={{ padding: 6, borderRadius: 6, border: "1px solid #374151", background: "#111827", color: "#e5e7eb" }}
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={handleAuthKeyDown}
                style={{ padding: 6, borderRadius: 6, border: "1px solid #374151", background: "#111827", color: "#e5e7eb" }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="iso-submit-btn"
                  onClick={() => onLogin(authEmail, authPassword)}
                >
                  로그인
                </button>
                <button
                  type="button"
                  className="iso-submit-btn"
                  style={{ background: "#2563eb" }}
                  onClick={() => onRegister(authEmail, authPassword)}
                >
                  회원가입
                </button>
              </div>
              {authStatus && (
                <div style={{ fontSize: 11, color: "#fca5a5" }}>{authStatus}</div>
              )}
            </div>
          )}
        </div>
        </div>
      {renderConfirm()}
    </aside>
  );
};

export default Rightbar;
