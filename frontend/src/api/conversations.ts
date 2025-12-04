// src/api/conversations.ts
import { apiClient } from "./client";
import { Conversation } from "../types/isoChat";

type ConversationResponse = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
};

export async function fetchConversations(): Promise<Conversation[]> {
  const res = await apiClient.get<ConversationResponse[]>(
    "/ucon/iso/conversations"
  );
  return res.data.map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    messages: [],
  }));
}

export async function createConversation(title: string): Promise<Conversation> {
  const res = await apiClient.post<ConversationResponse>(
    "/ucon/iso/conversations",
    { title }
  );
  const c = res.data;
  return { id: c.id, title: c.title, createdAt: c.createdAt, messages: [] };
}

export async function updateConversation(
  id: string,
  title: string
): Promise<ConversationResponse> {
  const res = await apiClient.patch<ConversationResponse>(
    `/ucon/iso/conversations/${id}`,
    { title }
  );
  return res.data;
}

export async function deleteConversation(id: string): Promise<void> {
  await apiClient.delete(`/ucon/iso/conversations/${id}`);
}
