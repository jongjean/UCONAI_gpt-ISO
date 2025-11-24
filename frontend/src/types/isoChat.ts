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

export type GuideFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  createdAt: string;
};

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

export type AttachedFile = {
  id: string;
  name: string;
  file: File;
};
