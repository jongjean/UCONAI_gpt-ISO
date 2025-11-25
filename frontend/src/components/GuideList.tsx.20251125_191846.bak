// src/components/GuideList.tsx
import React from "react";
import { Guide } from "../types/isoChat";

export type GuideListProps = {
  guides: Guide[];
  editingGuideId: string | null;
  onCreateGuide: () => void;
  onSelectGuide: (guide: Guide) => void;
  onDeleteGuide: (id: string) => void;

  // 정렬(드래그) 상태 & 핸들러
  dragIndex: number | null;
  hoverIndex: number | null;
  onDragStart: (index: number) => void;
  onDragOver: (index: number, e: React.DragEvent<HTMLLIElement>) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
};

const GuideList: React.FC<GuideListProps> = ({
  guides,
  editingGuideId,
  onCreateGuide,
  onSelectGuide,
  onDeleteGuide,
  dragIndex,
  hoverIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) => {
  return (
    <div
      style={{
        flex: "0 0 260px",
        maxWidth: 300,
        minWidth: 220,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <button
        onClick={onCreateGuide}
        style={{
          alignSelf: "flex-start",
          marginBottom: 8,
          border: 0,
          borderRadius: 8,
          padding: "4px 10px",
          background: "#7c3aed",
          color: "#fff",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        + 새 지침 추가
      </button>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          borderRadius: 8,
          border: "1px solid #1f2937",
          padding: 4,
        }}
      >
        {guides.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "#9ca3af",
              padding: 8,
            }}
          >
            아직 등록된 지침이 없습니다.
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              fontSize: 12,
            }}
          >
            {guides.map((g, idx) => (
              <li
                key={g.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(idx, e)}
                onDrop={() => onDrop(idx)}
                onDragEnd={onDragEnd}
                style={{
                  padding: 6,
                  borderRadius: 6,
                  marginBottom: 4,
                  cursor: "pointer",
                  background:
                    editingGuideId === g.id
                      ? "#1f2937"
                      : hoverIndex === idx && dragIndex !== null
                      ? "#312e81"
                      : "transparent",
                  boxShadow:
                    dragIndex === idx
                      ? "0 0 0 2px #7c3aed, 0 4px 16px rgba(124,58,237,0.10)"
                      : undefined,
                  opacity: dragIndex === idx ? 0.7 : 1,
                  transition:
                    "background 0.15s, box-shadow 0.15s, opacity 0.15s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
                onClick={() => onSelectGuide(g)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {g.title || "(제목 없음)"}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 11,
                      color: "#9ca3af",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                  >
                    {(g.content || "내용 없음").replace(/\s+/g, " ").slice(0, 80)}
                  </div>
                  {g.files && g.files.length > 0 && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 10,
                        color: "#6b7280",
                      }}
                    >
                      파일 {g.files.length}개 첨부
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteGuide(g.id);
                  }}
                  style={{
                    border: 0,
                    background: "none",
                    color: "#f97373",
                    fontSize: 16,
                    cursor: "pointer",
                    marginLeft: 8,
                    alignSelf: "flex-start",
                  }}
                  title="삭제"
                  aria-label="삭제"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default GuideList;
