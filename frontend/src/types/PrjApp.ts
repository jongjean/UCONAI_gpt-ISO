// src/types/PrjApp.ts
// UCONAI_* 공통으로 재사용 가능한 기본 타입 정의

export type ModelOption = string;
export type RunMode = "chat" | "responses";
export type AnswerMode = "strict" | "aggressive";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
};

// 가이드에 첨부되는 파일 메타 정보
export type GuideFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;         // 추후 MinIO/S3 업로드 후 URL 저장용
  createdAt: string;
};

// 프로젝트 공통 / 대화방별 지침
export type Guide = {
  id: string;
  scope: "global" | "conversation";
  conversationId?: string;
  title: string;
  content: string;
  files: GuideFile[];
  createdAt: string;
  updatedAt: string;
};

// 채팅창에서 사용하는 임시 첨부 파일
export type AttachedFile = {
  id: string;
  name: string;
  file: File;
};
