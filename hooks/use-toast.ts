"use client";
import * as React from "react";

type ToastVariant = "default" | "destructive" | "success";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  open?: boolean;
}

interface ToastState {
  toasts: Toast[];
}

const TOAST_LIMIT = 3;
const REMOVE_DELAY = 4000;

type Action =
  | { type: "ADD"; toast: Toast }
  | { type: "DISMISS"; id: string }
  | { type: "REMOVE"; id: string };

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const listeners: Array<(state: ToastState) => void> = [];
let memoryState: ToastState = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

function reducer(state: ToastState, action: Action): ToastState {
  switch (action.type) {
    case "ADD":
      return { toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case "DISMISS":
      return { toasts: state.toasts.map((t) => t.id === action.id ? { ...t, open: false } : t) };
    case "REMOVE":
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
  }
}

export function toast({ title, description, variant = "default" }: Omit<Toast, "id">) {
  const id = genId();
  dispatch({ type: "ADD", toast: { id, title, description, variant, open: true } });
  setTimeout(() => {
    dispatch({ type: "DISMISS", id });
    setTimeout(() => dispatch({ type: "REMOVE", id }), 300);
  }, REMOVE_DELAY);
  return id;
}

export function useToast() {
  const [state, setState] = React.useState<ToastState>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const idx = listeners.indexOf(setState);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);
  return state;
}
