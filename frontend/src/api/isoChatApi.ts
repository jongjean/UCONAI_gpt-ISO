// src/api/isoChatApi.ts
import { Message, Guide } from "../types/isoApp";

const API_BASE = "/api";

export async function fetchModels() {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error("모델 목록 조회 실패");
  const data = await res.json();
  return data.models as { id: string; label: string }[];
}

export type IsoChatPayload = {
  message: string;
  model: string;
  runMode: "chat" | "responses";
  answerMode: "strict" | "aggressive";
  messages: Message[];
  globalGuides: Array<Pick<Guide, "id" | "title" | "content">>;
  convGuides: Array<Pick<Guide, "id" | "title" | "content">>;
};

export async function requestIsoChat(payload: IsoChatPayload) {
  const res = await fetch(`${API_BASE}/iso-chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "ISO API error");
  }
  return res.json();
}
