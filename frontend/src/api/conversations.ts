import { Conversation } from "../types/isoChat";

const STORAGE_KEY = "iso_conversations";

export async function fetchConversations(): Promise<Conversation[]> {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export async function createConversation(title: string): Promise<Conversation> {
  const conversations = await fetchConversations();
  const newConv: Conversation = {
    id: Date.now().toString(),
    title,
    messages: [],
    createdAt: new Date().toISOString(),
  };
  conversations.push(newConv);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  return newConv;
}

export async function updateConversation(
  id: string,
  updates: Partial<Conversation>
): Promise<Conversation> {
  const conversations = await fetchConversations();
  const index = conversations.findIndex((c) => c.id === id);
  if (index === -1) throw new Error("Conversation not found");
  
  conversations[index] = { ...conversations[index], ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  return conversations[index];
}

export async function deleteConversation(id: string): Promise<void> {
  const conversations = await fetchConversations();
  const filtered = conversations.filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export async function reorderConversations(conversationIds: string[]): Promise<void> {
  const conversations = await fetchConversations();
  const reordered = conversationIds
    .map(id => conversations.find(c => c.id === id))
    .filter(Boolean) as Conversation[];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reordered));
}
