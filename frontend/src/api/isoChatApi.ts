// src/api/isoChatApi.ts
import { Message, Guide } from "../types/isoApp";

// Prefer environment variable, fallback to same-origin /api
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export async function fetchModels() {
  // 백엔드에 /models 엔드포인트가 없으므로 정적 목록 반환
  return [
    { id: "gpt-5.1", label: "gpt-5.1" },
    { id: "gpt-4o-mini", label: "gpt-4o-mini" },
  ];
}

export type IsoChatPayload = {
  message: string;
  model: string;
  runMode: "chat" | "responses";
  answerMode: "strict" | "aggressive";
  messages: Message[];
  globalGuides: Array<Pick<Guide, "id" | "title" | "content">>;
  convGuides: Array<Pick<Guide, "id" | "title" | "content">>;
  accessToken?: string;
};

export async function requestIsoChat(payload: IsoChatPayload) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (payload.accessToken) {
    headers["Authorization"] = `Bearer ${payload.accessToken}`;
  }

  const res = await fetch(`${API_BASE}/iso-chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "ISO API error");
  }
  return res.json();
}
