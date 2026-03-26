/**
 * ManageNumbersPanel — QHT Admin Panel
 *
 * Full CRUD interface for the public.whatsapp_numbers table.
 *
 * Access rules (enforced server-side; UI mirrors them for clarity):
 *   admin      → sees & manages only their own branch; branch selector is locked.
 *   superadmin → can switch between all 4 branches via a tab bar.
 *
 * Operations:
 *   Add    → POST /admin/whatsapp-numbers
 *   Toggle → POST /admin/whatsapp-numbers/:id  { _method:"PATCH", is_active }
 *   Delete → POST /admin/whatsapp-numbers/:id  { _method:"DELETE" }
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

const SERVER_URL =
  "https://zqcspamakvfzvlqbunit.supabase.co/functions/v1/make-server-9c23c834";

const BRANCHES = ["Haridwar", "Hyderabad", "Delhi", "Gurgaon"] as const;
type Branch = typeof BRANCHES[number];

const BRANCH_PALETTE: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  Haridwar:  { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7", accent: "#4caf50" },
  Hyderabad: { bg: "#e3f2fd", text: "#1565c0", border: "#90caf9", accent: "#2196f3" },
  Delhi:     { bg: "#fff3e0", text: "#e65100", border: "#ffcc80", accent: "#ff9800" },
  Gurgaon:   { bg: "#fce4ec", text: "#880e4f", border: "#f48fb1", accent: "#e91e63" },
};

function bp(name: string | null) {
  return BRANCH_PALETTE[name ?? ""] ?? { bg: "#f5f5f5", text: "#666", border: "#e0e0e0", accent: "#9e9e9e" };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WaNumber {
  id:           string;
  phone_number: string;
  label:        string;
  branch:       string;
  is_active:    boolean;
  created_at:   string;
}

interface ManageNumbersPanelProps {
  isSuperadmin:  boolean;
  adminBranch:   string | null;   // null for superadmin
  getAuthHeader: () => Promise<HeadersInit>;
}

// ─── Add Number Form ──────────────────────────────────────────────────────────

interface AddFormProps {
  branch:        string;
  isSuperadmin:  boolean;
  onAdd:         (num: WaNumber) => void;
  getAuthHeader: () => Promise<HeadersInit>;
}

function AddNumberForm({ branch, isSuperadmin, onAdd, getAuthHeader }: AddFormProps) {
  const [phone,     setPhone]     = useState("");
  const [label,     setLabel]     = useState("");
  const [selBranch, setSelBranch] = useState<Branch>(
    (BRANCHES.includes(branch as Branch) ? branch : "Haridwar") as Branch
  );
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState<{ phone?: string; label?: string; branch?: string }>({});

  // Keep selBranch in sync when parent branch prop changes (superadmin tab switch)
  useEffect(() => {
    if (BRANCHES.includes(branch as Branch)) setSelBranch(branch as Branch);
  }, [branch]);

  const validate = () => {
    const e: typeof errors = {};
    if (!/^\d{10,15}$/.test(phone.trim())) e.phone = "Must be 10–15 digits (no +, spaces)";
    if (!label.trim()) e.label = "Label is required";
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${SERVER_URL}/admin/whatsapp-numbers`, {
        method: "POST",
        headers: { ...(headers as Record<string, string>), "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phone.trim(),
          label:        label.trim(),
          branch:       isSuperadmin ? selBranch : branch,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error ?? `Server error (${res.status})`);
        return;
      }
      toast.success(`Number added for ${data.number.branch} ✅`);
      onAdd(data.number as WaNumber);
      setPhone(""); setLabel("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  const colPalette = bp(isSuperadmin ? selBranch : branch);

  return (
    <form onSubmit={handleSubmit} style={{
      background: "#f8fdf8", border: "1.5px solid #c8e6c9",
      borderRadius: 14, padding: "18px 20px", marginBottom: 22,
    }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: "#2e7d32", display: "flex", alignItems: "center", gap: 6 }}>
        ➕ Add New WhatsApp Number
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: isSuperadmin ? "1fr 1fr 1fr auto" : "1fr 1fr auto", gap: 10, alignItems: "flex-start" }}>
        {/* Phone */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#555", display: "block", marginBottom: 4 }}>
            Phone Number <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. 918679009323"
            value={phone}
            maxLength={15}
            onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setErrors((p) => ({ ...p, phone: "" })); }}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 9, fontSize: 13,
              borderWidth: "1.5px", borderStyle: "solid",
              borderColor: errors.phone ? "#ef4444" : "#e0e0e0",
              outline: "none", boxSizing: "border-box",
            }}
          />
          {errors.phone && <p style={{ margin: "4px 0 0", fontSize: 10, color: "#ef4444" }}>{errors.phone}</p>}
        </div>

        {/* Label */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#555", display: "block", marginBottom: 4 }}>
            Display Label <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. QHT Clinic · 9084723085"
            value={label}
            maxLength={80}
            onChange={(e) => { setLabel(e.target.value); setErrors((p) => ({ ...p, label: "" })); }}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 9, fontSize: 13,
              borderWidth: "1.5px", borderStyle: "solid",
              borderColor: errors.label ? "#ef4444" : "#e0e0e0",
              outline: "none", boxSizing: "border-box",
            }}
          />
          {errors.label && <p style={{ margin: "4px 0 0", fontSize: 10, color: "#ef4444" }}>{errors.label}</p>}
        </div>

        {/* Branch — superadmin only */}
        {isSuperadmin && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#555", display: "block", marginBottom: 4 }}>Branch <span style={{ color: "#ef4444" }}>*</span></label>
            <select
              value={selBranch}
              onChange={(e) => setSelBranch(e.target.value as Branch)}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 9, fontSize: 13,
                borderWidth: "1.5px", borderStyle: "solid", borderColor: "#e0e0e0",
                outline: "none", boxSizing: "border-box",
                backgroundColor: colPalette.bg,
                color: colPalette.text, fontWeight: 700,
              }}
            >
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}

        {/* Submit */}
        <div style={{ paddingTop: 20 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "9px 20px", borderRadius: 9, border: "none",
              background: saving ? "#b0cdb1" : "linear-gradient(135deg, #5a8f5c, #4a7a4f)",
              color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
              whiteSpace: "nowrap", boxShadow: saving ? "none" : "0 2px 8px rgba(90,143,92,0.28)",
            }}
          >
            {saving ? "Adding…" : "Add Number"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Number Row ───────────────────────────────────────────────────────────────

interface RowProps {
  num:           WaNumber;
  showBranch:    boolean;
  onToggle:      (id: string, active: boolean) => Promise<void>;
  onDelete:      (id: string) => Promise<void>;
  actionLoading: string | null;
}

function NumberRow({ num, showBranch, onToggle, onDelete, actionLoading }: RowProps) {
  const [confirmDel, setConfirmDel] = useState(false);
  const busy = actionLoading === num.id;
  const pal  = bp(num.branch);

  return (
    <tr style={{ background: num.is_active ? "#fff" : "#fafafa", borderBottom: "1px solid #f0f0f0", opacity: num.is_active ? 1 : 0.65 }}>
      {/* Status dot */}
      <td style={{ padding: "12px 16px", width: 32 }}>
        <span style={{
          display: "inline-block", width: 10, height: 10, borderRadius: "50%",
          background: num.is_active ? "#4caf50" : "#e0e0e0",
          boxShadow: num.is_active ? "0 0 0 3px rgba(76,175,80,0.2)" : "none",
        }} />
      </td>

      {/* Phone */}
      <td style={{ padding: "12px 10px" }}>
        <code style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", letterSpacing: "0.3px" }}>
          {num.phone_number}
        </code>
      </td>

      {/* Label */}
      <td style={{ padding: "12px 10px", fontSize: 13, color: "#555", maxWidth: 200 }}>
        {num.label}
      </td>

      {/* Branch (superadmin only) */}
      {showBranch && (
        <td style={{ padding: "12px 10px" }}>
          <span style={{
            background: pal.bg, color: pal.text, border: `1px solid ${pal.border}`,
            borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700,
          }}>
            {num.branch}
          </span>
        </td>
      )}

      {/* Status badge */}
      <td style={{ padding: "12px 10px" }}>
        <span style={{
          background: num.is_active ? "#e8f5e9" : "#f5f5f5",
          color:      num.is_active ? "#2e7d32"  : "#9e9e9e",
          borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700,
        }}>
          {num.is_active ? "Active" : "Disabled"}
        </span>
      </td>

      {/* Actions */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Toggle active */}
          <button
            disabled={busy}
            onClick={() => onToggle(num.id, !num.is_active)}
            title={num.is_active ? "Disable number" : "Enable number"}
            style={{
              padding: "5px 12px", borderRadius: 8, border: "none", cursor: busy ? "not-allowed" : "pointer",
              fontSize: 12, fontWeight: 700,
              background: num.is_active ? "#fff3e0" : "#e8f5e9",
              color:      num.is_active ? "#e65100"  : "#2e7d32",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? "…" : num.is_active ? "Disable" : "Enable"}
          </button>

          {/* Delete */}
          {confirmDel ? (
            <>
              <button
                disabled={busy}
                onClick={async () => { await onDelete(num.id); setConfirmDel(false); }}
                style={{ padding: "5px 10px", borderRadius: 8, border: "none", cursor: busy ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, background: "#dc2626", color: "#fff" }}
              >
                {busy ? "…" : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", cursor: "pointer", fontSize: 12, color: "#888" }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              title="Delete number"
              style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#dc2626" }}
            >
              🗑 Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ManageNumbersPanel({ isSuperadmin, adminBranch, getAuthHeader }: ManageNumbersPanelProps) {
  // Superadmin can switch between branches via tab bar; admin is locked.
  const [activeBranch, setActiveBranch] = useState<string>(
    isSuperadmin ? BRANCHES[0] : (adminBranch ?? BRANCHES[0])
  );

  const [numbers,       setNumbers]       = useState<WaNumber[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchErr,      setFetchErr]      = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    setFetchErr(null);
    try {
      const headers = await getAuthHeader();
      const params  = new URLSearchParams();
      if (isSuperadmin && activeBranch) params.set("branch", activeBranch);

      const res  = await fetch(`${SERVER_URL}/admin/whatsapp-numbers?${params}`, { headers: headers as Record<string, string> });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFetchErr(data.error ?? `Server error (${res.status})`);
        return;
      }
      setNumbers(data.numbers as WaNumber[]);
    } catch (err) {
      setFetchErr(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, isSuperadmin, activeBranch]);

  useEffect(() => { fetchNumbers(); }, [fetchNumbers]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleToggle = async (id: string, newActive: boolean) => {
    setActionLoading(id);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${SERVER_URL}/admin/whatsapp-numbers/${id}`, {
        method: "POST",
        headers: { ...(headers as Record<string, string>), "Content-Type": "application/json" },
        body: JSON.stringify({ _method: "PATCH", is_active: newActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error ?? "Update failed"); return; }
      setNumbers((prev) => prev.map((n) => n.id === id ? { ...n, is_active: newActive } : n));
      toast.success(newActive ? "Number enabled ✅" : "Number disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`${SERVER_URL}/admin/whatsapp-numbers/${id}`, {
        method: "POST",
        headers: { ...(headers as Record<string, string>), "Content-Type": "application/json" },
        body: JSON.stringify({ _method: "DELETE" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error ?? "Delete failed"); return; }
      setNumbers((prev) => prev.filter((n) => n.id !== id));
      toast.success("Number deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdd = (newNum: WaNumber) => {
    // Only prepend to list if it matches the current view
    if (!isSuperadmin || newNum.branch === activeBranch) {
      setNumbers((prev) => [...prev, newNum]);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const displayNumbers = isSuperadmin
    ? numbers.filter((n) => n.branch === activeBranch)
    : numbers;

  const activeCount   = displayNumbers.filter((n) => n.is_active).length;
  const inactiveCount = displayNumbers.length - activeCount;
  const palette       = bp(activeBranch);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.07)", padding: "28px 28px 32px", marginTop: 6 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #5a8f5c, #4a7a4f)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          📱
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>
            Manage WhatsApp Numbers
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#aaa" }}>
            {isSuperadmin
              ? "Add, disable or remove numbers across all branches"
              : `Managing numbers for ${adminBranch ?? "your branch"}`}
          </p>
        </div>
        <button
          onClick={() => fetchNumbers()}
          disabled={loading}
          style={{ padding: "6px 14px", borderRadius: 9, border: "1px solid #e0e0e0", background: "#fff", color: "#888", fontSize: 12, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "⏳" : "🔄"} Refresh
        </button>
      </div>

      {/* Branch tabs — superadmin only */}
      {isSuperadmin && (
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {BRANCHES.map((br) => {
            const isActive = activeBranch === br;
            const p = bp(br);
            return (
              <button
                key={br}
                onClick={() => setActiveBranch(br)}
                style={{
                  padding: "6px 18px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 700,
                  border: isActive ? `2px solid ${p.accent}` : "1.5px solid #e8e8e8",
                  background: isActive ? p.bg : "#fafafa",
                  color:      isActive ? p.text : "#aaa",
                  transition: "all 0.12s",
                }}
              >
                📍 {br}
              </button>
            );
          })}
        </div>
      )}

      {/* Add number form */}
      <AddNumberForm
        branch={activeBranch}
        isSuperadmin={isSuperadmin}
        onAdd={handleAdd}
        getAuthHeader={getAuthHeader}
      />

      {/* Error */}
      {fetchErr && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", color: "#dc2626", fontSize: 13, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚠️ {fetchErr}</span>
          <button onClick={fetchNumbers} style={{ padding: "4px 12px", borderRadius: 7, border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Retry</button>
        </div>
      )}

      {/* Summary pills */}
      {!loading && !fetchErr && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>
            📍 {activeBranch}
          </span>
          <span style={{ background: "#e8f5e9", color: "#2e7d32", border: "1px solid #a5d6a7", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>
            ✅ {activeCount} Active
          </span>
          {inactiveCount > 0 && (
            <span style={{ background: "#f5f5f5", color: "#888", border: "1px solid #e0e0e0", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>
              ⏸ {inactiveCount} Disabled
            </span>
          )}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#aaa" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
          <p style={{ margin: 0, fontSize: 14 }}>Loading numbers for {activeBranch}…</p>
        </div>
      ) : displayNumbers.length === 0 ? (
        /* Empty state */
        <div style={{ textAlign: "center", padding: "56px 20px", background: "#fafafa", borderRadius: 14, border: "1.5px dashed #e0e0e0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📵</div>
          <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#555" }}>
            No numbers for {activeBranch} yet
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#aaa" }}>
            Use the form above to add the first WhatsApp number for this branch.
          </p>
        </div>
      ) : (
        /* Table */
        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #f0f0f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8faf8" }}>
                {["", "Phone Number", "Display Label", ...(isSuperadmin ? ["Branch"] : []), "Status", "Actions"]
                  .map((h, i) => (
                    <th key={`wn-th-${i}`} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#888", borderBottom: "2px solid #e8e8e8", whiteSpace: "nowrap", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {displayNumbers.map((num) => (
                <NumberRow
                  key={num.id}
                  num={num}
                  showBranch={isSuperadmin}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  actionLoading={actionLoading}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
