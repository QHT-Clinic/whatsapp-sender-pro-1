/**
 * CreateAgentModal — QHT Admin Panel
 *
 * Allows an Admin or Superadmin to create a new Supabase Auth user that is
 * simultaneously inserted into public.profiles via POST /admin/create-user.
 *
 * Branch / role permissions are enforced SERVER-SIDE. The UI simply hides or
 * locks options that the caller isn't allowed to use (UX courtesy only — the
 * backend will reject invalid requests regardless).
 *
 *   Admin      → role is locked to 'agent'; branch locked to their own branch.
 *   Superadmin → may pick role='agent' or 'admin', and any of the 4 branches.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { env } from "@/config/env";

const SERVER_URL = env.serverUrl;

const BRANCHES = ["Haridwar", "Hyderabad", "Delhi", "Gurgaon"] as const;
type Branch = typeof BRANCHES[number];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateAgentModalProps {
  isSuperadmin:    boolean;
  adminBranch:     string | null;   // branch admin's own branch; null for superadmin
  getAuthHeader:   () => Promise<HeadersInit>;
  onSuccess:       (newUser: CreatedUser) => void;
  onClose:         () => void;
}

export interface CreatedUser {
  id:        string;
  email:     string;
  full_name: string;
  role:      string;
  branch:    string;
}

// ─── Branch palette (matches AdminDashboard) ──────────────────────────────────

const BRANCH_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  Haridwar:  { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7", accent: "#4caf50" },
  Hyderabad: { bg: "#e3f2fd", text: "#1565c0", border: "#90caf9", accent: "#2196f3" },
  Delhi:     { bg: "#fff3e0", text: "#e65100", border: "#ffcc80", accent: "#ff9800" },
  Gurgaon:   { bg: "#fce4ec", text: "#880e4f", border: "#f48fb1", accent: "#e91e63" },
};

// ─── Styled input helpers ──────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 6, letterSpacing: "0.3px" }}>
      {children}
      {required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
    </label>
  );
}

// Use only longhand border properties (borderWidth + borderStyle + borderColor) so that
// INPUT_FOCUS / INPUT_ERROR can safely override just borderColor without React warning about
// mixing the "border" shorthand with "borderColor" longhand on re-render.
const INPUT_STYLE: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 14,
  borderWidth: "1.5px", borderStyle: "solid", borderColor: "#e0e0e0",
  outline: "none", boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s", background: "#fafafa",
  color: "#1a1a1a",
};
const INPUT_FOCUS: React.CSSProperties  = { borderColor: "#5a8f5c", boxShadow: "0 0 0 3px rgba(90,143,92,0.12)", background: "#fff" };
const INPUT_ERROR: React.CSSProperties  = { borderColor: "#ef4444",  boxShadow: "0 0 0 3px rgba(239,68,68,0.10)"  };
const INPUT_LOCKED: React.CSSProperties = { background: "#f5f5f5", color: "#888", cursor: "not-allowed" };

function FieldError({ msg }: { msg: string }) {
  if (!msg) return null;
  return <p style={{ margin: "5px 0 0", fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>⚠ {msg}</p>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateAgentModal({
  isSuperadmin,
  adminBranch,
  getAuthHeader,
  onSuccess,
  onClose,
}: CreateAgentModalProps) {

  // ── Form state ──────────────────────────────────────────────────────────────
  const [fullName,  setFullName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [role,      setRole]      = useState<"agent" | "admin">("agent");
  const [branch,    setBranch]    = useState<Branch>(
    (adminBranch && BRANCHES.includes(adminBranch as Branch))
      ? adminBranch as Branch
      : "Haridwar"
  );

  // ── UI state ────────────────────────────────────────────────────────────────
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverErr,  setServerErr]  = useState<string | null>(null);
  const [success,    setSuccess]    = useState<CreatedUser | null>(null);
  const [focusField, setFocusField] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!fullName.trim())              errs.fullName = "Full name is required";
    else if (fullName.trim().length < 2) errs.fullName = "Name must be at least 2 characters";

    if (!email.trim())                 errs.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                                       errs.email = "Enter a valid email address";

    if (!password)                     errs.password = "Password is required";
    else if (password.length < 8)      errs.password = "Password must be at least 8 characters";
    else if (!/[A-Z]/.test(password) && !/[0-9]/.test(password))
                                       errs.password = "Include at least one uppercase letter or number";

    return errs;
  }, [fullName, email, password]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerErr(null);

    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    setSubmitting(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${SERVER_URL}/admin/create-user`, {
        method:  "POST",
        headers: { ...headers as Record<string, string>, "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email:     email.trim().toLowerCase(),
          password,
          role:      isSuperadmin ? role   : "agent",    // server enforces anyway
          branch:    isSuperadmin ? branch : adminBranch, // server enforces anyway
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Show Supabase's error verbatim — it's already user-friendly
        setServerErr(data.error ?? `Server error (${res.status})`);
        return;
      }

      setSuccess(data.user as CreatedUser);
      onSuccess(data.user as CreatedUser);

    } catch (err) {
      console.error("[CreateAgentModal] submit error:", err);
      setServerErr(err instanceof Error ? err.message : "Network error — please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const inputStyle = (field: string): React.CSSProperties => ({
    ...INPUT_STYLE,
    ...(focusField === field ? INPUT_FOCUS : {}),
    ...(errors[field]        ? INPUT_ERROR : {}),
  });

  const currentBranchColor = BRANCH_COLORS[branch] ?? BRANCH_COLORS.Haridwar;

  // ─── Success screen ───────────────────────────────────────────────────────
  if (success) {
    const sc = BRANCH_COLORS[success.branch] ?? BRANCH_COLORS.Haridwar;
    return (
      <ModalShell onClose={onClose}>
        <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
          <div style={{ fontSize: 56, marginBottom: 16, lineHeight: 1 }}>🎉</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#1a1a1a" }}>
            Agent Created!
          </h2>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#888", lineHeight: 1.5 }}>
            The account is active and ready to log in immediately.
          </p>

          {/* Summary card */}
          <div style={{ background: "#f8faf8", borderRadius: 14, padding: "18px 20px", textAlign: "left", marginBottom: 24, border: "1.5px solid #e0ede0" }}>
            {[
              ["👤 Name",   success.full_name],
              ["📧 Email",  success.email],
              ["🔑 Role",   success.role.charAt(0).toUpperCase() + success.role.slice(1)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #eee" }}>
                <span style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0" }}>
              <span style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>📍 Branch</span>
              <span style={{
                background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                borderRadius: 20, padding: "2px 12px", fontSize: 12, fontWeight: 700,
              }}>{success.branch}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { setSuccess(null); setFullName(""); setEmail(""); setPassword(""); setRole("agent"); }}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1.5px solid #5a8f5c", background: "#f0faf0", color: "#5a8f5c", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
            >
              ➕ Add Another
            </button>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#5a8f5c", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
            >
              ✓ Done
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  // ─── Form ─────────────────────────────────────────────────────────────────
  return (
    <ModalShell onClose={onClose}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "linear-gradient(135deg, #5a8f5c, #4a7a4f)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
          👤
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>
            Add New Agent
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#aaa" }}>
            {isSuperadmin
              ? "Create an agent or admin for any branch"
              : `Creating agent for ${adminBranch ?? "your branch"}`}
          </p>
        </div>
      </div>

      {/* Server error banner */}
      {serverErr && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
              Could not create account
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#dc2626" }}>{serverErr}</p>
          </div>
          <button onClick={() => setServerErr(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Full Name */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel required>Full Name</FieldLabel>
          <input
            ref={nameRef}
            type="text"
            placeholder="e.g. Rahul Sharma"
            value={fullName}
            maxLength={60}
            onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, fullName: "" })); }}
            onFocus={() => setFocusField("fullName")}
            onBlur={() => setFocusField(null)}
            style={inputStyle("fullName")}
            disabled={submitting}
            autoComplete="name"
          />
          <FieldError msg={errors.fullName ?? ""} />
        </div>

        {/* Email */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel required>Email Address</FieldLabel>
          <input
            type="email"
            placeholder="agent@hairmedindia.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
            onFocus={() => setFocusField("email")}
            onBlur={() => setFocusField(null)}
            style={inputStyle("email")}
            disabled={submitting}
            autoComplete="email"
          />
          <FieldError msg={errors.email ?? ""} />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 16 }}>
          <FieldLabel required>Password</FieldLabel>
          <div style={{ position: "relative" }}>
            <input
              type={showPwd ? "text" : "password"}
              placeholder="Min 8 chars, include a number or uppercase"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }}
              onFocus={() => setFocusField("password")}
              onBlur={() => setFocusField(null)}
              style={{ ...inputStyle("password"), paddingRight: 44 }}
              disabled={submitting}
              autoComplete="new-password"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPwd((v) => !v)}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 2,
                color: "#aaa", lineHeight: 1,
              }}
              title={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? "🙈" : "👁️"}
            </button>
          </div>
          {/* Password strength hint */}
          {password.length > 0 && (
            <PasswordStrength password={password} />
          )}
          <FieldError msg={errors.password ?? ""} />
        </div>

        {/* Role + Branch — two columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          {/* Role */}
          <div>
            <FieldLabel required>Role</FieldLabel>
            {isSuperadmin ? (
              <div style={{ display: "flex", gap: 8 }}>
                {(["agent", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    disabled={submitting}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer",
                      fontWeight: 700, fontSize: 13, border: "none", transition: "all 0.12s",
                      background: role === r ? (r === "admin" ? "#f3e8ff" : "#e8f5e9") : "#f5f5f5",
                      color:      role === r ? (r === "admin" ? "#7c3aed" : "#2e7d32") : "#aaa",
                      boxShadow:  role === r ? `0 0 0 2px ${r === "admin" ? "#c084fc" : "#4caf50"}` : "none",
                    }}
                  >
                    {r === "admin" ? "👑 Admin" : "🧑 Agent"}
                  </button>
                ))}
              </div>
            ) : (
              /* Admin: role is always 'agent' — locked */
              <div style={{ ...INPUT_STYLE, ...INPUT_LOCKED, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🧑</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Agent</span>
                <span style={{ marginLeft: "auto", fontSize: 10, background: "#e8e8e8", borderRadius: 20, padding: "2px 8px", color: "#888" }}>locked</span>
              </div>
            )}
          </div>

          {/* Branch */}
          <div>
            <FieldLabel required>Branch</FieldLabel>
            {isSuperadmin ? (
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value as Branch)}
                onFocus={() => setFocusField("branch")}
                onBlur={() => setFocusField(null)}
                disabled={submitting}
                style={{
                  ...inputStyle("branch"),
                  appearance: "none",
                  // Use only background longhands — no "background" shorthand here — so
                  // React never warns about mixing shorthand + longhand on the same element.
                  backgroundColor:    currentBranchColor.bg,
                  backgroundImage:    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
                  backgroundRepeat:   "no-repeat",
                  backgroundPosition: "right 12px center",
                  paddingRight: 36,
                  color: currentBranchColor.text,
                  fontWeight: 700,
                  borderColor: currentBranchColor.border,
                }}
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            ) : (
              /* Admin: branch locked to their own */
              <div style={{ ...INPUT_STYLE, ...INPUT_LOCKED, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: BRANCH_COLORS[adminBranch ?? ""]?.accent ?? "#ccc", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{adminBranch ?? "—"}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, background: "#e8e8e8", borderRadius: 20, padding: "2px 8px", color: "#888" }}>locked</span>
              </div>
            )}
          </div>
        </div>

        {/* Info note */}
        <div style={{ background: "#f0faf0", border: "1px solid #a5d6a7", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#2e7d32", lineHeight: 1.5 }}>
          🔒 The password is hashed by Supabase Auth and never stored in plain text. The new account is active immediately — no email confirmation needed.
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1.5px solid #e0e0e0", background: "#fafafa", color: "#888", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontSize: 14 }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              flex: 2, padding: "11px 0", borderRadius: 10, border: "none",
              background: submitting ? "#b0cdb1" : "linear-gradient(135deg, #5a8f5c, #4a7a4f)",
              color: "#fff", fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: submitting ? "none" : "0 4px 14px rgba(90,143,92,0.32)",
              transition: "all 0.15s",
            }}
          >
            {submitting ? (
              <>
                <svg style={{ animation: "spin 1s linear infinite" }} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
                Creating…
              </>
            ) : "➕ Create Account"}
          </button>
        </div>
      </form>

      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </ModalShell>
  );
}

