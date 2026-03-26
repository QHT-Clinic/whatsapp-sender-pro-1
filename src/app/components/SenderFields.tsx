/**
 * SenderFields — Floating-label form primitives for the Send Message panel
 *
 * Components exported:
 *   SenderInput    — text / tel / email with floating label + violet focus ring
 *   SenderSelect   — custom dropdown (parses <option> children) — fully styled:
 *                    dark text #1a1a1a, font-semibold, generous tap targets,
 *                    violet selected state, hover tint, click-outside close
 *   SenderTextarea — multiline with floating label
 *   SenderFieldSkeleton — animated placeholder while data loads
 *   SenderWarningBox    — amber warning (no numbers / not assigned)
 *   SenderLockBox       — locked state before branch is selected
 */

import React, { useState, useEffect, useRef, forwardRef } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  accent:     "#7C3AED",
  accentBg:   "#F5F3FF",
  accentMid:  "#EDE9FE",
  danger:     "#E11D48",
  border:     "#E2E8F0",
  borderHov:  "#CBD5E1",
  muted:      "#94A3B8",
  label:      "#64748B",
  text:       "#1E293B",
  optText:    "#1a1a1a",
  bg:         "#FFFFFF",
  bgField:    "#F8FAFC",
  bgDrop:     "#FFFFFF",
} as const;

// Sage green for the message textarea focus — distinct from the violet used on other fields
const SAGE = "#059669";

function borderStyle(focused: boolean, hasError: boolean): React.CSSProperties {
  if (hasError) return {
    border:    `1.5px solid ${C.danger}`,
    boxShadow: "0 0 0 3px rgba(225,29,72,0.10)",
    outline:   "none",
  };
  if (focused) return {
    border:    `1.5px solid ${C.accent}`,
    boxShadow: "0 0 0 3px rgba(124,58,237,0.12)",
    outline:   "none",
  };
  return {
    border:    `1.5px solid ${C.border}`,
    boxShadow: "none",
    outline:   "none",
  };
}

// ─── Textarea-specific focus ring (sage green) ────────────────────────────────

function textareaFocusStyle(focused: boolean, hasError: boolean): React.CSSProperties {
  if (hasError) return {
    border:    `1.5px solid ${C.danger}`,
    boxShadow: "0 0 0 3px rgba(225,29,72,0.10)",
    outline:   "none",
  };
  if (focused) return {
    border:    `1.5px solid ${SAGE}`,
    boxShadow: "0 0 0 3px rgba(5,150,105,0.12)",
    outline:   "none",
  };
  return {
    border:    `1.5px solid ${C.border}`,
    boxShadow: "none",
    outline:   "none",
  };
}

// ─── Error message ─────────────────────────────────────────────────────────────

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <svg width={11} height={11} viewBox="0 0 24 24" fill="none"
        stroke={C.danger} strokeWidth={2.5} strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="text-[11px] font-medium" style={{ color: C.danger }}>{msg}</span>
    </div>
  );
}

// ─── SenderInput ──────────────────────────────────────────────────────────────

interface SenderInputProps {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  onBlur?:     () => void;
  error?:      string;
  type?:       string;
  placeholder?: string;
  maxLength?:  number;
  disabled?:   boolean;
}

export const SenderInput = forwardRef<HTMLInputElement, SenderInputProps>(
  ({ label, value, onChange, onBlur, error = "", type = "text", maxLength, disabled }, ref) => {
    const [focused, setFocused] = useState(false);
    const isFloated = focused || value.length > 0;

    return (
      <div>
        <div
          className="relative rounded-xl overflow-hidden transition-all duration-200"
          style={{ background: C.bgField, ...borderStyle(focused, !!error) }}
        >
          <input
            ref={ref}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); onBlur?.(); }}
            maxLength={maxLength}
            disabled={disabled}
            className="w-full bg-transparent text-sm outline-none px-4 pt-6 pb-2.5 font-['Inter',sans-serif]"
            style={{ color: C.text }}
          />
          <label
            className="absolute left-4 pointer-events-none select-none transition-all duration-150"
            style={{
              top:           isFloated ? 7   : 15,
              fontSize:      isFloated ? 10  : 14,
              fontWeight:    isFloated ? 600 : 400,
              color:         isFloated ? (focused ? C.accent : C.label) : C.muted,
              letterSpacing: isFloated ? "0.06em" : "normal",
              textTransform: (isFloated ? "uppercase" : "none") as React.CSSProperties["textTransform"],
            }}
          >
            {label}
          </label>
        </div>
        {error && <ErrorMsg msg={error} />}
      </div>
    );
  }
);
SenderInput.displayName = "SenderInput";

