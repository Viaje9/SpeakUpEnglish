const STORAGE_KEY = "speakup_history";

export interface HistoryRecord {
  id: string;
  timestamp: number;
  summary: string;
}

export function loadHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecord(summary: string): HistoryRecord {
  const record: HistoryRecord = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    summary,
  };
  const records = loadHistory();
  records.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  return record;
}

export function deleteRecord(id: string) {
  const records = loadHistory().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
