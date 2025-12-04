// src/api/guides.ts
import { apiClient } from "./client";
import { Guide, GuideFile } from "../types/isoChat";

export async function fetchGlobalGuides() {
  const res = await apiClient.get<Guide[]>("/ucon/iso/guides/global");
  return res.data;
}

export async function fetchRoomGuides(conversationId: string) {
  const res = await apiClient.get<Guide[]>(
    `/ucon/iso/guides/room/${conversationId}`
  );
  return res.data;
}

export async function createGuide(
  scope: "global" | "conversation",
  payload: { title: string; content: string; conversationId?: string; files?: GuideFile[] }
) {
  if (scope === "global") {
    const res = await apiClient.post<Guide>("/ucon/iso/guides/global", {
      title: payload.title,
      content: payload.content,
      files: payload.files,
    });
    return res.data;
  }
  if (!payload.conversationId) {
    throw new Error("conversationId is required for conversation guide");
  }
  const res = await apiClient.post<Guide>(
    `/ucon/iso/guides/room/${payload.conversationId}`,
    {
      title: payload.title,
      content: payload.content,
      files: payload.files,
    }
  );
  return res.data;
}

export async function updateGuide(
  scope: "global" | "conversation",
  id: string,
  payload: { title?: string; content?: string; conversationId?: string; files?: GuideFile[] }
) {
  if (scope === "global") {
    const res = await apiClient.put<Guide>(`/ucon/iso/guides/global/${id}`, {
      title: payload.title,
      content: payload.content,
      files: payload.files,
    });
    return res.data;
  }
  if (!payload.conversationId) {
    throw new Error("conversationId is required for conversation guide");
  }
  const res = await apiClient.put<Guide>(
    `/ucon/iso/guides/room/${payload.conversationId}/${id}`,
    {
      title: payload.title,
      content: payload.content,
      files: payload.files,
    }
  );
  return res.data;
}

export async function deleteGuide(
  scope: "global" | "conversation",
  id: string,
  conversationId?: string
) {
  if (scope === "global") {
    await apiClient.delete(`/ucon/iso/guides/global/${id}`);
    return;
  }
  if (!conversationId) {
    throw new Error("conversationId is required for conversation guide");
  }
  await apiClient.delete(`/ucon/iso/guides/room/${conversationId}/${id}`);
}
