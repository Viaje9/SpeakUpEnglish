import { useState, useCallback, useRef } from "react";

export interface Toast {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

let nextId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, type: Toast["type"] = "error") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => dismiss(id), 3500);
    timersRef.current.set(id, timer);
  }, [dismiss]);

  return { toasts, show, dismiss };
}