// ─── SenderSelect — Custom dropdown ───────────────────────────────────────────
//
// Accepts the same <option value="...">Label</option> children as a native
// <select> so no call-site changes are needed.  Renders a fully custom overlay
// list so we have 100% control over:
//   • text color  → #1a1a1a (optText) — forced dark on all states
//   • font weight → 600 (semibold)
//   • vertical padding → py-3.5 (generous tap target ≈48 px)
//   • hover state → light violet tint #F5F3FF
//   • selected state → violet left border + #EDE9FE background
//   • no browser-native option rendering quirks

interface OptionData {
  value:    string;
  label:    string;
  disabled?: boolean;
}

/** Extract {value, label} pairs from <option> JSX children */
function parseOptions(children: React.ReactNode): OptionData[] {
  const opts: OptionData[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    // Support both direct <option> and {condition && <option>} fragments
    if (child.type === "option") {
      const p = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
      opts.push({
        value:    p.value ?? "",
        label:    String(p.children ?? ""),
        disabled: p.disabled,
      });
    }
  });
  return opts;
}

interface SenderSelectProps {
  label:     string;
  value:     string;
  onChange:  (v: string) => void;
  onBlur?:   () => void;
  error?:    string;
  disabled?: boolean;
  children:  React.ReactNode;
}

export function SenderSelect({
  label, value, onChange, onBlur, error = "", disabled, children,
}: SenderSelectProps) {
  const [open,    setOpen]    = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const options     = parseOptions(children);
  const selected    = options.find((o) => o.value === value);
  const placeholder = options.find((o) => o.value === "");
  const hasValue    = !!value;

  // ── Click-outside to close ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocused(false);
        onBlur?.();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onBlur]);

  // ── Keyboard navigation ─────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
    if (e.key === "Escape") { setOpen(false); setFocused(false); onBlur?.(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const pickable = options.filter((o) => o.value !== "" && !o.disabled);
      const curIdx   = pickable.findIndex((o) => o.value === value);
      const nextIdx  = e.key === "ArrowDown"
        ? Math.min(curIdx + 1, pickable.length - 1)
        : Math.max(curIdx - 1, 0);
      if (pickable[nextIdx]) onChange(pickable[nextIdx].value);
    }
  };

  const handleSelect = (opt: OptionData) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setFocused(false);
    onBlur?.();
  };

  return (
    <div ref={containerRef} className="relative">
      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) { setOpen((o) => !o); setFocused(true); } }}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        className="relative rounded-xl transition-all duration-200 select-none"
        style={{
          background: disabled ? "#F1F5F9" : C.bgField,
          cursor:     disabled ? "not-allowed" : "pointer",
          minHeight:  56,
          ...borderStyle(open || focused, !!error),
        }}
      >
        {/* Always-floated label */}
        <span
          className="absolute left-4 pointer-events-none"
          style={{
            top:           7,
            fontSize:      10,
            fontWeight:    600,
            color:         (open || focused) ? C.accent : C.label,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            transition:    "color 150ms",
          }}
        >
          {label}
        </span>

        {/* Selected value display */}
        <span
          className="absolute left-4 right-10"
          style={{
            top:        28,
            fontSize:   14,
            fontWeight: hasValue ? 600 : 400,
            color:      hasValue ? C.optText : C.muted,
            overflow:   "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {hasValue
            ? selected?.label ?? value
            : (placeholder?.label ?? "Choose…")}
        </span>

        {/* Chevron */}
        <span
          className="absolute right-4 pointer-events-none"
          style={{
            top:       "50%",
            transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
            transition: "transform 200ms ease",
          }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none"
            stroke={(open || focused) ? C.accent : C.muted} strokeWidth={2.5} strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>

      {/* ── Dropdown list ─────────────────────────────────────────────────── */}
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 rounded-xl overflow-hidden z-50"
          style={{
            top:       "calc(100% + 6px)",
            background: C.bgDrop,
            border:    `1.5px solid ${C.border}`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.07)",
            maxHeight:  240,
            overflowY: "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "#E2E8F0 transparent",
          }}
        >
          {options.map((opt) => {
            const isSelected    = opt.value === value;
            const isPlaceholder = opt.value === "";

            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt)}
                className="transition-colors duration-100"
                style={{
                  padding:       "13px 16px 13px 18px",
                  display:       "flex",
                  alignItems:    "center",
                  justifyContent: "space-between",
                  gap:           8,
                  cursor:        opt.disabled ? "not-allowed" : "pointer",
                  // ── KEY FIX: forced dark text everywhere ──────────────────
                  color:         isPlaceholder || opt.disabled
                    ? C.muted
                    : C.optText,
                  fontWeight:    isPlaceholder || opt.disabled ? 400 : 600,
                  fontSize:      13.5,
                  fontFamily:    "Inter, -apple-system, sans-serif",
                  // selected row highlight
                  background:    isSelected ? C.accentMid : "transparent",
                  borderLeft:    isSelected ? `3px solid ${C.accent}` : "3px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected && !opt.disabled) {
                    e.currentTarget.style.background = C.accentBg;
                    e.currentTarget.style.color      = "#3B0764"; // deeper violet on hover
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected && !opt.disabled) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color      = isPlaceholder ? C.muted : C.optText;
                  }
                }}
              >
                <span style={{
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                  flex:         1,
                }}>
                  {opt.label}
                </span>

                {/* Checkmark for selected item */}
                {isSelected && (
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                    stroke={C.accent} strokeWidth={2.5} strokeLinecap="round"
                    style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}

          <style>{`
            [role="listbox"]::-webkit-scrollbar { width: 4px; }
            [role="listbox"]::-webkit-scrollbar-track { background: transparent; }
            [role="listbox"]::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
          `}</style>
        </div>
      )}

      {error && <ErrorMsg msg={error} />}
    </div>
  );
}

