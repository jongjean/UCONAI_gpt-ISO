import { Guide } from "../types/isoChat";

const GLOBAL_KEY = "iso_global_guides";
const ROOM_KEY_PREFIX = "iso_room_guides_";

export async function fetchGlobalGuides(): Promise<Guide[]> {
  const stored = localStorage.getItem(GLOBAL_KEY);
  return stored ? JSON.parse(stored) : [];
}

export async function fetchRoomGuides(conversationId: string): Promise<Guide[]> {
  const stored = localStorage.getItem(`${ROOM_KEY_PREFIX}${conversationId}`);
  return stored ? JSON.parse(stored) : [];
}

export async function createGuide(
  _scope: "global" | "conversation",
  data: { title: string; content: string; conversationId?: string }
): Promise<Guide> {
  const { title, content, conversationId } = data;
  const key = conversationId ? `${ROOM_KEY_PREFIX}${conversationId}` : GLOBAL_KEY;
  const guides = JSON.parse(localStorage.getItem(key) || "[]");
  
  const now = new Date().toISOString();
  const newGuide: Guide = {
    id: Date.now().toString(),
    title,
    content,
    scope: conversationId ? "conversation" : "global",
    conversationId,
    files: [],
    createdAt: now,
    updatedAt: now,
  };
  
  guides.push(newGuide);
  localStorage.setItem(key, JSON.stringify(guides));
  return newGuide;
}

export async function updateGuide(
  _scope: "global" | "conversation",
  id: string,
  data: { title?: string; content?: string; conversationId?: string }
): Promise<Guide> {
  const { conversationId, ...updates } = data;
  const key = conversationId ? `${ROOM_KEY_PREFIX}${conversationId}` : GLOBAL_KEY;
  const guides = JSON.parse(localStorage.getItem(key) || "[]");
  
  const index = guides.findIndex((g: Guide) => g.id === id);
  if (index === -1) throw new Error("Guide not found");
  
  guides[index] = { 
    ...guides[index], 
    ...updates,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(key, JSON.stringify(guides));
  return guides[index];
}

export async function deleteGuide(
  _scope: "global" | "conversation",
  id: string,
  conversationId?: string
): Promise<void> {
  const key = conversationId ? `${ROOM_KEY_PREFIX}${conversationId}` : GLOBAL_KEY;
  const guides = JSON.parse(localStorage.getItem(key) || "[]");
  const filtered = guides.filter((g: Guide) => g.id !== id);
  localStorage.setItem(key, JSON.stringify(filtered));
}

export async function reorderGlobalGuides(guideIds: string[]): Promise<void> {
  const guides = await fetchGlobalGuides();
  const reordered = guideIds
    .map(id => guides.find(g => g.id === id))
    .filter(Boolean) as Guide[];
  localStorage.setItem(GLOBAL_KEY, JSON.stringify(reordered));
}

export async function reorderRoomGuides(conversationId: string, guideIds: string[]): Promise<void> {
  const guides = await fetchRoomGuides(conversationId);
  const reordered = guideIds
    .map(id => guides.find(g => g.id === id))
    .filter(Boolean) as Guide[];
  localStorage.setItem(`${ROOM_KEY_PREFIX}${conversationId}`, JSON.stringify(reordered));
}
