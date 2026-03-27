/**
 * ImageTemplates v5.0 — Real agent images from Supabase Storage.
 *
 * Drop-in replacement for v4 — identical props interface, same export name.
 * Unsplash hard-codes removed; images are fetched from global_templates
 * (template_type='image') scoped to the authenticated agent via RLS.
 *
 * Design tokens:
 *   Primary bg    #F8FAFC   Card border   #E2E8F0
 *   Accent violet #7C3AED   Accent blue   #2563EB
 *   Text primary  #1E293B   Text muted    #94A3B8
 *   Success       #059669   Danger        #E11D48
 *   Font          Inter
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useImageTemplates } from "@/hooks/useImageTemplates";
import type { AgentImageTemplate } from "@/hooks/useImageTemplates";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ImageTemplatesProps {
  onSelectImage:    (url: string) => void;
  selectedImageUrl: string | null;
  userBranch?:      string | null;
  fillHeight?:      boolean;
  loading?:         boolean;
  peekLabel?:       string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-1.5 p-1">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl flex items-center gap-3 px-3 animate-pulse"
          style={{ height: 60, background: "#F8FAFC", border: "1.5px solid #F1F5F9" }}
        >
          <div
            className="flex-shrink-0 rounded"
            style={{ width: 40, height: 40, background: "#E2E8F0", borderRadius: 6 }}
          />
          <div className="flex-1 h-3 rounded" style={{ background: "#E2E8F0" }} />
        </div>
      ))}
    </div>
  );
}

// ─── Thumbnail with gray fallback ─────────────────────────────────────────────

function Thumbnail({ url, name }: { url: string; name: string }) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div
        className="flex-shrink-0"
        style={{ width: 40, height: 40, background: "#E2E8F0", borderRadius: 6 }}
      />
    );
  }

  return (
    <img
      src={url}
      alt={name}
      onError={() => setErrored(true)}
      style={{
        width: 40,
        height: 40,
        objectFit: "cover",
        borderRadius: 6,
        flexShrink: 0,
        border: "1px solid #E2E8F0",
        display: "block",
      }}
    />
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        textAlign: "center",
      }}
    >
      {/* ImageOff icon */}
      <svg
        width={40}
        height={40}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#CBD5E1"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginBottom: 12 }}
      >
        <line x1="2" y1="2" x2="22" y2="22" />
        <path d="M10.41 10.41a2 2 0 1 1-2.83-2.83" />
        <line x1="13.5" y1="6" x2="19" y2="6" />
        <path d="M19.59 14.59A5 5 0 0 1 19 15H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h.59" />
        <polyline points="3 15 8 10 11 13" />
      </svg>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 600,
          color: "#64748B",
          fontFamily: "Inter, sans-serif",
        }}
      >
        No image templates yet
      </p>
      <p
        style={{
          margin: "4px 0 16px",
          fontSize: 12,
          color: "#94A3B8",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Upload your first image to use in WhatsApp messages
      </p>
      <button
        type="button"
        onClick={onUpload}
        style={{
          padding: "8px 20px",
          border: "1.5px dashed #2563EB",
          borderRadius: 10,
          background: "#EFF6FF",
          color: "#2563EB",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
        }}
      >
        + Upload Image
      </button>
    </div>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  onClose:  () => void;
  onUpload: (file: File, name: string, language: "en" | "hinglish") => Promise<boolean>;
}

function UploadModal({ onClose, onUpload }: UploadModalProps) {
  const [name, setName]           = useState("");
  const [language, setLanguage]   = useState<"en" | "hinglish">("en");
  const [file, setFile]           = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // intentionally only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFile = useCallback(
    (f: File) => {
      setError(null);
      if (!ACCEPTED_TYPES.includes(f.type)) {
        setError("Only JPEG, PNG, WebP, or GIF images are allowed.");
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        setError("File size must be under 5 MB.");
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    },
    [previewUrl]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) applyFile(f);
    },
    [applyFile]
  );

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !file) return;
    setError(null);
    setUploading(true);
    const ok = await onUpload(file, name.trim(), language);
    setUploading(false);
    if (ok) {
      onClose();
    } else {
      setError("Upload failed. Please try again.");
    }
  };

  const canSubmit = name.trim().length > 0 && file !== null && !uploading;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,12,50,0.55)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          width: 420,
          padding: "28px 28px 24px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          border: "1.5px solid #E2E8F0",
        }}
      >
        {/* ── Header ── */}
        <div style={{ marginBottom: 20 }}>
          <h3
            style={{
              color: "#1E293B",
              fontSize: 16,
              fontWeight: 700,
              margin: 0,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Upload Image Template
          </h3>
          <p
            style={{
              color: "#94A3B8",
              fontSize: 12,
              margin: "4px 0 0",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Stored privately — visible only to you.
          </p>
        </div>

        {/* ── Name field ── */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 6,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Template Name{" "}
            <span style={{ color: "#E11D48" }}>*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder="e.g. Before / After Results"
            maxLength={60}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1.5px solid #E2E8F0",
              borderRadius: 10,
              fontSize: 13,
              color: "#1E293B",
              fontFamily: "Inter, sans-serif",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#7C3AED";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#E2E8F0";
            }}
          />
          <div
            style={{
              textAlign: "right",
              fontSize: 10,
              color: "#94A3B8",
              marginTop: 3,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {name.length}/60
          </div>
        </div>

        {/* ── Language toggle ── */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 6,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Language
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["en", "hinglish"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  border:
                    language === lang
                      ? "1.5px solid #7C3AED"
                      : "1.5px solid #E2E8F0",
                  borderRadius: 10,
                  background: language === lang ? "#7C3AED" : "#F8FAFC",
                  color: language === lang ? "#FFFFFF" : "#64748B",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  transition: "all 0.15s",
                }}
              >
                {lang === "en" ? "English" : "Hinglish"}
              </button>
            ))}
          </div>
        </div>

        {/* ── File area ── */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 6,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Image <span style={{ color: "#E11D48" }}>*</span>
          </label>

          {file && previewUrl ? (
            <div>
              <img
                src={previewUrl}
                alt="Preview"
                style={{
                  width: "100%",
                  height: 120,
                  objectFit: "cover",
                  borderRadius: 12,
                  border: "1.5px solid #E2E8F0",
                  display: "block",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#64748B",
                    fontFamily: "Inter, sans-serif",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "70%",
                  }}
                >
                  {file.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#94A3B8",
                    fontFamily: "Inter, sans-serif",
                    flexShrink: 0,
                  }}
                >
                  {formatBytes(file.size)}
                </span>
              </div>
              <button
                type="button"
                onClick={clearFile}
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "#94A3B8",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "Inter, sans-serif",
                  textDecoration: "underline",
                }}
              >
                Change image
              </button>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "#7C3AED" : "#CBD5E1"}`,
                borderRadius: 12,
                padding: "28px 16px",
                textAlign: "center",
                cursor: "pointer",
                background: dragOver ? "#F5F3FF" : "#FAFAFA",
                transition: "all 0.15s",
              }}
            >
              <svg
                width={28}
                height={28}
                viewBox="0 0 24 24"
                fill="none"
                stroke={dragOver ? "#7C3AED" : "#94A3B8"}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ margin: "0 auto 8px", display: "block" }}
              >
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: dragOver ? "#7C3AED" : "#64748B",
                  fontWeight: 500,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Drag & drop or{" "}
                <span style={{ color: "#2563EB", textDecoration: "underline" }}>
                  browse
                </span>
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 10,
                  color: "#94A3B8",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                JPEG, PNG, WebP, GIF · Max 5 MB
              </p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) applyFile(f);
              // reset value so the same file can be re-selected after clearing
              e.target.value = "";
            }}
          />
        </div>

        {/* ── Inline error ── */}
        {error && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "#FFF1F2",
              border: "1px solid #FECDD3",
              fontSize: 12,
              color: "#E11D48",
              marginBottom: 16,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            style={{
              flex: 1,
              padding: "9px 0",
              border: "1.5px solid #E2E8F0",
              borderRadius: 10,
              background: "#F8FAFC",
              color: "#64748B",
              fontSize: 13,
              fontWeight: 600,
              cursor: uploading ? "not-allowed" : "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              flex: 1,
              padding: "9px 0",
              border: "none",
              borderRadius: 10,
              background: canSubmit ? "#7C3AED" : "#C4B5FD",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: "Inter, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {uploading ? (
              <>
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  style={{ animation: "img-spin 0.8s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Uploading...
              </>
            ) : (
              "Upload & Save"
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes img-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Template row ─────────────────────────────────────────────────────────────

interface TemplateRowProps {
  template:        AgentImageTemplate;
  isSelected:      boolean;
  isConfirming:    boolean;
  onSelect:        () => void;
  onConfirmToggle: () => void;
  onConfirmDelete: () => void;
  onCancelDelete:  () => void;
}

function TemplateRow({
  template,
  isSelected,
  isConfirming,
  onSelect,
  onConfirmToggle,
  onConfirmDelete,
  onCancelDelete,
}: TemplateRowProps) {
  return (
    <div className="img-row-wrap">
      {/* ── Selectable row ── */}
      <div style={{ position: "relative", display: "flex", alignItems: "stretch" }}>
        <button
          type="button"
          onClick={onSelect}
          className="img-row-btn"
          style={{
            flex: 1,
            textAlign: "left",
            fontSize: "12.5px",
            borderRadius: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 44px 10px 12px", // right padding for trash
            background: isSelected ? "#F5F3FF" : "#FAFAFA",
            color:      isSelected ? "#5B21B6" : "#334155",
            border:     isSelected ? "1.5px solid #DDD6FE" : "1.5px solid transparent",
            borderLeft: isSelected ? "3px solid #7C3AED" : "3px solid transparent",
            fontWeight: isSelected ? 600 : 400,
            boxShadow:  isSelected ? "0 2px 12px rgba(124,58,237,0.10)" : "none",
            fontFamily: "Inter, sans-serif",
            transition: "all 0.15s",
            width: "100%",
          }}
        >
          <Thumbnail url={template.media_url} name={template.name} />

          {/* Colored dot */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              flexShrink: 0,
              background: isSelected ? "#7C3AED" : "#CBD5E1",
              boxShadow: isSelected ? "0 0 6px rgba(124,58,237,0.5)" : "none",
              transition: "all 0.15s",
            }}
          />

          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {template.name}
          </span>

          {/* Checkmark when selected */}
          {isSelected && (
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7C3AED"
              strokeWidth={2.5}
              strokeLinecap="round"
              style={{ flexShrink: 0 }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* ── Trash button (visible on row hover via CSS) ── */}
        <button
          type="button"
          className="img-row-trash"
          onClick={(e) => {
            e.stopPropagation();
            onConfirmToggle();
          }}
          title="Delete template"
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 5px",
            borderRadius: 6,
            color: "#94A3B8",
            display: "flex",
            alignItems: "center",
            opacity: 0,
            transition: "opacity 0.15s, color 0.15s",
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

      {/* ── Inline delete confirm ── */}
      {isConfirming && (
        <div
          style={{
            margin: "3px 2px 4px",
            padding: "8px 12px",
            background: "#FFF1F2",
            border: "1.5px solid #FECDD3",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "#9F1239",
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
                padding: "3px 10px",
                border: "1px solid #E2E8F0",
                borderRadius: 7,
                background: "#FFFFFF",
                color: "#64748B",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmDelete}
              style={{
                padding: "3px 10px",
                border: "none",
                borderRadius: 7,
                background: "#E11D48",
                color: "#FFFFFF",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
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

export function ImageTemplates({
  onSelectImage,
  selectedImageUrl,
  userBranch: _userBranch,  // kept for interface compat — filtering is server-side
  fillHeight = false,
  loading    = false,
  peekLabel,
}: ImageTemplatesProps) {
  const {
    templates: allTemplates,
    loading: hookLoading,
    uploadAndAdd,
    deleteTemplate,
  } = useImageTemplates();

  const [showModal, setShowModal]           = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeTemplates = allTemplates.filter((t) => t.is_active);
  const isLoading = loading || hookLoading;

  const handleDelete = useCallback(
    async (template: AgentImageTemplate) => {
      setConfirmDeleteId(null);
      await deleteTemplate(template.id, template.storage_path);
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
            background:   "linear-gradient(90deg, #EFF6FF, #DBEAFE)",
            borderBottom: "1.5px solid #BFDBFE",
          }}
        >
          <svg
            width={11}
            height={11}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2563EB"
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
          <span className="text-[11px] font-semibold" style={{ color: "#2563EB" }}>
            {peekLabel}
          </span>
        </div>
      )}

      {/* ── Header — 72px zone ────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 pt-4 pb-0"
        style={{
          minHeight: peekLabel ? "auto" : 72,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          {/* Title */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 30,
                height: 30,
                background: "linear-gradient(135deg, #DBEAFE, #BFDBFE)",
              }}
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2563EB"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <div>
              <h2
                className="text-sm font-semibold leading-none"
                style={{ color: "#1E293B", letterSpacing: "-0.01em" }}
              >
                Image Templates
              </h2>
              <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>
                {isLoading
                  ? "Loading…"
                  : `${activeTemplates.length} image${activeTemplates.length !== 1 ? "s" : ""} available`}
              </p>
            </div>
          </div>

          {/* Selected badge / count badge */}
          {selectedImageUrl ? (
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}
            >
              <svg
                width={10}
                height={10}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#059669"
                strokeWidth={2.5}
                strokeLinecap="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-[10px] font-semibold" style={{ color: "#059669" }}>
                Selected
              </span>
            </div>
          ) : (
            <span
              className="text-[11px] rounded-full px-2.5 py-1"
              style={{
                background: "#F0F9FF",
                color: "#0369A1",
                border: "1px solid #BAE6FD",
                fontWeight: 600,
              }}
            >
              {isLoading ? "…" : activeTemplates.length}
            </span>
          )}
        </div>

        {/* Info hint */}
        <div
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 mb-3"
          style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}
        >
          <svg
            width={10}
            height={10}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94A3B8"
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-[11px]" style={{ color: "#94A3B8" }}>
            Click any image to attach to your message
          </span>
        </div>
      </div>

      {/* ── Image list ─────────────────────────────────────────────────── */}
      <div
        className={`${fillHeight ? "flex-1 min-h-0" : ""} overflow-y-auto px-3 pb-3`}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#E2E8F0 transparent" }}
      >
        {isLoading ? (
          <SkeletonRows />
        ) : activeTemplates.length === 0 ? (
          <EmptyState onUpload={() => setShowModal(true)} />
        ) : (
          <div className="flex flex-col gap-1">
            {activeTemplates.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                isSelected={selectedImageUrl === template.media_url}
                isConfirming={confirmDeleteId === template.id}
                onSelect={() => onSelectImage(template.media_url)}
                onConfirmToggle={() =>
                  setConfirmDeleteId(
                    confirmDeleteId === template.id ? null : template.id
                  )
                }
                onConfirmDelete={() => handleDelete(template)}
                onCancelDelete={() => setConfirmDeleteId(null)}
              />
            ))}
          </div>
        )}

        {/* ── Upload button ── */}
        {!isLoading && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              marginTop: activeTemplates.length === 0 ? 0 : 10,
              width: "100%",
              padding: "9px 0",
              border: "1.5px dashed #2563EB",
              borderRadius: 12,
              background: "#EFF6FF",
              color: "#2563EB",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <svg
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2563EB"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Upload Image Template
          </button>
        )}

        <style>{`
          /* Scrollbar */
          .overflow-y-auto::-webkit-scrollbar { width: 4px; }
          .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
          .overflow-y-auto::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
          .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }

          /* Row hover — show trash, apply blue tint */
          .img-row-wrap:hover .img-row-trash { opacity: 1 !important; }
          .img-row-wrap:hover .img-row-btn {
            background: #F0F9FF !important;
            color: #0369A1 !important;
            border: 1.5px solid #BAE6FD !important;
            border-left: 3px solid #2563EB !important;
            transform: scale(1.005) translateX(2px) !important;
            box-shadow: 0 2px 12px rgba(37,99,235,0.08) !important;
          }
          /* Don't override selected-row styling on hover */
          .img-row-wrap:has(.img-row-btn[style*="F5F3FF"]):hover .img-row-btn {
            background: #F5F3FF !important;
            color: #5B21B6 !important;
            border: 1.5px solid #DDD6FE !important;
            border-left: 3px solid #7C3AED !important;
            transform: none !important;
          }
          .img-row-wrap .img-row-trash:hover { color: #E11D48 !important; }
        `}</style>
      </div>

      {/* ── Upload modal ───────────────────────────────────────────────── */}
      {showModal && (
        <UploadModal
          onClose={() => setShowModal(false)}
          onUpload={uploadAndAdd}
        />
      )}
    </div>
  );
}
