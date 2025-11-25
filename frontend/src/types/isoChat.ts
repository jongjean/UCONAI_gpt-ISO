// src/types/isoChat.ts

// 모델 / 실행 모드 / 답변 모드
export type ModelOption = string;
export type RunMode = "chat" | "responses";
export type AnswerMode = "strict" | "aggressive";

// 채팅 메시지
export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

// 테마(대화방)
export interface Conversation {
  id: string;
  title: string;
  createdAt: string;      // new Date().toLocaleString("ko-KR")
  messages: Message[];
}

// 지침에 첨부되는 파일 메타데이터
export interface GuideFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;            // 나중에 MinIO/S3 URL 등으로 사용 예정
  createdAt: string;
}

// 지침/가이드
export type GuideScope = "global" | "conversation";

export interface Guide {
  id: string;
  scope: GuideScope;
  conversationId?: string; // scope === "conversation" 인 경우에만 사용
  title: string;
  content: string;
  files: GuideFile[];
  createdAt: string;
  updatedAt: string;
}

// 채팅 입력창에 붙는 첨부파일(실제 File 객체)
export interface AttachedFile {
  id: string;
  name: string;
  file: File;
}
