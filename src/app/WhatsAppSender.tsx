/**
 * WhatsAppSender — QHT Agent message sender  v5.0 (Professional B2B SaaS)
 *
 * Design system:
 *   Primary     #1E1B4B  Deep Indigo
 *   Accent      #7C3AED  Electric Violet
 *   Success     #059669  Emerald Green
 *   Danger      #E11D48  Rose
 *   BG page     #F8FAFC  Soft Gray
 *   BG card     #FFFFFF  White
 *   Border      #E2E8F0
 *   Text        #1E293B  /  #64748B (muted)
 *
 * Layout:
 *   ┌──────────────────── TopBar (#1E1B4B frosted glass) ──────────────────────┐
 *   ├─────────────────────────────────────────────────────────────────────────┤
 *   │  Send Form (glass)  │  Template Library (white cards)  │  Activity feed  │
 *   │  w-[360px]          │  flex-1                          │  w-[296px]      │
 *   └─────────────────────────────────────────────────────────────────────────┘
 *
 * All backend logic (webhooks, Supabase auth, branch filtering, logging) is
 * 100% preserved.  Only JSX / styling layers are changed.
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate }  from "react-router";
import { useAuth }      from "./context/AuthContext";
import { supabase }     from "./lib/supabaseClient";
import { toast }        from "sonner";
import { Alert }            from "./components/Alert";
import { LoadingSpinner }   from "./components/LoadingSpinner";
import { StackedTemplates } from "./components/StackedTemplates";
import { RecentLogsSidebar } from "./components/RecentLogsSidebar";
import {
  SenderInput,
  SenderSelect,
  SenderTextarea,
  SenderFieldSkeleton,
  SenderWarningBox,
  SenderLockBox,
} from "./components/SenderFields";
import { env } from "@/config/env";

const logoImage = "/logo.gif";

// ─── Constants ────────────────────────────────────────────────────────────────

const WEBHOOK_URL = env.n8nWebhookUrl;
const SERVER_URL  = env.serverUrl;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SenderNumber {
  id:     string;
  value:  string;
  label:  string;
  branch: string;
}

const SUPERADMIN_BRANCHES = ["Haridwar", "Delhi", "Hyderabad", "Gurgaon"] as const;

interface FormData {
  leadId:        string;
  selectedAgent: string;
  customerName:  string;
  phoneNumber:   string;
  message:       string;
}

interface ValidationErrors {
  leadId:        string;
  selectedAgent: string;
  customerName:  string;
  phoneNumber:   string;
  message:       string;
}

interface AlertState {
  show:    boolean;
  type:    "success" | "error";
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string | undefined): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhatsAppSender() {
  const { session, profile, logout } = useAuth();
  const navigate = useNavigate();

  // ── Numbers ─────────────────────────────────────────────────────────────────
  const [senderNumbers,  setSenderNumbers]  = useState<SenderNumber[]>([]);
  const [numbersLoading, setNumbersLoading] = useState(true);
  const [numbersEmpty,   setNumbersEmpty]   = useState(false);

  // ── Superadmin branch ────────────────────────────────────────────────────────
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const filteredNumbers: SenderNumber[] = profile?.isSuperadmin
    ? (selectedBranch ? senderNumbers.filter((n) => n.branch === selectedBranch) : [])
    : senderNumbers;

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [todayCount,      setTodayCount]      = useState(0);
  const [showStats,       setShowStats]       = useState(false);
  const [logsRefreshKey,  setLogsRefreshKey]  = useState(0);

  // ── Form ─────────────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<FormData>({
    leadId: "", selectedAgent: "", customerName: "", phoneNumber: "", message: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({
    leadId: "", selectedAgent: "", customerName: "", phoneNumber: "", message: "",
  });
  const [alert,            setAlert]            = useState<AlertState>({ show: false, type: "success", message: "" });
  const [isSubmitting,     setIsSubmitting]      = useState(false);
  const [selectedImageUrl, setSelectedImageUrl]  = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── Auth header ──────────────────────────────────────────────────────────────
  const getFreshAuthHeader = async (): Promise<HeadersInit> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? "";
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  };

  // ── Fetch numbers ────────────────────────────────────────────────────────────
  const fetchSenderNumbers = async () => {
    setNumbersLoading(true);
    try {
      const headers = await getFreshAuthHeader();
      const res  = await fetch(`${SERVER_URL}/whatsapp-numbers`, { headers });
      const data = await res.json();
      if (data.success) {
        const mapped: SenderNumber[] = (data.numbers ?? []).map(
          (n: { id: string; phone_number: string; label: string; branch: string }) => ({
            id: n.id, value: n.phone_number, label: n.label, branch: n.branch ?? "",
          })
        );
        setSenderNumbers(mapped);
        setNumbersEmpty(!profile?.isSuperadmin && mapped.length === 0);
      } else {
        setNumbersEmpty(true);
      }
    } catch {
      setNumbersEmpty(true);
    } finally {
      setNumbersLoading(false);
    }
  };

  useEffect(() => { if (session) fetchSenderNumbers(); }, [session]); // eslint-disable-line

  // ── Log with retry ───────────────────────────────────────────────────────────
  const logMessageWithRetry = async (
    payload: object
  ): Promise<{ ok: boolean; id?: string; error?: string }> => {
    const attempt = async () => {
      const headers = await getFreshAuthHeader();
      const res = await fetch(`${SERVER_URL}/log-message`, {
        method: "POST", headers, body: JSON.stringify(payload),
      });
      let body: Record<string, unknown> = {};
      try { body = await res.json(); } catch { /* ignore */ }
      return { res, body };
    };
    try {
      const { res, body } = await attempt();
      if (res.ok) return { ok: true, id: body.id as string };
    } catch { /* retry below */ }
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const { res, body } = await attempt();
      if (res.ok) return { ok: true, id: body.id as string };
      return { ok: false, error: (body.error as string) ?? `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  // ── Today count ──────────────────────────────────────────────────────────────
  useEffect(() => { if (session) fetchTodayCount(); }, [session]); // eslint-disable-line
  const fetchTodayCount = async () => {
    try {
      const headers = await getFreshAuthHeader();
      const res = await fetch(`${SERVER_URL}/today-count`, { headers });
      const data = await res.json();
      if (data.success) setTodayCount(data.count);
    } catch { /* no-op */ }
  };

  // ── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = () => { navigate("/login", { replace: true }); logout(); };

  // ── Phone formatter ──────────────────────────────────────────────────────────
  const formatPhone = (phone: string): string => {
    const t = phone.trim();
    if (t.startsWith("+")) return t;
    const c = t.replace(/\D/g, "");
    if (c.length === 10)                        return "+91" + c;
    if (c.startsWith("91") && c.length === 12)  return "+" + c;
    if (c.length > 0)                           return "+" + c;
    return t;
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const validateAgent   = (v: string) => (!v ? "Please select a WhatsApp number" : "");
  const validateName    = (v: string) => {
    if (!v.trim()) return "Customer name is required";
    if (v.trim().length < 2) return "Name must be at least 2 characters";
    return "";
  };
  const validatePhone   = (v: string): string => {
    if (!v.trim()) return "";
    const t = v.trim();
    if (t.startsWith("+")) {
      const d = t.substring(1).replace(/\D/g, "");
      if (d.length < 10) return "Phone number is incomplete";
      if (d.length > 15) return "Phone number is too long";
      return "";
    }
    const c = t.replace(/\D/g, "");
    if (!c) return "Phone number is required";
    if (c.length === 10) return "";
    if (c.startsWith("91") && c.length === 12) return "";
    if (c.length < 10) return "Phone must be at least 10 digits";
    return "Invalid phone number format";
  };
  const validateMessage = (v: string): string => {
    if (selectedImageUrl) return "";
    if (!v.trim()) return "Message is required";
    if (v.trim().length < 5) return "Message must be at least 5 characters";
    return "";
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: "" }));
  };
  const handleBlur = (field: keyof FormData) => {
    let err = "";
    if (field === "selectedAgent") err = validateAgent(formData.selectedAgent);
    if (field === "customerName")  err = validateName(formData.customerName);
    if (field === "phoneNumber")   err = validatePhone(formData.phoneNumber);
    if (field === "message")       err = validateMessage(formData.message);
    if (err) setErrors((p) => ({ ...p, [field]: err }));
  };
  const handleSelectText = (t: string) => {
    setFormData((p) => ({ ...p, message: t }));
    setSelectedImageUrl(null);
    setErrors((p) => ({ ...p, message: "" }));
  };
  const handleSelectImage = (url: string) => {
    setSelectedImageUrl(url);
    setFormData((p) => ({ ...p, message: "" }));
    setErrors((p) => ({ ...p, message: "" }));
  };
  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    handleChange("selectedAgent", "");
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.leadId.trim() && !formData.phoneNumber.trim()) {
      toast.error("Please provide either Lead ID or Phone Number");
      return;
    }
    const newErrors: ValidationErrors = {
      leadId:        "",
      selectedAgent: validateAgent(formData.selectedAgent),
      customerName:  validateName(formData.customerName),
      phoneNumber:   formData.phoneNumber.trim() ? validatePhone(formData.phoneNumber) : "",
      message:       !selectedImageUrl ? validateMessage(formData.message) : "",
    };
    if (Object.values(newErrors).some((e) => e !== "")) { setErrors(newErrors); return; }

    setIsSubmitting(true);
    try {
      const finalPhone = formData.phoneNumber.trim() ? formatPhone(formData.phoneNumber) : "";
      const webhookPayload = {
        leadId:        formData.leadId.trim() || "",
        agentPhone:    formData.selectedAgent,
        customerName:  formData.customerName.trim(),
        customerPhone: finalPhone,
        message:       selectedImageUrl ? "" : formData.message.trim(),
        imageUrl:      selectedImageUrl || "",
        sentBy: {
          agentId:    profile?.id     ?? "",
          agentName:  profile?.name   ?? "",
          agentEmail: profile?.email  ?? "",
          agentRole:  profile?.role   ?? "agent",
          branch:     profile?.branch ?? "",
        },
      };
      const logPayload = {
        lead_id:         formData.leadId.trim() || null,
        customer_phone:  finalPhone || "",
        customer_name:   formData.customerName.trim(),
        template_type:   selectedImageUrl ? "image" : "quick",
        message_content: selectedImageUrl ? null : formData.message.trim(),
        image_url:       selectedImageUrl || null,
        used_number:     formData.selectedAgent,
      };

      const webhookRes = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      });
      const webhookOk = webhookRes.ok;
      if (!webhookOk) {
        const errText = await webhookRes.text().catch(() => "");
        console.error("[WA] Webhook failed:", webhookRes.status, errText);
      }

      const logResult = await logMessageWithRetry(logPayload);
      const logOk = logResult.ok;

      if (webhookOk && logOk) {
        toast.success(selectedImageUrl ? "Image sent & logged! ✅" : "Message sent & logged! ✅");
        setAlert({ show: true, type: "success", message: selectedImageUrl ? "Image sent successfully! ✅" : "Message sent successfully! ✅" });
        await fetchTodayCount();
        try { const bc = new BroadcastChannel("qht_message_sent"); bc.postMessage({ ts: Date.now() }); bc.close(); } catch { /* no-op */ }
        localStorage.setItem("qht_last_send", Date.now().toString());
        setLogsRefreshKey((k) => k + 1);
      } else if (webhookOk && !logOk) {
        toast.warning(`Sent ✅ — logging failed: ${logResult.error ?? "unknown"}`);
        setAlert({ show: true, type: "success", message: `Sent! ✅ (log error: ${logResult.error ?? "unknown"})` });
        await fetchTodayCount();
        setLogsRefreshKey((k) => k + 1);
      } else if (!webhookOk && logOk) {
        toast.warning("Logged ✅ but send may have failed.");
        setAlert({ show: true, type: "error", message: `Send failed (${webhookRes.status}), log saved.` });
      } else {
        toast.error(`Send failed (${webhookRes.status})`);
        setAlert({ show: true, type: "error", message: `Send failed. Status: ${webhookRes.status}` });
      }

      if (webhookOk) {
        setFormData({ leadId: "", selectedAgent: "", customerName: "", phoneNumber: "", message: "" });
        setSelectedImageUrl(null);
        if (profile?.isSuperadmin) setSelectedBranch("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Error: ${msg}`);
      setAlert({ show: true, type: "error", message: `Error: ${msg}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Number selector renderers ─────────────────────────────────────────────────

  const renderSuperadminNumberSelector = () => (
    <div className="flex flex-col gap-3">
      <SenderSelect
        label="Step 1 — Branch"
        value={selectedBranch}
        onChange={handleBranchChange}
      >
        <option value="">Choose a branch…</option>
        {SUPERADMIN_BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
      </SenderSelect>

      {numbersLoading ? (
        <SenderFieldSkeleton label="Step 2 — WhatsApp Number" />
      ) : !selectedBranch ? (
        <SenderLockBox label="Step 2 — WhatsApp Number" />
      ) : filteredNumbers.length === 0 ? (
        <SenderWarningBox
          title={`No numbers for ${selectedBranch}`}
          subtitle="Add via Admin Panel → WhatsApp Numbers"
        />
      ) : (
        <SenderSelect
          label="Step 2 — WhatsApp Number"
          value={formData.selectedAgent}
          onChange={(v) => handleChange("selectedAgent", v)}
          onBlur={() => handleBlur("selectedAgent")}
          error={errors.selectedAgent}
        >
          <option value="">Choose a number…</option>
          {filteredNumbers.map((a) => (
            <option key={a.id || a.value} value={a.value}>{a.label} — {a.value}</option>
          ))}
        </SenderSelect>
      )}
    </div>
  );

  const renderAgentNumberSelector = () => {
    if (numbersLoading) return <SenderFieldSkeleton label="WhatsApp Number" />;
    if (numbersEmpty) return (
      <SenderWarningBox
        title="No numbers assigned to this branch"
        subtitle={`Contact Admin to add numbers for ${profile?.branch ?? "your branch"}`}
      />
    );
    return (
      <SenderSelect
        label="WhatsApp Number"
        value={formData.selectedAgent}
        onChange={(v) => handleChange("selectedAgent", v)}
        onBlur={() => handleBlur("selectedAgent")}
        error={errors.selectedAgent}
      >
        <option value="">Choose a WhatsApp number…</option>
        {senderNumbers.map((a) => (
          <option key={a.id || a.value} value={a.value}>{a.label} — {a.value}</option>
        ))}
      </SenderSelect>
    );
  };

  // ── Can submit? ──────────────────────────────────────────────────────────────
  const canSubmit =
    !isSubmitting &&
    !!formData.selectedAgent &&
    !!formData.customerName &&
    (!!selectedImageUrl || !!formData.message) &&
    (!!formData.leadId || !!formData.phoneNumber);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{
        background: "#F8FAFC",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Alert */}
      {alert.show && (
        <Alert type={alert.type} message={alert.message}
          onClose={() => setAlert((p) => ({ ...p, show: false }))} />
      )}

      {/* ══════════════════════════ TOP BAR ══════════════════════════════════ */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-5"
        style={{
          height:       58,
          background:   "rgba(30,27,75,0.97)",
          backdropFilter:       "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          boxShadow:    "0 1px 0 rgba(255,255,255,0.04), 0 4px 20px rgba(0,0,0,0.25)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div
            className="flex items-center justify-center rounded-xl overflow-hidden"
            style={{ width: 32, height: 32, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <img src={logoImage} alt="QHT" style={{ width: 26, height: 26, objectFit: "contain" }} />
          </div>
          <div className="hidden sm:block">
            <p className="text-[13px] font-semibold leading-none" style={{ color: "#FFFFFF" }}>
              QHT Portal
            </p>
            <p className="text-[10px] leading-none mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>
              Hair Med India
            </p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-5 w-px flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)" }} />

        {/* Agent info */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Avatar */}
          <div
            className="flex items-center justify-center rounded-xl text-[11px] font-bold select-none"
            style={{
              width:      30, height:     30,
              background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
              color:      "#FFFFFF",
              boxShadow:  "0 2px 8px rgba(124,58,237,0.40)",
            }}
          >
            {initials(profile?.name)}
          </div>
          <div className="hidden md:block">
            <p className="text-[13px] font-semibold leading-none" style={{ color: "rgba(255,255,255,0.92)" }}>
              {profile?.name ?? "Agent"}
            </p>
            <p className="text-[10px] mt-0.5 leading-none capitalize" style={{ color: "rgba(255,255,255,0.40)" }}>
              {profile?.role ?? "agent"}
            </p>
          </div>
        </div>

        {/* Branch badge */}
        {profile?.isSuperadmin ? (
          <span
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: "rgba(167,139,250,0.18)", color: "#C4B5FD", border: "1px solid rgba(167,139,250,0.28)" }}
          >
            🌐 All Branches
          </span>
        ) : profile?.branch ? (
          <span
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: "rgba(16,185,129,0.15)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,0.25)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#10B981", boxShadow: "0 0 4px #10B981" }}
            />
            {profile.branch}
          </span>
        ) : null}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Today count */}
        <button
          onClick={() => { fetchTodayCount(); setShowStats(true); }}
          className="flex-shrink-0 flex items-center gap-2 rounded-xl border-0 cursor-pointer text-[12px] font-semibold transition-all duration-200"
          style={{
            padding:    "7px 14px",
            background: "rgba(124,58,237,0.18)",
            color:      "#C4B5FD",
            border:     "1px solid rgba(124,58,237,0.30)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124,58,237,0.28)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(124,58,237,0.18)")}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          {todayCount} today
        </button>

        {/* Admin */}
        {profile?.isAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-xl border-0 cursor-pointer text-[12px] font-semibold transition-all duration-200"
            style={{
              padding:    "7px 14px",
              background: "rgba(255,255,255,0.07)",
              color:      "rgba(255,255,255,0.70)",
              border:     "1px solid rgba(255,255,255,0.10)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#FFFFFF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.70)"; }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Admin
          </button>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-xl border-0 cursor-pointer text-[12px] font-semibold transition-all duration-200"
          style={{
            padding:    "7px 14px",
            background: "rgba(225,29,72,0.12)",
            color:      "#FDA4AF",
            border:     "1px solid rgba(225,29,72,0.25)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(225,29,72,0.22)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(225,29,72,0.12)")}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

      {/* ══════════════════════════ MAIN AREA ════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden min-h-0 gap-3 p-3">

        {/* ═══════════ LEFT — Send Message Form ═════════════════════════════ */}
        <div
          className="flex-shrink-0 flex flex-col overflow-hidden rounded-2xl"
          style={{
            width:              360,
            background:         "rgba(255,255,255,0.88)",
            backdropFilter:     "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border:             "1.5px solid #E2E8F0",
            boxShadow:          "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          {/* Form card header */}
          <div
            className="flex-shrink-0 px-5 pt-4 pb-4"
            style={{ borderBottom: "1.5px solid #F1F5F9" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: 36, height: 36,
                  background: "linear-gradient(135deg, #1E1B4B 0%, #7C3AED 100%)",
                  boxShadow:  "0 4px 12px rgba(124,58,237,0.30)",
                }}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                  stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .99h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.73a16 16 0 006.29 6.29l1.1-1.1a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-semibold leading-none" style={{ color: "#1E293B", letterSpacing: "-0.01em" }}>
                  Send Message
                </h1>
                <p className="text-[11px] mt-0.5" style={{ color: "#94A3B8" }}>
                  WhatsApp outbound • {profile?.branch ?? "All Branches"}
                </p>
              </div>

              {/* Online dot */}
              <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "#059669", boxShadow: "0 0 6px #059669" }}
                />
                <span className="text-[11px] font-medium" style={{ color: "#059669" }}>Online</span>
              </div>
            </div>
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <form onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-4">
                <SenderInput
                  label="Lead ID"
                  type="text"
                  value={formData.leadId}
                  onChange={(v) => handleChange("leadId", v)}
                  onBlur={() => handleBlur("leadId")}
                  error={errors.leadId}
                  maxLength={50}
                />

                {profile?.isSuperadmin
                  ? renderSuperadminNumberSelector()
                  : renderAgentNumberSelector()}

                <SenderInput
                  ref={nameInputRef}
                  label="Customer Name"
                  type="text"
                  value={formData.customerName}
                  onChange={(v) => handleChange("customerName", v)}
                  onBlur={() => handleBlur("customerName")}
                  error={errors.customerName}
                  maxLength={50}
                />

                <SenderInput
                  label="Phone Number"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(v) => handleChange("phoneNumber", v)}
                  onBlur={() => handleBlur("phoneNumber")}
                  error={errors.phoneNumber}
                  maxLength={20}
                />

                {/* Message / Image mode */}
                <div className="relative">
                  <SenderTextarea
                    label={selectedImageUrl ? "Message (optional)" : "Message"}
                    value={formData.message}
                    onChange={(v) => handleChange("message", v)}
                    onBlur={() => handleBlur("message")}
                    error={errors.message}
                    maxLength={1024}
                  />
                  {selectedImageUrl && (
                    <div
                      className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-1 pointer-events-none"
                      style={{
                        background:    "rgba(245,243,255,0.94)",
                        border:        "1.5px dashed #7C3AED",
                        backdropFilter: "blur(2px)",
                        top:           28,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>🖼</span>
                      <span className="text-[12px] font-semibold" style={{ color: "#7C3AED" }}>
                        Image Mode Active
                      </span>
                    </div>
                  )}
                </div>

                {/* Image preview strip */}
                {selectedImageUrl && (
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1.5px solid #DDD6FE", boxShadow: "0 2px 12px rgba(124,58,237,0.10)" }}
                  >
                    <div
                      className="flex items-center justify-between px-3 py-2"
                      style={{ background: "linear-gradient(90deg, #F5F3FF, #EDE9FE)" }}
                    >
                      <div className="flex items-center gap-2">
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
                          stroke="#7C3AED" strokeWidth={2.5} strokeLinecap="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <span className="text-[11px] font-semibold" style={{ color: "#5B21B6" }}>
                          Image Selected
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedImageUrl(null)}
                        className="flex items-center gap-1 rounded-lg border-0 cursor-pointer text-[10px] font-bold transition-all duration-150"
                        style={{ padding: "3px 8px", background: "#FEE2E2", color: "#E11D48", border: "1px solid #FECACA" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#E11D48"; e.currentTarget.style.color = "white"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#E11D48"; }}
                      >
                        ✕ Clear
                      </button>
                    </div>
                    <img
                      src={selectedImageUrl}
                      alt="Selected"
                      style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }}
                    />
                  </div>
                )}

                {/* ── Submit button ──────────────────────────────────────── */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full rounded-xl font-semibold border-0 cursor-pointer flex items-center justify-center gap-2.5 text-sm transition-all duration-200 relative overflow-hidden"
                  style={{
                    padding:    "13px 0",
                    background: canSubmit
                      ? isSubmitting
                        ? "linear-gradient(90deg, #1E1B4B 0%, #7C3AED 30%, #1E1B4B 60%)"
                        : "linear-gradient(135deg, #1E1B4B 0%, #7C3AED 100%)"
                      : "#F1F5F9",
                    backgroundSize: isSubmitting ? "300% 100%" : "100% 100%",
                    animation:  isSubmitting ? "btnShimmer 1.8s linear infinite" : "none",
                    color:      canSubmit ? "#FFFFFF" : "#94A3B8",
                    boxShadow:  canSubmit
                      ? "0 4px 20px rgba(124,58,237,0.35)"
                      : "none",
                    cursor:     canSubmit ? "pointer" : "not-allowed",
                    letterSpacing: "-0.01em",
                  }}
                  onMouseEnter={(e) => {
                    if (canSubmit && !isSubmitting)
                      e.currentTarget.style.boxShadow = "0 6px 28px rgba(124,58,237,0.50)";
                  }}
                  onMouseLeave={(e) => {
                    if (canSubmit && !isSubmitting)
                      e.currentTarget.style.boxShadow = "0 4px 20px rgba(124,58,237,0.35)";
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      <span>{selectedImageUrl ? "Send Image Message" : "Send WhatsApp"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ═══════════ CENTER — Template Library ════════════════════════════ */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Section header */}
          <div className="flex-shrink-0 flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#1E293B", letterSpacing: "-0.01em" }}>
                Template Library
              </h2>
              <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                Click to fill · Hover card header to switch
              </p>
            </div>
            {/* Active mode indicator */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style={{
                background: selectedImageUrl ? "#EFF6FF" : "#F5F3FF",
                color:      selectedImageUrl ? "#1D4ED8" : "#7C3AED",
                border:     `1.5px solid ${selectedImageUrl ? "#BFDBFE" : "#DDD6FE"}`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: selectedImageUrl ? "#2563EB" : "#7C3AED" }}
              />
              {selectedImageUrl ? "Image mode" : "Text mode"}
            </div>
          </div>

          {/* Stacked template cards */}
          <div className="flex-1 min-h-0">
            <StackedTemplates
              onSelectTemplate={handleSelectText}
              onSelectImage={handleSelectImage}
              selectedImageUrl={selectedImageUrl}
              userBranch={profile?.branch ?? null}
            />
          </div>
        </div>

        {/* ═══════════ RIGHT — Recent Activity ═══════════════════════════════ */}
        <div
          className="flex-shrink-0 flex flex-col overflow-hidden rounded-2xl"
          style={{
            width:      296,
            border:     "1.5px solid #E2E8F0",
            boxShadow:  "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <RecentLogsSidebar
            refreshKey={logsRefreshKey}
            onQuickFill={handleSelectText}
          />
        </div>

      </div>

      {/* ════════════════════ STATS MODAL ════════════════════════════════════ */}
      {showStats && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: "rgba(15,12,50,0.55)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowStats(false)}
        >
          <div
            className="rounded-2xl"
            style={{
              width:     380,
              background: "#FFFFFF",
              border:    "1.5px solid #E2E8F0",
              boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 4px 20px rgba(0,0,0,0.10)",
              overflow:  "hidden",
              animation: "statsIn 0.2s ease both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="px-8 py-6"
              style={{ background: "linear-gradient(135deg, #1E1B4B 0%, #7C3AED 100%)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{ width: 36, height: 36, background: "rgba(255,255,255,0.15)" }}
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold" style={{ color: "#FFFFFF", letterSpacing: "-0.01em" }}>
                    Today's Statistics
                  </h2>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {profile?.name} · {profile?.branch ?? "All Branches"}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats content */}
            <div className="px-8 py-6">
              <div
                className="rounded-2xl text-center py-8 mb-5"
                style={{
                  background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)",
                  border:     "1.5px solid #DDD6FE",
                }}
              >
                <p className="text-[12px] font-semibold mb-1" style={{ color: "#7C3AED" }}>
                  Messages Sent Today
                </p>
                <p
                  className="font-black"
                  style={{ fontSize: 54, color: "#1E1B4B", lineHeight: 1.05, letterSpacing: "-0.03em" }}
                >
                  {todayCount}
                </p>
              </div>

              <button
                onClick={() => setShowStats(false)}
                className="w-full rounded-xl font-semibold text-sm border-0 cursor-pointer transition-all duration-200"
                style={{
                  padding:    "11px 0",
                  background: "#F8FAFC",
                  color:      "#64748B",
                  border:     "1.5px solid #E2E8F0",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F5F9"; e.currentTarget.style.color = "#1E293B"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#64748B"; }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Global Keyframes ──────────────────────────────────────────────── */}
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes btnShimmer { 0%{background-position:-300% 0} 100%{background-position:300% 0} }
        @keyframes statsIn { from{opacity:0;transform:scale(0.96) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }

        /* Left sidebar scroll */
        .overflow-y-auto::-webkit-scrollbar { width: 4px; }
        .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
        .overflow-y-auto::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </div>
  );
}