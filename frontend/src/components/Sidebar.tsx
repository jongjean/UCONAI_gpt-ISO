console.log("BUILD_VERSION: 2025-12-04- 최신반영");

import React, { useEffect, useRef, useState } from "react";
import { Conversation } from "../types/isoChat";

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  editingConvId: string | null;
  editingTitle: string;
  onEditTitleStart: (conv: Conversation) => void;
  onEditTitleSave: (id: string) => void;
  setEditingTitle: (title: string) => void;
  setEditingConvId: (id: string | null) => void;
  onOpenGuidePanel: () => void;
  onReorderConversations?: (from: number, to: number) => void;
  isAuthed: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  editingConvId,
  editingTitle,
  onEditTitleStart,
  onEditTitleSave,
  setEditingTitle,
  setEditingConvId,
  onOpenGuidePanel,
  onReorderConversations,
  isAuthed,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    e.preventDefault();
    setHoverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (
      dragIndex === null ||
      dragIndex === index ||
      !onReorderConversations ||
      conversations.length < 2
    ) {
      setDragIndex(null);
      setHoverIndex(null);
      return;
    }
    onReorderConversations(dragIndex, index);
    setDragIndex(null);
    setHoverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setHoverIndex(null);
  };

  useEffect(() => {
    if (!editingConvId) return;
    const handler = requestAnimationFrame(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
      }
    });
    return () => cancelAnimationFrame(handler);
  }, [editingConvId]);

  return (
    <aside className="iso-sidebar">
      <div className="iso-sidebar-header">
        <div className="iso-sidebar-title">UCONAI gpt-ISO Expert</div>
        <div className="iso-sidebar-sub">
          ISO/IEC JTC 1 SC 36 · IS 26255 · TR 25468 국제 표준 작업 전용 어시스턴트
        </div>
        <button
          className="iso-sidebar-new-btn"
          type="button"
          onClick={onNewConversation}
        >
          + 새 테마
        </button>
      </div>

      <div className="iso-sidebar-section theme-list">
        <div className="iso-sidebar-section-title">테마 목록</div>
        <ul className="iso-sidebar-conv-list">
          {conversations.map((c, idx) => (
            <li
              key={c.id}
              className={
                c.id === activeConversationId
                  ? "iso-sidebar-conv-item active"
                  : "iso-sidebar-conv-item"
              }
              draggable={conversations.length > 1}
              onClick={() => onSelectConversation(c.id)}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              style={{
                opacity: dragIndex === idx ? 0.7 : 1,
                background:
                  hoverIndex === idx && dragIndex !== null
                    ? "rgba(79, 70, 229, 0.15)"
                    : undefined,
              }}
            >
              <div style={{ position: "relative", minHeight: 16 }}>
                {conversations.length > 1 && (
                  <button
                    type="button"
                    title="테마 삭제"
                    className="iso-sidebar-conv-xbtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("정말 이 테마를 삭제하시겠습니까?")) {
                        onDeleteConversation(c.id);
                      }
                    }}
                    tabIndex={-1}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        lineHeight: 1,
                        pointerEvents: "none",
                      }}
                    >
                      ×
                    </span>
                  </button>
                )}
                <div
                  className="iso-sidebar-conv-title"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onEditTitleStart(c);
                  }}
                >
                  {editingConvId === c.id ? (
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={editingTitle}
                      autoFocus
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => onEditTitleSave(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onEditTitleSave(c.id);
                        if (e.key === "Escape") {
                          setEditingConvId(null);
                          setEditingTitle("");
                        }
                      }}
                    />
                  ) : (
                    <span>{c.title}</span>
                  )}
                </div>
                <div className="iso-sidebar-conv-meta">
                  {(() => {
                    const dateMatch = c.createdAt.match(
                      /^(\d{4}\. ?\d{1,2}\. ?\d{1,2}\.)/
                    );
                    const timeMatch = c.createdAt.match(
                      /(오전|오후)\s*\d{1,2}:\d{2}/
                    );
                    const date = dateMatch ? dateMatch[1].trim() : "";
                    const time = timeMatch ? timeMatch[0] : "";
                    return (
                      date +
                      (time ? " " + time : "") +
                      " · " +
                      c.messages.length +
                      " 메시지"
                    );
                  })()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 좌측 하단: 지침 / 가이드 섹션 */}
      <div className="iso-sidebar-section guides">
        <div className="iso-sidebar-section-title">지침 / 가이드</div>
        <div className="iso-sidebar-guides-desc">
          공통지침과 테마지침 통합관리
        </div>
        <button
          type="button"
          onClick={() => {
            if (!isAuthed) return;
            onOpenGuidePanel();
          }}
          style={{
            marginTop: 8,
            width: "100%",
            borderRadius: 999,
            border: "1px solid #4b5563",
            background: "transparent",
            color: "#e5e7eb",
            fontSize: 12,
            padding: "6px 10px",
            cursor: isAuthed ? "pointer" : "not-allowed",
            opacity: isAuthed ? 1 : 0.5,
          }}
          aria-disabled={!isAuthed}
        >
          지침 / 가이드 관리
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
