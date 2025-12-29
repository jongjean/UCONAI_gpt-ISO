import { Message } from "../types/isoChat";

const MESSAGES_KEY_PREFIX = "iso_messages_";

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const key = `${MESSAGES_KEY_PREFIX}${conversationId}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : [];
}

// App.tsx에서 사용하는 형태: addMessage(conversationId, role, content)
export async function addMessage(
  conversationId: string,
  roleOrMessage: string | Message,
  content?: string
): Promise<Message> {
  const messages = await fetchMessages(conversationId);
  
  let newMessage: Message;
  
  if (typeof roleOrMessage === 'string') {
    // addMessage(conversationId, role, content) 형태
    const now = new Date().toISOString();
    newMessage = {
      id: Date.now().toString(),
      role: roleOrMessage as "user" | "assistant",
      content: content || "",
      createdAt: now,  // timestamp → createdAt
    };
  } else {
    // addMessage(conversationId, message) 형태
    newMessage = roleOrMessage;
  }
  
  messages.push(newMessage);
  localStorage.setItem(`${MESSAGES_KEY_PREFIX}${conversationId}`, JSON.stringify(messages));
  return newMessage;
}

export async function updateMessage(
  conversationId: string,
  messageId: string,
  updates: Partial<Message>
): Promise<Message> {
  const messages = await fetchMessages(conversationId);
  const index = messages.findIndex(m => m.id === messageId);
  if (index === -1) throw new Error("Message not found");
  
  messages[index] = { ...messages[index], ...updates };
  localStorage.setItem(`${MESSAGES_KEY_PREFIX}${conversationId}`, JSON.stringify(messages));
  return messages[index];
}

export async function deleteMessage(conversationId: string, messageId: string): Promise<void> {
  const messages = await fetchMessages(conversationId);
  const filtered = messages.filter(m => m.id !== messageId);
  localStorage.setItem(`${MESSAGES_KEY_PREFIX}${conversationId}`, JSON.stringify(filtered));
}

export async function clearMessages(conversationId: string): Promise<void> {
  localStorage.removeItem(`${MESSAGES_KEY_PREFIX}${conversationId}`);
}
