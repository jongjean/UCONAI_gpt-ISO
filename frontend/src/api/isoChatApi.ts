import { apiClient } from "./client";
import { IsoChatPayload, IsoChatResponse } from "../types/isoChat";

export async function fetchModels() {
  return [
    { id: "gpt-5.2", label: "🌟 GPT-5.2 (최고급)" },
    { id: "gpt-5.1", label: "💎 GPT-5.1 (안정)" },
    { id: "gpt-5", label: "⭐ GPT-5 (기본)" },
    { id: "o1", label: "🧠 O1 (추론)" },
    { id: "gpt-4o", label: "🥇 GPT-4o (최신)" },
    { id: "gpt-4o-mini", label: "💡 GPT-4o Mini (빠름)" },
    { id: "gpt-4-turbo", label: "⚡ GPT-4 Turbo" },
    { id: "gpt-4", label: "🔧 GPT-4 (안정)" }
  ];
}

export async function requestIsoChat(payload: IsoChatPayload): Promise<IsoChatResponse> {
  const res = await apiClient.post<IsoChatResponse>("/api/iso-chat", payload);
  return res.data;
}
