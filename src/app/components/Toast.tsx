import { useEffect } from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
}

export function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        top: "24px",
        right: "24px",
        zIndex: 9999,
        animation: "slideInRight 0.3s ease-out",
      }}
    >
      <div
        style={{
          background: "#dc2626",
          color: "white",
          padding: "16px 24px",
          borderRadius: "12px",
          boxShadow: "0 10px 40px rgba(220, 38, 38, 0.3)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontFamily: "Inter, sans-serif",
          fontSize: "14px",
          fontWeight: "500",
          maxWidth: "400px",
        }}
      >
        <span style={{ fontSize: "20px" }}>⚠️</span>
        <span>{message}</span>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            cursor: "pointer",
            fontSize: "18px",
            padding: "0",
            marginLeft: "8px",
            opacity: "0.8",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
        >
          ✕
        </button>
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
