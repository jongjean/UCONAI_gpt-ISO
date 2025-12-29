// src/types/isoChat.ts

// 모델 / 실행 모드 / 답변 모드
export type ModelOption = string;
export type RunMode = "chat" | "responses";
export type AnswerMode = "strict" | "aggressive";

// 채팅 메시지
export type MessageRole = "user" | "assistant";

// 첨부 메타(서버 응답 기준)
export interface MessageAttachment {
  id: string;
  fileName: string;
  fileSize: number | null;
  mimeType?: string | null;
  storageKey: string;
  downloadUrl?: string;
}

export interface Message {
  id?: string;
  role: MessageRole;
  content: string;
  createdAt?: string;
  attachments?: MessageAttachment[];
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
  fileName: string;
  fileSize: number | null;
  mimeType?: string | null;
  storageKey?: string;
  downloadUrl?: string;
  createdAt?: string;
  file?: File; // 업로드 전 임시 보관용
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

// ISO Chat API 요청/응답 타입
export interface IsoChatPayload {
  message: string;
  model: ModelOption;
  runMode: RunMode;
  answerMode: AnswerMode;
  messages: { role: string; content: string }[];
  globalGuides?: { id: string; title: string; content: string }[];
  convGuides?: { id: string; title: string; content: string }[];
  accessToken?: string;
}

export interface IsoChatResponse {
  reply: {
    content: string;
  } | string;
  content?: string;
}