// ─── SenderTextarea ────────────────────────────────────────────────────────────
//
// Enhanced UX:
//   • Auto-expands vertically as the agent types (never scrolls internally)
//   • Min height ≈ 7 lines; grows up to the natural content height
//   • Sage green focus ring to distinguish from other violet-accented fields
//   • 15px font / 1.6 line-height for comfortable reading
//   • Integrated bottom bar: Quick-Clear button (left) + char counter (right)
//   • Counter turns amber at 85 % and red at 100 % capacity

interface SenderTextareaProps {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  onBlur?:     () => void;
  error?:      string;
  maxLength?:  number;
  rows?:       number;        // kept for API compat; layout is now driven by auto-resize
  placeholder?: string;
}

const TEXTAREA_MIN_H = 148; // px — comfortable starting height (~7 lines at 15px/1.6)

export function SenderTextarea({
  label, value, onChange, onBlur, error = "", maxLength,
}: SenderTextareaProps) {
  const [focused, setFocused] = useState(false);
  const isFloated = focused || value.length > 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const max = maxLength ?? 1024;

  // ── Auto-resize: recalculate height every time value changes ────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";                                   // shrink to 0 first
    el.style.height = `${Math.max(el.scrollHeight, TEXTAREA_MIN_H)}px`; // then expand
  }, [value]);

  const handleClear = () => {
    onChange("");
    textareaRef.current?.focus();
  };

  const nearLimit = value.length > max * 0.85;
  const atLimit   = value.length >= max;

  return (
    <div>
      <div
        className="relative rounded-xl overflow-hidden transition-all duration-200"
        style={{ background: C.bgField, ...textareaFocusStyle(focused, !!error) }}
      >
        {/* ── Actual textarea ────────────────────────────────────────────── */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          maxLength={max}
          className="w-full bg-transparent outline-none px-4 pt-7 pb-10 resize-none font-['Inter',sans-serif] block"
          style={{
            color:      C.text,
            fontSize:   15,
            lineHeight: 1.6,
            minHeight:  TEXTAREA_MIN_H,
            overflowY:  "hidden", // never show internal scrollbar — height grows instead
          }}
        />

        {/* ── Floating label ─────────────────────────────────────────────── */}
        <label
          className="absolute left-4 pointer-events-none select-none transition-all duration-150"
          style={{
            top:           isFloated ? 7   : 14,
            fontSize:      isFloated ? 10  : 14,
            fontWeight:    isFloated ? 600 : 400,
            color:         isFloated ? (focused ? SAGE : C.label) : C.muted,
            letterSpacing: isFloated ? "0.06em" : "normal",
            textTransform: (isFloated ? "uppercase" : "none") as React.CSSProperties["textTransform"],
          }}
        >
          {label}
        </label>

        {/* ── Integrated bottom bar ──────────────────────────────────────── */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-between"
          style={{
            padding:     "5px 12px 5px 14px",
            borderTop:   `1px solid ${focused ? "rgba(5,150,105,0.15)" : "#F1F5F9"}`,
            background:  focused ? "rgba(240,253,249,0.95)" : C.bgField,
            transition:  "background 200ms, border-color 200ms",
          }}
        >
          {/* Clear button — only visible when field has content */}
          {value.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              title="Clear message"
              className="flex items-center gap-1 rounded-lg border-0 cursor-pointer transition-all duration-150"
              style={{
                padding:    "2px 7px",
                fontSize:    10,
                fontWeight:  600,
                background: "transparent",
                color:       C.muted,
                border:     `1px solid ${C.border}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background   = "#FEE2E2";
                e.currentTarget.style.color        = "#E11D48";
                e.currentTarget.style.borderColor  = "#FECACA";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background   = "transparent";
                e.currentTarget.style.color        = C.muted;
                e.currentTarget.style.borderColor  = C.border;
              }}
            >
              {/* ✕ icon */}
              <svg width={8} height={8} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Clear
            </button>
          ) : (
            // Empty spacer so the counter stays right-aligned when there's no clear btn
            <div />
          )}

          {/* Character counter */}
          <span
            style={{
              fontSize:      10,
              fontWeight:    nearLimit ? 600 : 400,
              color:         atLimit ? C.danger : nearLimit ? "#F59E0B" : C.muted,
              letterSpacing: "0.02em",
              transition:    "color 200ms",
              fontFamily:    "Inter, sans-serif",
              tabularNums:   "tabular-nums",
            } as React.CSSProperties}
          >
            {value.length} / {max}
          </span>
        </div>
      </div>
      {error && <ErrorMsg msg={error} />}
    </div>
  );
}

// ─── SenderFieldSkeleton ──────────────────────────────────────────────────────

export function SenderFieldSkeleton({ label }: { label: string }) {
  return (
    <div>
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ border: `1.5px solid ${C.border}`, background: C.bgField, height: 56 }}
      >
        <div
          className="absolute left-4 top-[7px] h-[10px] w-28 rounded"
          style={{
            background: "linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)",
            backgroundSize: "200% 100%",
            animation: "skeletonShimmer 1.5s infinite",
          }}
        />
        <div
          className="absolute left-4 top-[26px] h-3 w-24 rounded"
          style={{
            background: "linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)",
            backgroundSize: "200% 100%",
            animation: "skeletonShimmer 1.5s infinite",
          }}
        />
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[12px]"
          style={{ color: C.muted }}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
            stroke={C.muted} strokeWidth={2.5}
            style={{ animation: "spin 0.9s linear infinite", flexShrink: 0 }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
          Loading…
        </div>
      </div>
      <style>{`
        @keyframes skeletonShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

// ─── SenderWarningBox ─────────────────────────────────────────────────────────

export function SenderWarningBox({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-start gap-3"
      style={{ background: "#FFF7ED", border: "1.5px solid #FED7AA" }}
    >
      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>📵</span>
      <div>
        <p className="text-[13px] font-semibold" style={{ color: "#92400E" }}>{title}</p>
        <p className="text-[11px] mt-0.5" style={{ color: "#B45309" }}>{subtitle}</p>
      </div>
    </div>
  );
}

// ─── SenderLockBox ────────────────────────────────────────────────���───────────

export function SenderLockBox({ label }: { label: string }) {
  return (
    <div>
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ background: C.bgField, border: `1.5px dashed ${C.border}`, height: 56 }}
      >
        <label
          className="absolute left-4 pointer-events-none"
          style={{
            top: 7, fontSize: 10, fontWeight: 600,
            color: C.label, textTransform: "uppercase", letterSpacing: "0.06em",
          }}
        >
          {label}
        </label>
        <div className="absolute left-4 bottom-2.5 flex items-center gap-2">
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth={2}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="text-[12px]" style={{ color: C.muted }}>Select a branch first</span>
        </div>
      </div>
    </div>
  );
}