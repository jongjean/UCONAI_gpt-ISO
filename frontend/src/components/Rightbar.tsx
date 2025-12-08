import React from "react";
import { PendingUser } from "../api/admin";
import { AuthUser } from "../api/auth";

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
  authUser: AuthUser | null;
  authStatus: string | null;
  onLogin: (email: string, password: string, otp?: string) => void;
  onRegister: (email: string, password: string) => void;
  onLogout: () => void;
  loginInputRef?: React.RefObject<HTMLInputElement>;
  pendingUsers: PendingUser[];
  pendingLoading: boolean;
  pendingError: string | null;
  pendingActionIds: string[];
  pendingUiState: Record<string, "default" | "approved" | "hold">;
  onReloadPending: () => void;
  onApprovePendingUser: (id: string) => void;
  onHoldPendingUser: (id: string) => void;
  onDeletePendingUser: (id: string) => void;
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
  pendingUsers,
  pendingLoading,
  pendingError,
  pendingActionIds,
  pendingUiState,
  onReloadPending,
  onApprovePendingUser,
  onHoldPendingUser,
  onDeletePendingUser,
}) => {
  const [authEmail, setAuthEmail] = React.useState("");
  const [authPassword, setAuthPassword] = React.useState("");
  const [hiddenMessageAttIds, setHiddenMessageAttIds] = React.useState<
    Set<string>
  >(new Set());
  const [authOtp, setAuthOtp] = React.useState("");
  const [adminMode, setAdminMode] = React.useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = React.useState(false);
  const isSuperAdmin = authUser?.role === "SUPER_ADMIN";
  const pendingActionSet = React.useMemo(() => new Set(pendingActionIds), [pendingActionIds]);
  const [adminDeleteTarget, setAdminDeleteTarget] = React.useState<PendingUser | null>(null);
  const storageKey = activeConversationId
    ? `hiddenAtt:${activeConversationId}`
    : null;
  const [confirmTarget, setConfirmTarget] = React.useState<{
    id: string;
    type: "message" | "pending";
  } | null>(null);
  const cancelConfirmRef = React.useRef<HTMLButtonElement | null>(null);
  const deleteConfirmRef = React.useRef<HTMLButtonElement | null>(null);
  const confirmDialogLabelId = React.useId();
  const otpInputRef = React.useRef<HTMLInputElement | null>(null);
  const orderedPendingUsers = React.useMemo(() => {
    if (!pendingUsers?.length) return [] as PendingUser[];
    const superAdmins = pendingUsers
      .filter((user) => user.role === "SUPER_ADMIN")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const others = pendingUsers
      .filter((user) => user.role !== "SUPER_ADMIN")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return [...superAdmins, ...others];
  }, [pendingUsers]);

  const handleConfirmSubmit = React.useCallback(() => {
    if (!confirmTarget) return;
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
  }, [confirmTarget, onRemoveFile]);

  const handleDeleteKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleConfirmSubmit();
    }
  };

  React.useEffect(() => {
    if (confirmTarget) {
      cancelConfirmRef.current?.focus();
    }
  }, [confirmTarget]);

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
      onLogin(authEmail, authPassword, adminMode ? authOtp : undefined);
    }
  };

  React.useEffect(() => {
    if (adminMode) {
      otpInputRef.current?.focus();
    } else {
      setAuthOtp("");
    }
  }, [adminMode]);

  React.useEffect(() => {
    if (authUser) {
      setAdminMode(false);
    }
    if (!isSuperAdmin) {
      setAdminPanelOpen(false);
    }
  }, [authUser, isSuperAdmin]);

  const formatDateTime = React.useCallback((value: string) => {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }, []);

  const getPendingState = React.useCallback(
    (user: PendingUser): "default" | "approved" | "hold" => {
      const explicit = pendingUiState[user.id];
      if (explicit) return explicit;
      if (user.status === "REJECTED") return "hold";
      return "default";
    },
    [pendingUiState]
  );

  const createAdminButtonStyle = React.useCallback(
    (background: string, working: boolean) => ({
      fontSize: 12,
      padding: "4px 10px",
      borderRadius: 8,
      border: "none",
      color: "#f9fafb",
      background,
      cursor: working ? "not-allowed" : "pointer",
      opacity: working ? 0.6 : 1,
    }),
    []
  );

  const renderConfirm = () => {
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
          zIndex: 3000,
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
            width: 260,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            outline: "none",
          }}
        >
          <div
            id={confirmDialogLabelId}
            style={{ fontWeight: 700, marginBottom: 12 }}
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
              onKeyDown={handleDeleteKeyDown}
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

  const renderAdminDeleteConfirm = () => {
    if (!adminDeleteTarget) return null;
    const working = pendingActionSet.has(adminDeleteTarget.id);

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 4001,
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !working) {
            setAdminDeleteTarget(null);
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          style={{
            background: "#1f2937",
            borderRadius: 12,
            padding: 18,
            width: 280,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            border: "1px solid #4b5563",
            boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f9fafb" }}>삭제하시겠습니까?</div>
          <div style={{ fontSize: 12, color: "#e5e7eb" }}>
            <div>이 계정을 삭제하면 복구할 수 없습니다.</div>
            <div style={{ marginTop: 6, wordBreak: "break-all" }}>
              대상: <strong>{adminDeleteTarget.email}</strong>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              disabled={working}
              onClick={() => setAdminDeleteTarget(null)}
              style={{
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #4b5563",
                background: "transparent",
                color: "#e5e7eb",
                cursor: working ? "not-allowed" : "pointer",
                opacity: working ? 0.6 : 1,
              }}
            >
              취소
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => {
                onDeletePendingUser(adminDeleteTarget.id);
                setAdminDeleteTarget(null);
              }}
              style={{
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                background: "#ef4444",
                color: "#f9fafb",
                cursor: working ? "not-allowed" : "pointer",
                opacity: working ? 0.6 : 1,
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
          {(isSuperAdmin && authUser) || !authUser ? (
            <div className="iso-rightbar-title-actions">
              {!authUser && (
                <button
                  type="button"
                  onClick={() => setAdminMode((prev) => !prev)}
                  aria-pressed={adminMode}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 8,
                    border: "1px solid #4b5563",
                    background: adminMode ? "#1f2937" : "transparent",
                    color: "#e5e7eb",
                    cursor: "pointer",
                  }}
                >
                  OTP
                </button>
              )}
              {isSuperAdmin && authUser && (
                <button
                  type="button"
                  onClick={() => setAdminPanelOpen(true)}
                  style={{
                    background: "transparent",
                    border: "1px solid #4b5563",
                    borderRadius: 8,
                    fontSize: 12,
                    padding: "4px 10px",
                    color: "#e5e7eb",
                    cursor: "pointer",
                  }}
                >
                  관리자
                </button>
              )}
            </div>
          ) : null}
          {authUser ? (
            <div style={{ fontSize: 12, color: "#e5e7eb", display: "flex", flexDirection: "column", gap: 6 }}>
              <div>사용자: <strong>{authUser.email}</strong></div>
              <button
                type="button"
                className="iso-submit-btn"
                style={{ background: "#ef4444", alignSelf: "flex-start" }}
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
              {adminMode && (
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="OTP 6자리"
                  value={authOtp}
                  onChange={(e) => setAuthOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={handleAuthKeyDown}
                  ref={otpInputRef}
                  style={{ padding: 6, borderRadius: 6, border: "1px solid #374151", background: "#111827", color: "#e5e7eb" }}
                />
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="iso-submit-btn"
                  onClick={() => onLogin(authEmail, authPassword, adminMode ? authOtp : undefined)}
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
              {adminMode && (
                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  관리자 계정은 OTP 입력 후 로그인을 완료합니다.
                </div>
              )}
              {authStatus && (
                <div style={{ fontSize: 11, color: "#fca5a5" }}>{authStatus}</div>
              )}
            </div>
          )}
        </div>
        </div>

        {isSuperAdmin && adminPanelOpen && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 4000,
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setAdminPanelOpen(false);
              }
            }}
          >
            <div
              style={{
                width: "min(520px, 90vw)",
                maxHeight: "80vh",
                overflowY: "auto",
                background: "#1f2937",
                borderRadius: 12,
                border: "1px solid #4b5563",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f9fafb" }}>
                  (관리자모드) 사용자 현황
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={onReloadPending}
                    disabled={pendingLoading}
                    style={{
                      fontSize: 12,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #4b5563",
                      background: "transparent",
                      color: pendingLoading ? "#6b7280" : "#e5e7eb",
                      cursor: pendingLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    새로고침
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminPanelOpen(false)}
                    style={{
                      fontSize: 12,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #4b5563",
                      background: "transparent",
                      color: "#e5e7eb",
                    }}
                  >
                    닫기
                  </button>
                </div>
              </div>
              {pendingError && (
                <div style={{ fontSize: 12, color: "#fca5a5" }}>{pendingError}</div>
              )}
              {pendingLoading ? (
                <div style={{ fontSize: 13, color: "#9ca3af" }}>승인 대기 목록을 불러오는 중...</div>
              ) : pendingUsers.length === 0 ? (
                <div style={{ fontSize: 13, color: "#9ca3af" }}>승인 대기 중인 사용자가 없습니다.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {orderedPendingUsers.map((user) => {
                    const working = pendingLoading || pendingActionSet.has(user.id);
                    const state = getPendingState(user);
                    const approveStyle = createAdminButtonStyle("#5b21b6", working);
                    const holdStyle = createAdminButtonStyle("#374151", working);
                    const deleteStyle = createAdminButtonStyle("#ef4444", working);
                    const isProtectedSuperAdmin = user.role === "SUPER_ADMIN";

                    const statusMessage =
                      state === "approved"
                        ? { text: "승인되었습니다.", color: "#c4b5fd" }
                        : state === "hold"
                        ? { text: "승인 보류 상태입니다.", color: "#facc15" }
                        : null;

                    return (
                      <div
                        key={user.id}
                        style={{
                          border: "1px solid #4b5563",
                          borderRadius: 10,
                          padding: 12,
                          background: "#111827",
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontWeight: 600, color: "#f9fafb" }}>{user.email}</span>
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>
                            요청일: {formatDateTime(user.createdAt)}
                          </span>
                          {user.role && (
                            <span style={{ fontSize: 12, color: "#9ca3af" }}>
                              요청 권한: {user.role}
                            </span>
                          )}
                          {isProtectedSuperAdmin ? (
                            <span style={{ fontSize: 12, color: "#f97316" }}>
                              최고관리자 계정은 수정할 수 없습니다.
                            </span>
                          ) : statusMessage ? (
                            <span style={{ fontSize: 12, color: statusMessage.color }}>
                              {statusMessage.text}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: "#9ca3af" }}>승인 대기 중입니다.</span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", alignItems: "center" }}>
                          {!isProtectedSuperAdmin && (
                            <>
                              {state === "approved" && (
                                <button
                                  type="button"
                                  style={holdStyle}
                                  disabled={working}
                                  onClick={() => onHoldPendingUser(user.id)}
                                >
                                  승인 보류
                                </button>
                              )}
                              {state === "hold" && (
                                <button
                                  type="button"
                                  style={approveStyle}
                                  disabled={working}
                                  onClick={() => onApprovePendingUser(user.id)}
                                >
                                  다시 승인
                                </button>
                              )}
                              {state === "default" && (
                                <button
                                  type="button"
                                  style={approveStyle}
                                  disabled={working}
                                  onClick={() => onApprovePendingUser(user.id)}
                                >
                                  승인
                                </button>
                              )}
                              <button
                                type="button"
                                style={deleteStyle}
                                disabled={working}
                                onClick={() => !working && setAdminDeleteTarget(user)}
                              >
                                삭제
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      {renderConfirm()}
      {renderAdminDeleteConfirm()}
    </aside>
  );
};

export default Rightbar;
