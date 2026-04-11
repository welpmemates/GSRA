import { useEffect } from "react";
import useStore from "../../store/useStore";

export default function ToastList() {
  const toasts = useStore((state) => state.toasts);
  const removeToast = useStore((state) => state.removeToast);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => removeToast(toast.id), 4200)
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [toasts, removeToast]);

  if (!toasts.length) return null;

  return (
    <div
      className="fixed right-4 bottom-4 z-[999] flex flex-col gap-3"
      style={{ maxWidth: 320, pointerEvents: "none" }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="gs-panel"
          style={{
            pointerEvents: "auto",
            padding: 14,
            borderRadius: 16,
            background: "rgba(255,255,255,0.98)",
            border: "1px solid rgba(20,184,166,0.2)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: "#14B8A6" }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: "#000" }}>{toast.title}</div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#999", cursor: "pointer" }}
            >
              ×
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#444" }}>{toast.message}</div>
        </div>
      ))}
    </div>
  );
}
