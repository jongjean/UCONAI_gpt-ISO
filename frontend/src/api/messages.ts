// src/api/messages.ts
import { apiClient } from "./client";
import { Message, MessageAttachment } from "../types/isoChat";

type MessageResponse = {
  id: string;
  conversationId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
  updatedAt?: string;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileSize: number | null;
    mimeType?: string | null;
    storageKey: string;
    downloadUrl?: string;
  }>;
};

const toClientMessage = (m: MessageResponse): Message => ({
  id: m.id,
  role: m.role.toLowerCase() as Message["role"],
  content: m.content,
   createdAt: m.createdAt,
  attachments: (m.attachments || []).map<MessageAttachment>((a) => ({
    ...a,
  })),
});

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const res = await apiClient.get<MessageResponse[]>("/ucon/iso/messages", {
    params: { conversationId },
  });
  return res.data.map(toClientMessage);
}

export async function createMessage(
  conversationId: string,
  role: Message["role"],
  content: string
): Promise<Message> {
  const payload = {
    conversationId,
    role: role.toUpperCase(),
    content,
  };
  const res = await apiClient.post<MessageResponse>("/ucon/iso/messages", payload);
  return toClientMessage(res.data);
}
