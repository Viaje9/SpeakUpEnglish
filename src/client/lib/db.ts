import { openDB, type IDBPDatabase } from "idb";
import type { Conversation, StoredMessage, ChatMessage } from "../../shared/types";

const DB_NAME = "speakup";
const DB_VERSION = 1;
const MIGRATION_FLAG = "speakup_idb_migrated";

type SpeakUpDB = IDBPDatabase<{
  conversations: { key: string; value: Conversation; indexes: { timestamp: number } };
  messages: { key: string; value: StoredMessage; indexes: { conversationId: string } };
}>;

let dbPromise: Promise<SpeakUpDB> | null = null;

function getDB(): Promise<SpeakUpDB> {
  if (!dbPromise) {
    dbPromise = openDB<{
      conversations: { key: string; value: Conversation; indexes: { timestamp: number } };
      messages: { key: string; value: StoredMessage; indexes: { conversationId: string } };
    }>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const convStore = db.createObjectStore("conversations", { keyPath: "id" });
        convStore.createIndex("timestamp", "timestamp");

        const msgStore = db.createObjectStore("messages", { keyPath: "id" });
        msgStore.createIndex("conversationId", "conversationId");
      },
    });
  }
  return dbPromise;
}

export async function listConversations(): Promise<Conversation[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("conversations", "timestamp");
  return all.reverse();
}

export async function createConversation(): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const now = Date.now();
  const conv: Conversation = {
    id,
    timestamp: now,
    updatedAt: now,
    summary: null,
    messageCount: 0,
  };
  await db.put("conversations", conv);
  return id;
}

export async function appendMessage(
  convId: string,
  msg: { role: "user" | "assistant" | "summary"; text?: string; audioBase64?: string },
  order: number,
): Promise<void> {
  const db = await getDB();
  const stored: StoredMessage = {
    id: crypto.randomUUID(),
    conversationId: convId,
    order,
    role: msg.role,
    text: msg.text,
    audioBase64: msg.audioBase64,
  };
  const tx = db.transaction(["messages", "conversations"], "readwrite");
  await tx.objectStore("messages").put(stored);

  const conv = await tx.objectStore("conversations").get(convId);
  if (conv) {
    conv.messageCount += 1;
    conv.updatedAt = Date.now();
    await tx.objectStore("conversations").put(conv);
  }
  await tx.done;
}

export async function setSummary(convId: string, summary: string): Promise<void> {
  const db = await getDB();
  const conv = await db.get("conversations", convId);
  if (conv) {
    conv.summary = summary;
    conv.updatedAt = Date.now();
    await db.put("conversations", conv);
  }
}

export async function loadMessages(convId: string): Promise<ChatMessage[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("messages", "conversationId", convId);
  all.sort((a, b) => a.order - b.order);
  return all.map((m) => ({
    role: m.role,
    text: m.text,
    audioBase64: m.audioBase64,
  }));
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["conversations", "messages"], "readwrite");
  await tx.objectStore("conversations").delete(id);

  const msgStore = tx.objectStore("messages");
  const index = msgStore.index("conversationId");
  let cursor = await index.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["conversations", "messages"], "readwrite");
  await tx.objectStore("conversations").clear();
  await tx.objectStore("messages").clear();
  await tx.done;
}

export async function migrateFromLocalStorage(): Promise<void> {
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  try {
    const raw = localStorage.getItem("speakup_history");
    if (!raw) {
      localStorage.setItem(MIGRATION_FLAG, "1");
      return;
    }

    const records: { id: string; timestamp: number; summary: string }[] = JSON.parse(raw);
    if (records.length === 0) {
      localStorage.setItem(MIGRATION_FLAG, "1");
      return;
    }

    const db = await getDB();
    const tx = db.transaction("conversations", "readwrite");
    for (const r of records) {
      const conv: Conversation = {
        id: r.id,
        timestamp: r.timestamp,
        updatedAt: r.timestamp,
        summary: r.summary,
        messageCount: 0,
      };
      await tx.store.put(conv);
    }
    await tx.done;
    localStorage.setItem(MIGRATION_FLAG, "1");
  } catch (e) {
    console.error("Migration from localStorage failed:", e);
  }
}
