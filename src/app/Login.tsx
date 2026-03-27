/**
 * Login Page — QHT Agent Portal
 *
 * Clean, standalone login form.
 * - Uses supabase.auth.signInWithPassword() via AuthContext.login()
 * - Accepts full email OR bare username (auto-appends @qhtclinic.com)
 * - Redirects to /home on success
 */
import { useState, useEffect, FormEvent } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "./context/AuthContext";

const logoImage = "/logo.gif";

export default function Login() {
  const { login, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, bounce to home
  useEffect(() => {
    if (session) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
      navigate(from || "/home", { replace: true });
    }
  }, [session, navigate, location.state]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email/username and password.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await login(email, password);
      if (!result.ok) {
        setError(result.error);
      }
      // On success, the useEffect above will redirect
    } finally {
      setLoading(false);
    }
  };

  // Determine if the error is a connection error (show extra help)
  const isConnectionError =
    error?.includes("Connection error") ||
    error?.includes("Supabase project may be paused");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)",
      }}
    >
      <div
        className="w-full bg-white"
        style={{
          maxWidth: 420,
          borderRadius: 24,
          padding: "48px 40px",
          boxShadow:
            "0 20px 60px rgba(90,143,92,0.18), 0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-8">
          <img
            src={logoImage}
            alt="QHT Logo"
            style={{ width: 80, height: 80, objectFit: "contain", marginBottom: 12 }}
          />
          <h1
            className="text-2xl font-bold"
            style={{ color: "#2e7d32", marginBottom: 4 }}
          >
            QHT Clinic
          </h1>
          <p className="text-sm text-center" style={{ color: "#6b7280" }}>
            Agent Portal — sign in to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Email / Username */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="email"
              className="block text-sm font-semibold"
              style={{ color: "#374151", marginBottom: 6 }}
            >
              Email or Username
            </label>
            <input
              id="email"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="agent@qhtclinic.com  or  agent"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              disabled={loading}
              style={{
                width: "100%",
                border: "1.5px solid #d1d5db",
                borderRadius: 10,
                padding: "11px 14px",
                fontSize: 15,
                color: "#111827",
                background: "#f9fafb",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#5a8f5c")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="password"
              className="block text-sm font-semibold"
              style={{ color: "#374151", marginBottom: 6 }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                disabled={loading}
                style={{
                  width: "100%",
                  border: "1.5px solid #d1d5db",
                  borderRadius: 10,
                  padding: "11px 44px 11px 14px",
                  fontSize: 15,
                  color: "#111827",
                  background: "#f9fafb",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#5a8f5c")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPwd((p) => !p)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9ca3af",
                  display: "flex",
                  alignItems: "center",
                  padding: 0,
                }}
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? (
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1={1} y1={1} x2={23} y2={23} />
                  </svg>
                ) : (
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx={12} cy={12} r={3} />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error box */}
          {error && (
            <div
              style={{
                marginBottom: 20,
                borderRadius: 10,
                padding: "12px 14px",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
              }}
            >
              <div className="flex items-start gap-2">
                <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "#dc2626", marginBottom: isConnectionError ? 8 : 0 }}
                  >
                    {isConnectionError ? "Cannot connect to server" : error.split("\n")[0]}
                  </p>
                  {isConnectionError && (
                    <div
                      style={{
                        background: "#fee2e2",
                        borderRadius: 8,
                        padding: "8px 10px",
                      }}
                    >
                      <p className="text-xs font-semibold" style={{ color: "#991b1b", marginBottom: 4 }}>
                        How to fix:
                      </p>
                      <ol className="text-xs list-decimal list-inside space-y-1" style={{ color: "#991b1b" }}>
                        <li>Check your internet connection</li>
                        <li>
                          Visit{" "}
                          <a
                            href="https://app.supabase.com"
                            target="_blank"
                            rel="noreferrer"
                            style={{ textDecoration: "underline", fontWeight: 600 }}
                          >
                            app.supabase.com
                          </a>
                        </li>
                        <li>Find project <code style={{ background: "#fecaca", padding: "0 3px", borderRadius: 3 }}>{import.meta.env.VITE_SUPABASE_URL?.split('.')?.[0]?.replace('https://', '')}</code></li>
                        <li>Click <strong>"Restore project"</strong> if paused</li>
                        <li>Wait ~30 seconds, then try again</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 font-semibold text-white transition-all duration-200"
            style={{
              background: loading
                ? "#7cb87e"
                : "linear-gradient(135deg, #5a8f5c 0%, #4a7a4f 100%)",
              borderRadius: 10,
              padding: "13px",
              fontSize: 16,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 4px 14px rgba(90,143,92,0.35)",
            }}
          >
            {loading ? (
              <>
                <svg className="animate-spin" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                </svg>
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer */}
        <p
          className="text-center text-xs"
          style={{ color: "#9ca3af", marginTop: 28 }}
        >
          Access restricted to authorised QHT agents only.
          <br />
          <a
            href="https://wa.me/919084726881?text=I'm%20requesting%20for%20my%20login%20credentials%20to%20login%20Magic%20message%20Platform"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#5a8f5c", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}
          >
            Contact your administrator if you need access.
          </a>
        </p>
      </div>
    </div>
  );
}