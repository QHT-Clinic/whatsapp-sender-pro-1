/**
 * ProtectedRoute — three-tier access guard  v2.0
 *
 * Check order:
 *   1. initialising         → loading spinner (session restore in progress)
 *   2. !session             → /login
 *   3. profileLoadError     → Network Error screen with Retry button
 *                             (server unreachable / CORS / project paused)
 *                             ← this is NOT /unauthorized — it's a transient fault
 *   4. !role || !branch     → /unauthorized (account exists but not provisioned)
 *   5. requireAdmin + agent → /unauthorized (wrong role for this route)
 *   6. ✓                    → render children
 */

import React, { useState } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";

const logoImage = "/logo.gif";

interface Props {
  children:      React.ReactNode;
  requireAdmin?: boolean;
}

// ─── Network-error retry screen ───────────────────────────────────────────────

function ProfileErrorScreen() {
  const { retryProfile, logout } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleRetry = async () => {
    setRetrying(true);
    setAttempts((n) => n + 1);
    await retryProfile();
    setRetrying(false);
  };

  return (
    <div
      style={{
        minHeight:      "100vh",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     "linear-gradient(135deg, #fff8f0 0%, #fff3e0 100%)",
        fontFamily:     "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding:        24,
      }}
    >
      <div
        style={{
          background:   "#fff",
          borderRadius: 24,
          padding:      "48px 44px",
          maxWidth:     440,
          width:        "100%",
          boxShadow:    "0 8px 40px rgba(0,0,0,0.10)",
          textAlign:    "center",
        }}
      >
        <img
          src={logoImage}
          alt="QHT"
          style={{ width: 60, height: 60, objectFit: "contain", marginBottom: 20 }}
        />

        {/* Icon */}
        <div
          style={{
            width:          60,
            height:         60,
            borderRadius:   "50%",
            background:     "#fff3e0",
            border:         "2px solid #ff9800",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontSize:       26,
            margin:         "0 auto 20px",
          }}
        >
          📡
        </div>

        <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>
          Connection Error
        </h2>

        <p style={{ margin: "0 0 8px", fontSize: 14, color: "#666", lineHeight: 1.6 }}>
          Your session is valid but we couldn't reach the server to load your
          profile.
        </p>

        <p style={{ margin: "0 0 28px", fontSize: 13, color: "#999", lineHeight: 1.6 }}>
          This usually means the Supabase project is paused. Visit{" "}
          <a
            href="https://app.supabase.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#f59e0b", fontWeight: 600 }}
          >
            app.supabase.com
          </a>
          {" → "}project <strong>{import.meta.env.VITE_SUPABASE_URL?.split('.')?.[0]?.replace('https://', '')}</strong>{" → "}
          <strong>Restore project</strong>, wait ~30 s, then retry.
        </p>

        {attempts > 0 && (
          <div
            style={{
              background:   "#fef2f2",
              border:       "1px solid #fca5a5",
              borderRadius: 10,
              padding:      "10px 14px",
              marginBottom: 20,
              fontSize:     13,
              color:        "#dc2626",
            }}
          >
            Retry {attempts} attempt{attempts !== 1 ? "s" : ""} — server still
            unreachable.
          </div>
        )}

        <button
          onClick={handleRetry}
          disabled={retrying}
          style={{
            width:        "100%",
            padding:      "13px 0",
            borderRadius: 12,
            border:       "none",
            background:   retrying ? "#d1d5db" : "#f59e0b",
            color:        "#fff",
            fontWeight:   700,
            fontSize:     15,
            cursor:       retrying ? "not-allowed" : "pointer",
            marginBottom: 12,
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            gap:          8,
          }}
        >
          {retrying && (
            <svg
              style={{ animation: "spin 1s linear infinite" }}
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
          )}
          {retrying ? "Retrying…" : "🔄 Retry Connection"}
        </button>

        <button
          onClick={() => logout()}
          style={{
            width:        "100%",
            padding:      "11px 0",
            borderRadius: 12,
            border:       "1px solid #e5e7eb",
            background:   "#f9fafb",
            color:        "#6b7280",
            fontWeight:   600,
            fontSize:     14,
            cursor:       "pointer",
          }}
        >
          🚪 Sign Out
        </button>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ─── Main guard ───────────────────────────────────────────────────────────────

export function ProtectedRoute({ children, requireAdmin = false }: Props) {
  const { session, profile, initialising, profileLoadError } = useAuth();
  const location = useLocation();

  // ── 1. Session is still being restored ────────────────────────────────────
  if (initialising) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{
          background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)",
        }}
      >
        <img
          src={logoImage}
          alt="QHT"
          style={{ width: 64, height: 64, objectFit: "contain", opacity: 0.85 }}
        />
        <div className="flex items-center gap-3">
          <svg
            className="animate-spin"
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4a7a4f"
            strokeWidth={2.5}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-medium" style={{ color: "#4a7a4f" }}>
            Checking session…
          </span>
        </div>
      </div>
    );
  }

  // ── 2. Not authenticated → login ──────────────────────────────────────────
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ── 3. Network error loading profile → retry screen (NOT /unauthorized) ───
  // profileLoadError=true means we couldn't reach the server.
  // This is a transient fault, NOT a missing-config error.
  // Sending the user to /unauthorized here would be a false positive.
  if (profileLoadError) {
    return <ProfileErrorScreen />;
  }

  // ── 4. Profile loaded but account not configured → /unauthorized ──────────
  // Only redirect here when we KNOW the profile was loaded from the DB and
  // the role/branch fields are genuinely missing.
  // EXCEPTION: superadmin legitimately has branch='All' (or null) — never block them.
  const isSuperadmin = profile?.role === "superadmin";
  if (profile && (!profile.role || (!isSuperadmin && !profile.branch))) {
    console.warn(
      `[ProtectedRoute] ${profile.email} has no role/branch in DB → /unauthorized`
    );
    return <Navigate to="/unauthorized" replace />;
  }

  // ── 5. Admin-only route but caller is an agent ────────────────────────────
  if (requireAdmin && profile && !profile.isAdmin) {
    console.warn(
      `[ProtectedRoute] ${profile.email} (role=${profile.role}) tried /admin → /unauthorized`
    );
    return <Navigate to="/unauthorized" replace />;
  }

  // ── 6. All checks pass ────────────────────────────────────────────────────
  return <>{children}</>;
}