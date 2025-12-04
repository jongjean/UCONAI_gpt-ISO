// src/api/iso.ts
import { apiClient } from "./client";

export async function getIsoHealth() {
  const res = await apiClient.get("/healthz");
  return res.data;
}

export async function sendIsoChat(message: string) {
  const res = await apiClient.post("/api/iso-chat", { message });
  return res.data;
}
