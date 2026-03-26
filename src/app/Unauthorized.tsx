/**
 * Unauthorized — shown when a logged-in user has no role or no branch
 * assigned in the profiles table.  They are authenticated but not yet
 * provisioned by an admin.
 */

import { useAuth } from "./context/AuthContext";

const logoImage = "/logo.gif";

export default function Unauthorized() {
  const { profile, logout } = useAuth();

  return (
    <div
      style={{
        minHeight:      "100vh",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        background:     "linear-gradient(135deg, #fff8e1 0%, #fff3cd 100%)",
        fontFamily:     "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding:        24,
      }}
    >
      <div
        style={{
          background:   "#fff",
          borderRadius: 24,
          padding:      "52px 48px",
          maxWidth:     480,
          width:        "100%",
          boxShadow:    "0 8px 40px rgba(0,0,0,0.10)",
          textAlign:    "center",
        }}
      >
        {/* Logo */}
        <img
          src={logoImage}
          alt="QHT"
          style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 20 }}
        />

        {/* Warning icon */}
        <div
          style={{
            width:          64,
            height:         64,
            borderRadius:   "50%",
            background:     "#fff3cd",
            border:         "2px solid #ffc107",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontSize:       28,
            margin:         "0 auto 20px",
          }}
        >
          ⚠️
        </div>

        <h1
          style={{
            fontSize:   22,
            fontWeight: 800,
            color:      "#1a1a1a",
            margin:     "0 0 10px",
          }}
        >
          Account Not Configured
        </h1>

        <p style={{ fontSize: 15, color: "#666", margin: "0 0 6px", lineHeight: 1.6 }}>
          Your account is missing a <strong>role</strong> or a <strong>branch</strong>
          {" "}assignment.
        </p>

        <p style={{ fontSize: 14, color: "#888", margin: "0 0 28px", lineHeight: 1.6 }}>
          Please contact your administrator to configure your account in the
          QHT Portal.
        </p>

        {/* Debug info for admin to diagnose */}
        {profile && (
          <div
            style={{
              background:   "#f8f9fa",
              border:       "1px solid #e8e8e8",
              borderRadius: 10,
              padding:      "12px 16px",
              marginBottom: 24,
              textAlign:    "left",
              fontSize:     12,
              color:        "#888",
            }}
          >
            <div><strong>Email:</strong> {profile.email}</div>
            <div>
              <strong>Role:</strong>{" "}
              <span style={{ color: profile.role ? "#2e7d32" : "#dc2626" }}>
                {profile.role || "⚠️ Not assigned"}
              </span>
            </div>
            <div>
              <strong>Branch:</strong>{" "}
              <span style={{ color: profile.branch ? "#2e7d32" : "#dc2626" }}>
                {profile.branch || "⚠️ Not assigned"}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => logout()}
          style={{
            width:        "100%",
            padding:      "13px 0",
            borderRadius: 12,
            border:       "none",
            background:   "#dc2626",
            color:        "#fff",
            fontWeight:   700,
            fontSize:     15,
            cursor:       "pointer",
          }}
        >
          🚪 Sign Out
        </button>

        <p style={{ marginTop: 16, fontSize: 12, color: "#ccc" }}>
          QHT Clinic Agent Portal
        </p>
      </div>
    </div>
  );
}
