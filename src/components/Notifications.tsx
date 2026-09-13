"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastItem = { id: number; message: string; tone: "error" | "success" };
type ConfirmState = { message: string; confirmLabel: string; resolve: (ok: boolean) => void } | null;

type NotificationsContextValue = {
  /** Replaces window.confirm with a styled in-app dialog. Resolves true/false instead of blocking the thread. */
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>;
  /** Replaces window.alert for brief, auto-dismissing feedback (e.g. a failed delete). */
  toast: (message: string, tone?: "error" | "success") => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const confirm = useCallback((message: string, confirmLabel = "Delete") => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ message, confirmLabel, resolve });
    });
  }, []);

  const toast = useCallback((message: string, tone: "error" | "success" = "error") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  function resolveConfirm(ok: boolean) {
    confirmState?.resolve(ok);
    setConfirmState(null);
  }

  return (
    <NotificationsContext.Provider value={{ confirm, toast }}>
      {children}

      {confirmState && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          role="alertdialog"
          aria-modal="true"
          onClick={() => resolveConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-foreground">{confirmState.message}</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground active:bg-border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resolveConfirm(true)}
                className="flex-1 rounded-lg bg-danger py-2.5 text-sm font-semibold text-white"
                autoFocus
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto w-full max-w-sm rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg ${
              t.tone === "error" ? "bg-danger" : "bg-accent"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