// ─── Password strength bar ────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  let score = 0;
  if (password.length >= 8)               score++;
  if (password.length >= 12)              score++;
  if (/[A-Z]/.test(password))            score++;
  if (/[0-9]/.test(password))            score++;
  if (/[^A-Za-z0-9]/.test(password))    score++;

  const levels = [
    { label: "Too short",  color: "#ef4444" },
    { label: "Weak",       color: "#f97316" },
    { label: "Fair",       color: "#eab308" },
    { label: "Good",       color: "#22c55e" },
    { label: "Strong",     color: "#16a34a" },
    { label: "Very strong",color: "#15803d" },
  ];
  const lvl = levels[Math.min(score, levels.length - 1)];

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 3 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 4,
            background: i < score ? lvl.color : "#e8e8e8",
            transition: "background 0.2s",
          }} />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 10, color: lvl.color, fontWeight: 700 }}>{lvl.label}</p>
    </div>
  );
}

// ─── Modal shell (backdrop + card) ───────────────────────────────────────────

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 300, padding: 16,
        backdropFilter: "blur(3px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: 20,
          width: "100%", maxWidth: 480,
          maxHeight: "92vh", overflowY: "auto",
          padding: "28px 28px 24px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
          animation: "slideUp 0.2s ease",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 16, right: 18,
            background: "#f5f5f5", border: "none", borderRadius: 8,
            width: 30, height: 30, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: "#888", fontWeight: 700,
          }}
        >×</button>

        {children}
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
