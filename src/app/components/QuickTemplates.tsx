/**
 * QuickTemplates v5.0 — Real agent templates from global_templates table.
 *
 * Drop-in replacement for v4 — identical props interface, same export name.
 * Hard-coded GLOBAL_ENGLISH / GLOBAL_HINGLISH arrays removed.
 * Data is fetched from Supabase scoped to auth.uid() via RLS.
 *
 * Design tokens:
 *   Violet:  #7C3AED / #5B21B6 / #EDE9FE / #DDD6FE / #F5F3FF
 *   Text:    #1E293B / #334155 / #64748B / #94A3B8
 *   Border:  #E2E8F0 / #F1F5F9
 *   Danger:  #E11D48
 *   Font:    Inter
 */

import React, { useState, useRef, useCallback } from "react";
import { useQuickTemplates } from "@/hooks/useQuickTemplates";
import type { AgentQuickTemplate, CreateQuickTemplateInput } from "@/hooks/useQuickTemplates";

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuickTemplatesProps {
  onSelectTemplate: (message: string) => void;
  userBranch?:      string | null;
  fillHeight?:      boolean;
  loading?:         boolean;
  peekLabel?:       string;
}

// ─── Variable chips ───────────────────────────────────────────────────────────

const VARIABLE_CHIPS = ["{name}", "{lead_id}", "{agent_name}", "{clinic_name}"] as const;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-1.5 p-1">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="rounded-xl animate-pulse"
          style={{
            height:          i % 3 === 0 ? 52 : 40,
            background:      "linear-gradient(90deg,#f1f5f9 25%,#e8edf3 50%,#f1f5f9 75%)",
            backgroundSize:  "200% 100%",
            animation:       "skShimmer 1.5s infinite",
          }}
        />
      ))}
      <style>{`@keyframes skShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ language }: { language: "english" | "hinglish" }) {
  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        justifyContent: "center",
        padding:       "28px 16px",
        textAlign:     "center",
      }}
    >
      {/* MessageSquare icon */}
      <svg
        width={32}
        height={32}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginBottom: 10 }}
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <p
        style={{
          margin:     0,
          fontSize:   13,
          fontWeight: 600,
          color:      "#64748B",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {language === "english" ? "No English templates yet" : "No Hinglish templates yet"}
      </p>
      <p
        style={{
          margin:     "4px 0 0",
          fontSize:   12,
          color:      "#94A3B8",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Add your first template below
      </p>
    </div>
  );
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────

interface TemplateModalProps {
  title:           string;
  defaultLanguage: "en" | "hinglish";
  initialData?:    { id: string; name: string; content: string; language: "en" | "hinglish" };
  onClose:         () => void;
  onSubmit:        (name: string, content: string, language: "en" | "hinglish") => Promise<boolean>;
}

function TemplateModal({
  title,
  defaultLanguage,
  initialData,
  onClose,
  onSubmit,
}: TemplateModalProps) {
  const [name, setName]         = useState(initialData?.name    ?? "");
  const [content, setContent]   = useState(initialData?.content ?? "");
  const [language, setLanguage] = useState<"en" | "hinglish">(
    initialData?.language ?? defaultLanguage
  );
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);

  const canSave = name.trim().length > 0 && content.trim().length > 0 && !saving;

  const insertVariable = useCallback(
    (variable: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      const next  = (content.substring(0, start) + variable + content.substring(end)).slice(0, 1000);
      setContent(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + variable.length, start + variable.length);
      });
    },
    [content]
  );

  const handleSubmit = async () => {
    if (!canSave) return;
    setError(null);
    setSaving(true);
    const ok = await onSubmit(name.trim(), content.trim(), language);
    setSaving(false);
    if (ok) {
      onClose();
    } else {
      setError("Save failed. Please try again.");
    }
  };

  return (
    <div
      style={{
        position:       "fixed",
        inset:          0,
        background:     "rgba(15,12,50,0.55)",
        backdropFilter: "blur(4px)",
        zIndex:         1000,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background:   "#FFFFFF",
          borderRadius: 20,
          width:        440,
          maxWidth:     "100%",
          padding:      "28px 28px 24px",
          boxShadow:    "0 20px 60px rgba(0,0,0,0.18)",
          border:       "1.5px solid #E2E8F0",
          maxHeight:    "90vh",
          overflowY:    "auto",
        }}
      >
        {/* ── Modal header ── */}
        <div style={{ marginBottom: 20 }}>
          <h3
            style={{
              color:      "#1E293B",
              fontSize:   16,
              fontWeight: 700,
              margin:     0,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {title}
          </h3>
          <p
            style={{
              color:      "#94A3B8",
              fontSize:   12,
              margin:     "4px 0 0",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Templates are visible only to you.
          </p>
        </div>

        {/* ── Template name ── */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display:    "block",
              fontSize:   12,
              fontWeight: 600,
              color:      "#374151",
              marginBottom: 6,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Template Name <span style={{ color: "#E11D48" }}>*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
            placeholder="e.g. Appointment Reminder"
            maxLength={80}
            style={{
              width:      "100%",
              padding:    "8px 12px",
              border:     "1.5px solid #E2E8F0",
              borderRadius: 10,
              fontSize:   13,
              color:      "#1E293B",
              fontFamily: "Inter, sans-serif",
              outline:    "none",
              boxSizing:  "border-box",
            }}
            onFocus={(e)  => { e.currentTarget.style.borderColor = "#7C3AED"; }}
            onBlur={(e)   => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
          />
          <div
            style={{
              textAlign:  "right",
              fontSize:   10,
              color:      "#94A3B8",
              marginTop:  3,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {name.length}/80
          </div>
        </div>

        {/* ── Language toggle ── */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display:    "block",
              fontSize:   12,
              fontWeight: 600,
              color:      "#374151",
              marginBottom: 6,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Language
          </label>
          <div
            className="relative flex items-center p-0.5 rounded-xl"
            style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", width: "fit-content" }}
          >
            {/* Sliding pill */}
            <div
              className="absolute rounded-lg transition-transform duration-200 ease-out"
              style={{
                top:        2,
                bottom:     2,
                width:      "calc(50% - 2px)",
                background: "#FFFFFF",
                boxShadow:  "0 1px 4px rgba(0,0,0,0.10)",
                transform:  language === "en"
                  ? "translateX(2px)"
                  : "translateX(calc(100% + 2px))",
              }}
            />
            {(["en", "hinglish"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className="relative z-10 text-[11px] font-semibold rounded-lg border-0 cursor-pointer transition-colors duration-150"
                style={{
                  padding:    "5px 14px",
                  background: "transparent",
                  color:      language === lang ? "#1E293B" : "#94A3B8",
                  whiteSpace: "nowrap",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {lang === "en" ? "🇬🇧 English" : "🇮🇳 Hinglish"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Message content ── */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display:    "block",
              fontSize:   12,
              fontWeight: 600,
              color:      "#374151",
              marginBottom: 6,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Message Content <span style={{ color: "#E11D48" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 1000))}
              placeholder="Type your WhatsApp message here…"
              maxLength={1000}
              style={{
                width:        "100%",
                minHeight:    120,
                padding:      "10px 12px",
                border:       "1.5px solid #E2E8F0",
                borderRadius: 10,
                fontSize:     13,
                color:        "#1E293B",
                fontFamily:   "Inter, sans-serif",
                outline:      "none",
                resize:       "vertical",
                boxSizing:    "border-box",
                lineHeight:   1.6,
              }}
              onFocus={(e)  => { e.currentTarget.style.borderColor = "#7C3AED"; }}
              onBlur={(e)   => { e.currentTarget.style.borderColor = "#E2E8F0"; }}
            />
            <div
              style={{
                textAlign:  "right",
                fontSize:   10,
                color:      content.length >= 900 ? "#E11D48" : "#94A3B8",
                marginTop:  3,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {content.length} / 1000
            </div>
          </div>

          {/* Variable helper chips */}
          <div style={{ marginTop: 8 }}>
            <span
              style={{
                fontSize:   11,
                color:      "#94A3B8",
                fontFamily: "Inter, sans-serif",
                marginRight: 6,
              }}
            >
              Insert variable:
            </span>
            {VARIABLE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => insertVariable(chip)}
                style={{
                  display:      "inline-block",
                  margin:       "3px 4px 3px 0",
                  padding:      "2px 8px",
                  background:   "#EDE9FE",
                  color:        "#7C3AED",
                  border:       "1px solid #DDD6FE",
                  borderRadius: 20,
                  fontSize:     11,
                  fontFamily:   "Inter, monospace",
                  cursor:       "pointer",
                  fontWeight:   500,
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* ── Inline error ── */}
        {error && (
          <div
            style={{
              padding:      "8px 12px",
              borderRadius: 8,
              background:   "#FFF1F2",
              border:       "1px solid #FECDD3",
              fontSize:     12,
              color:        "#E11D48",
              marginBottom: 16,
              fontFamily:   "Inter, sans-serif",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Buttons ── */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              flex:         1,
              padding:      "9px 0",
              border:       "1.5px solid #E2E8F0",
              borderRadius: 10,
              background:   "#F8FAFC",
              color:        "#64748B",
              fontSize:     13,
              fontWeight:   600,
              cursor:       saving ? "not-allowed" : "pointer",
              fontFamily:   "Inter, sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSave}
            style={{
              flex:           1,
              padding:        "9px 0",
              border:         "none",
              borderRadius:   10,
              background:     canSave ? "#7C3AED" : "#C4B5FD",
              color:          "#FFFFFF",
              fontSize:       13,
              fontWeight:     600,
              cursor:         canSave ? "pointer" : "not-allowed",
              fontFamily:     "Inter, sans-serif",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            6,
            }}
          >
            {saving ? (
              <>
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  style={{ animation: "qt-spin 0.8s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Saving…
              </>
            ) : (
              "Save Template"
            )}
          </button>
        </div>
      </div>
      <style>{`@keyframes qt-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Template row ─────────────────────────────────────────────────────────────

interface TemplateRowProps {
  template:        AgentQuickTemplate;
  isConfirming:    boolean;
  onSelect:        () => void;
  onEdit:          () => void;
  onConfirmToggle: () => void;
  onConfirmDelete: () => void;
  onCancelDelete:  () => void;
}

function TemplateRow({
  template,
  isConfirming,
  onSelect,
  onEdit,
  onConfirmToggle,
  onConfirmDelete,
  onCancelDelete,
}: TemplateRowProps) {
  const preview = template.content.length > 80
    ? template.content.substring(0, 80) + "…"
    : template.content;

  return (
    <div className="quick-row-wrap">
      <div style={{ position: "relative", display: "flex", alignItems: "stretch" }}>
        {/* Main selectable button */}
        <button
          type="button"
          onClick={onSelect}
          className="quick-row-btn"
          style={{
            flex:        1,
            textAlign:   "left",
            borderRadius: 12,
            cursor:      "pointer",
            display:     "flex",
            alignItems:  "flex-start",
            gap:         10,
            padding:     "10px 80px 10px 14px",  // right space for action icons
            background:  "#FAFAFA",
            color:       "#334155",
            border:      "1.5px solid transparent",
            borderLeft:  "3px solid transparent",
            fontFamily:  "Inter, sans-serif",
            transition:  "all 0.15s",
            width:       "100%",
          }}
        >
          {/* Violet dot */}
          <span
            style={{
              width:      8,
              height:     8,
              borderRadius: "50%",
              flexShrink: 0,
              background: "#DDD6FE",
              marginTop:  5,
            }}
          />
          {/* Name + preview */}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                display:      "block",
                fontSize:     13,
                fontWeight:   600,
                color:        "#1E293B",
                overflow:     "hidden",
                textOverflow: "ellipsis",
                whiteSpace:   "nowrap",
              }}
            >
              {template.name}
            </span>
            <span
              style={{
                display:      "block",
                fontSize:     11,
                color:        "#94A3B8",
                overflow:     "hidden",
                textOverflow: "ellipsis",
                whiteSpace:   "nowrap",
                marginTop:    2,
              }}
            >
              {preview}
            </span>
          </span>
        </button>

        {/* Action icons — appear on .quick-row-wrap:hover via CSS */}
        <div
          style={{
            position:  "absolute",
            right:     10,
            top:       "50%",
            transform: "translateY(-50%)",
            display:   "flex",
            gap:       4,
            alignItems: "center",
          }}
        >
          {/* Pencil / Edit */}
          <button
            type="button"
            className="quick-row-edit"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Edit template"
            style={{
              background:   "none",
              border:       "none",
              cursor:       "pointer",
              padding:      "4px 5px",
              borderRadius: 6,
              color:        "#94A3B8",
              display:      "flex",
              alignItems:   "center",
              opacity:      0,
              transition:   "opacity 0.15s, color 0.15s",
            }}
          >
            <svg
              width={13}
              height={13}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>

          {/* Trash / Delete */}
          <button
            type="button"
            className="quick-row-trash"
            onClick={(e) => { e.stopPropagation(); onConfirmToggle(); }}
            title="Delete template"
            style={{
              background:   "none",
              border:       "none",
              cursor:       "pointer",
              padding:      "4px 5px",
              borderRadius: 6,
              color:        "#94A3B8",
              display:      "flex",
              alignItems:   "center",
              opacity:      0,
              transition:   "opacity 0.15s, color 0.15s",
            }}
          >
            <svg
              width={13}
              height={13}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Inline delete confirm */}
      {isConfirming && (
        <div
          style={{
            margin:         "3px 2px 4px",
            padding:        "8px 12px",
            background:     "#FFF1F2",
            border:         "1.5px solid #FECDD3",
            borderRadius:   10,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            gap:            8,
          }}
        >
          <span
            style={{
              fontSize:   11,
              color:      "#9F1239",
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
            }}
          >
            Delete this template?
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={onCancelDelete}
              style={{
                padding:      "3px 10px",
                border:       "1px solid #E2E8F0",
                borderRadius: 7,
                background:   "#FFFFFF",
                color:        "#64748B",
                fontSize:     11,
                fontWeight:   600,
                cursor:       "pointer",
                fontFamily:   "Inter, sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmDelete}
              style={{
                padding:      "3px 10px",
                border:       "none",
                borderRadius: 7,
                background:   "#E11D48",
                color:        "#FFFFFF",
                fontSize:     11,
                fontWeight:   600,
                cursor:       "pointer",
                fontFamily:   "Inter, sans-serif",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuickTemplates({
  onSelectTemplate,
  userBranch: _userBranch,  // kept for interface compat — filtering is server-side now
  fillHeight = false,
  loading    = false,
  peekLabel,
}: QuickTemplatesProps) {
  const {
    englishTemplates,
    hinglishTemplates,
    loading:     hookLoading,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  } = useQuickTemplates();

  const [activeTab, setActiveTab]           = useState<"english" | "hinglish">("english");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modal state: null = closed
  const [modal, setModal] = useState<{
    mode:       "add" | "edit";
    template?:  AgentQuickTemplate;
  } | null>(null);

  const isLoading      = loading || hookLoading;
  const activeTemplates = activeTab === "english" ? englishTemplates : hinglishTemplates;

  const openAdd = () => {
    setModal({ mode: "add" });
  };

  const openEdit = (template: AgentQuickTemplate) => {
    setModal({ mode: "edit", template });
  };

  const handleModalSubmit = useCallback(
    async (name: string, content: string, language: "en" | "hinglish"): Promise<boolean> => {
      if (modal?.mode === "edit" && modal.template) {
        return updateTemplate(modal.template.id, { name, content, language });
      }
      return addTemplate({ name, content, language });
    },
    [modal, addTemplate, updateTemplate]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setConfirmDeleteId(null);
      await deleteTemplate(id);
    },
    [deleteTemplate]
  );

  return (
    <div
      className={`w-full ${fillHeight ? "h-full flex flex-col" : ""}`}
      style={{
        background:   "#FFFFFF",
        borderRadius:  20,
        overflow:      "hidden",
        border:       "1.5px solid #E2E8F0",
        boxShadow:    "0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Peek bar ──────────────────────────────────────────────────── */}
      {peekLabel && (
        <div
          className="flex-shrink-0 flex items-center justify-center gap-2 py-2.5 cursor-pointer"
          style={{
            background:   "linear-gradient(90deg, #EDE9FE, #F5F3FF)",
            borderBottom: "1.5px solid #DDD6FE",
          }}
        >
          <svg
            width={11}
            height={11}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7C3AED"
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
          <span className="text-[11px] font-semibold" style={{ color: "#7C3AED" }}>
            {peekLabel}
          </span>
        </div>
      )}

      {/* ── Header — 72px zone ────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 pt-4 pb-0"
        style={{
          minHeight:      peekLabel ? "auto" : 72,
          display:        "flex",
          flexDirection:  "column",
          justifyContent: "center",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          {/* Title */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: "linear-gradient(135deg, #EDE9FE, #DDD6FE)" }}
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7C3AED"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div>
              <h2
                className="text-sm font-semibold leading-none"
                style={{ color: "#1E293B", letterSpacing: "-0.01em" }}
              >
                Quick Templates
              </h2>
              <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>
                {isLoading
                  ? "Loading…"
                  : `${activeTemplates.length} message${activeTemplates.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {/* Pill toggle: English / Hinglish */}
          <div
            className="relative flex items-center p-0.5 rounded-xl"
            style={{ background: "#F1F5F9", border: "1px solid #E2E8F0" }}
          >
            {/* Sliding indicator */}
            <div
              className="absolute rounded-lg transition-transform duration-200 ease-out"
              style={{
                top:        2,
                bottom:     2,
                width:      "calc(50% - 2px)",
                background: "#FFFFFF",
                boxShadow:  "0 1px 4px rgba(0,0,0,0.10)",
                transform:  activeTab === "english"
                  ? "translateX(2px)"
                  : "translateX(calc(100% + 2px))",
              }}
            />
            {(["english", "hinglish"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="relative z-10 flex items-center gap-1 text-[11px] font-semibold rounded-lg border-0 cursor-pointer transition-colors duration-150"
                style={{
                  padding:    "5px 10px",
                  background: "transparent",
                  color:      activeTab === tab ? "#1E293B" : "#94A3B8",
                  whiteSpace: "nowrap",
                }}
              >
                {tab === "english" ? "🇬🇧 EN" : "🇮🇳 HI"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Template list ─────────────────────────────────────────────── */}
      <div
        className={`${fillHeight ? "flex-1 min-h-0" : ""} overflow-y-auto px-3 pb-3 pt-2`}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#E2E8F0 transparent" }}
      >
        {isLoading ? (
          <SkeletonRows />
        ) : activeTemplates.length === 0 ? (
          <EmptyState language={activeTab} />
        ) : (
          <div className="flex flex-col gap-1">
            {activeTemplates.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                isConfirming={confirmDeleteId === template.id}
                onSelect={() => onSelectTemplate(template.content)}
                onEdit={() => openEdit(template)}
                onConfirmToggle={() =>
                  setConfirmDeleteId(confirmDeleteId === template.id ? null : template.id)
                }
                onConfirmDelete={() => handleDelete(template.id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
              />
            ))}
          </div>
        )}

        {/* ── "+ New Template" button — always visible when not loading ── */}
        {!isLoading && (
          <button
            type="button"
            onClick={openAdd}
            style={{
              marginTop:      activeTemplates.length === 0 ? 0 : 10,
              width:          "100%",
              padding:        "9px 0",
              border:         "1.5px dashed #7C3AED",
              borderRadius:   12,
              background:     "#F5F3FF",
              color:          "#7C3AED",
              fontSize:       12,
              fontWeight:     600,
              cursor:         "pointer",
              fontFamily:     "Inter, sans-serif",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              gap:            5,
            }}
          >
            <svg
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7C3AED"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Template
          </button>
        )}

        <style>{`
          /* Scrollbar */
          .overflow-y-auto::-webkit-scrollbar { width: 4px; }
          .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
          .overflow-y-auto::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
          .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }

          /* Row hover — reveal action icons, apply violet tint */
          .quick-row-wrap:hover .quick-row-edit,
          .quick-row-wrap:hover .quick-row-trash { opacity: 1 !important; }
          .quick-row-wrap:hover .quick-row-edit:hover { color: #7C3AED !important; }
          .quick-row-wrap:hover .quick-row-trash:hover { color: #E11D48 !important; }

          .quick-row-wrap:hover .quick-row-btn {
            background:  #F5F3FF !important;
            color:       #5B21B6 !important;
            border:      1.5px solid #DDD6FE !important;
            border-left: 3px solid #7C3AED !important;
            transform:   scale(1.005) translateX(2px) !important;
            box-shadow:  0 2px 12px rgba(124,58,237,0.10) !important;
          }
          /* Violet dot brightens on hover */
          .quick-row-wrap:hover .quick-row-btn span:first-child {
            background: #7C3AED !important;
            box-shadow: 0 0 6px rgba(124,58,237,0.4) !important;
          }
        `}</style>
      </div>

      {/* ── Add / Edit modal ─────────────────────────────────────────── */}
      {modal && (
        <TemplateModal
          title={modal.mode === "add" ? "New Template" : "Edit Template"}
          defaultLanguage={activeTab === "english" ? "en" : "hinglish"}
          initialData={
            modal.template
              ? {
                  id:       modal.template.id,
                  name:     modal.template.name,
                  content:  modal.template.content,
                  language: modal.template.language,
                }
              : undefined
          }
          onClose={() => setModal(null)}
          onSubmit={handleModalSubmit}
        />
      )}
    </div>
  );
}
