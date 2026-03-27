/**
 * GlobalTemplateManager — LOCAL-ONLY FEATURE
 *
 * Self-contained UI for agents to manage their own global_templates rows.
 * This component is intentionally isolated in src/components/ (not src/app/components/)
 * and is only mounted via the /template-test route until the production migration sprint.
 *
 * CONSTRAINT: zero imports from QuickTemplates, ImageTemplates, or WhatsAppSender.
 */

import React, { useRef, useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  PencilIcon,
  Trash2Icon,
  MessageSquarePlusIcon,
  PlusIcon,
  LoaderCircleIcon,
} from "lucide-react";

import { useGlobalTemplates } from "@/hooks/useGlobalTemplates";
import type { GlobalTemplate, CreateTemplateInput } from "@/hooks/useGlobalTemplates";

// shadcn components
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import { Button }    from "@/app/components/ui/button";
import { Input }     from "@/app/components/ui/input";
import { Textarea }  from "@/app/components/ui/textarea";
import { Switch }    from "@/app/components/ui/switch";
import { Skeleton }  from "@/app/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

// ─── Constants ────────────────────────────────────────────────────────────────

const VARIABLE_CHIPS = ["{name}", "{lead_id}", "{agent_name}", "{clinic_name}"] as const;

// ─── Internal types ───────────────────────────────────────────────────────────

type TemplateType = "quick" | "image";

interface FormValues {
  name: string;
  language: "en" | "hinglish";
  content: string;
  media_url: string;
  is_active: boolean;
}

// ─── Language badge ───────────────────────────────────────────────────────────

function LanguageBadge({ lang }: { lang: "en" | "hinglish" }) {
  const isEn = lang === "en";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 99,
        background: isEn ? "#DBEAFE" : "#FEF3C7",
        color: isEn ? "#1D4ED8" : "#92400E",
        letterSpacing: "0.02em",
        userSelect: "none",
      }}
    >
      {isEn ? "EN" : "HI"}
    </span>
  );
}

// ─── Spinner (inline, tiny) ───────────────────────────────────────────────────

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <LoaderCircleIcon
      size={size}
      style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}
    />
  );
}

// ─── Skeleton list ────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 10,
            border: "1px solid #E2E8F0",
            background: "#fff",
          }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton style={{ height: 16, width: "40%" }} />
            <Skeleton style={{ height: 13, width: "70%" }} />
          </div>
          <Skeleton style={{ height: 20, width: 40, borderRadius: 99 }} />
          <Skeleton style={{ height: 32, width: 32, borderRadius: 6 }} />
          <Skeleton style={{ height: 32, width: 32, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px",
        gap: 12,
        textAlign: "center",
      }}
    >
      <MessageSquarePlusIcon size={48} color="#94A3B8" />
      <p style={{ fontWeight: 600, fontSize: 16, color: "#1E293B", margin: 0 }}>
        No templates yet
      </p>
      <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
        Create your first template to send messages faster
      </p>
      <Button
        onClick={onAdd}
        style={{ marginTop: 8, background: "#0D9488", color: "#fff", borderColor: "#0D9488" }}
      >
        <PlusIcon size={16} />
        Create Template
      </Button>
    </div>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: GlobalTemplate;
  isToggling: boolean;
  onEdit: (t: GlobalTemplate) => void;
  onDelete: (t: GlobalTemplate) => void;
  onToggle: (id: string, active: boolean) => void;
}

function TemplateCard({ template, isToggling, onEdit, onDelete, onToggle }: TemplateCardProps) {
  const preview =
    template.template_type === "quick" && template.content
      ? template.content.length > 70
        ? template.content.slice(0, 70) + "…"
        : template.content
      : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "13px 16px",
        borderRadius: 10,
        border: "1px solid #E2E8F0",
        background: "#fff",
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.boxShadow = "none")
      }
    >
      {/* Thumbnail (image templates only) */}
      {template.template_type === "image" && template.media_url && (
        <img
          src={template.media_url}
          alt=""
          style={{
            width: 48,
            height: 48,
            objectFit: "cover",
            borderRadius: 6,
            flexShrink: 0,
            border: "1px solid #E2E8F0",
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 500, fontSize: 14, color: "#1E293B" }}>
            {template.name}
          </span>
          <LanguageBadge lang={template.language} />
        </div>
        {preview && (
          <p
            style={{
              margin: "3px 0 0",
              fontSize: 13,
              color: "#64748B",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {preview}
          </p>
        )}
      </div>

      {/* Toggle */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
        {isToggling ? (
          <Spinner size={18} />
        ) : (
          <Switch
            checked={template.is_active}
            onCheckedChange={(val) => onToggle(template.id, val)}
          />
        )}
      </div>

      {/* Edit */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onEdit(template)}
        style={{ flexShrink: 0 }}
        title="Edit template"
      >
        <PencilIcon size={15} />
      </Button>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(template)}
        style={{ flexShrink: 0, color: "#94A3B8" }}
        className="hover:text-destructive"
        title="Delete template"
      >
        <Trash2Icon size={15} />
      </Button>
    </div>
  );
}

// ─── Template form modal ──────────────────────────────────────────────────────

interface TemplateFormModalProps {
  open: boolean;
  templateType: TemplateType;
  editing: GlobalTemplate | null;    // null = add mode
  onClose: () => void;
  onSubmit: (data: CreateTemplateInput) => Promise<boolean>;
}

function isValidUrl(val: string): boolean {
  try {
    new URL(val);
    return true;
  } catch {
    return false;
  }
}

function TemplateFormModal({
  open,
  templateType,
  editing,
  onClose,
  onSubmit,
}: TemplateFormModalProps) {
  const isQuick = templateType === "quick";

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: editing?.name ?? "",
      language: editing?.language ?? "en",
      content: editing?.content ?? "",
      media_url: editing?.media_url ?? "",
      is_active: editing?.is_active ?? true,
    },
  });

  // Reset form when modal opens/closes or editing target changes
  React.useEffect(() => {
    reset({
      name: editing?.name ?? "",
      language: editing?.language ?? "en",
      content: editing?.content ?? "",
      media_url: editing?.media_url ?? "",
      is_active: editing?.is_active ?? true,
    });
  }, [editing, open, reset]);

  // ── Watched values ─────────────────────────────────────────────────────────
  const contentValue  = watch("content");
  const mediaUrlValue = watch("media_url");
  const showPreview   = !isQuick && isValidUrl(mediaUrlValue);

  // ── Cursor-aware variable chip insertion ───────────────────────────────────
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { ref: rhfContentRef, ...contentProps } = register("content", {
    required: isQuick ? "Message is required" : false,
    maxLength: { value: 1000, message: "Max 1000 characters" },
  });

  const insertChip = useCallback(
    (chip: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart ?? 0;
      const end   = ta.selectionEnd ?? 0;
      const next  = (contentValue ?? "").slice(0, start) + chip + (contentValue ?? "").slice(end);
      setValue("content", next, { shouldValidate: true });
      requestAnimationFrame(() => {
        ta.setSelectionRange(start + chip.length, start + chip.length);
        ta.focus();
      });
    },
    [contentValue, setValue]
  );

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleFormSubmit = handleSubmit(async (values) => {
    const payload: CreateTemplateInput = {
      template_type: templateType,
      name: values.name.trim(),
      language: values.language,
      is_active: values.is_active,
    };
    if (isQuick) {
      payload.content = values.content.trim();
    } else {
      payload.media_url = values.media_url.trim();
      if (values.content.trim()) payload.content = values.content.trim();
    }
    const ok = await onSubmit(payload);
    if (ok) onClose();
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent style={{ maxWidth: 520 }}>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Template" : "New Template"}
            {" "}
            <span style={{ fontSize: 12, fontWeight: 400, color: "#64748B" }}>
              ({isQuick ? "Quick Message" : "Image"})
            </span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>

            {/* Name */}
            <div>
              <label style={labelStyle}>Name *</label>
              <Input
                {...register("name", {
                  required: "Name is required",
                  maxLength: { value: 80, message: "Max 80 characters" },
                })}
                placeholder="e.g. Welcome message"
                maxLength={81}
              />
              {errors.name && <FieldError msg={errors.name.message!} />}
            </div>

            {/* Language */}
            <div>
              <label style={labelStyle}>Language *</label>
              <Controller
                name="language"
                control={control}
                rules={{ required: "Language is required" }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hinglish">Hinglish</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.language && <FieldError msg={errors.language.message!} />}
            </div>

            {/* QUICK: Message textarea with variable chips */}
            {isQuick && (
              <div>
                <label style={labelStyle}>Message *</label>
                <Textarea
                  {...contentProps}
                  ref={(el) => {
                    textareaRef.current = el;
                    rhfContentRef(el);
                  }}
                  placeholder="Type your message here…"
                  rows={4}
                  maxLength={1001}
                  style={{ resize: "vertical", minHeight: 80 }}
                />
                {/* Character counter */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {VARIABLE_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => insertChip(chip)}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 99,
                          border: "1px solid #C4B5FD",
                          background: "#F5F3FF",
                          color: "#6D28D9",
                          cursor: "pointer",
                          fontFamily: "monospace",
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: (contentValue?.length ?? 0) > 990 ? "#E11D48" : "#94A3B8" }}>
                    {contentValue?.length ?? 0} / 1000
                  </span>
                </div>
                {errors.content && <FieldError msg={errors.content.message!} />}
              </div>
            )}

            {/* IMAGE: URL + preview + optional caption */}
            {!isQuick && (
              <>
                <div>
                  <label style={labelStyle}>Image URL *</label>
                  <Input
                    {...register("media_url", {
                      required: "Image URL is required",
                      validate: (val) => isValidUrl(val) || "Enter a valid URL (must start with https://)",
                    })}
                    placeholder="https://example.com/image.jpg"
                    type="url"
                  />
                  {errors.media_url && <FieldError msg={errors.media_url.message!} />}
                  {/* Live preview */}
                  {showPreview && (
                    <img
                      src={mediaUrlValue}
                      alt="preview"
                      style={{
                        marginTop: 8,
                        width: 80,
                        height: 80,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid #E2E8F0",
                      }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                      onLoad={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "block";
                      }}
                    />
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Caption (optional)</label>
                  <Textarea
                    {...register("content", {
                      maxLength: { value: 500, message: "Max 500 characters" },
                    })}
                    placeholder="Optional caption for the image…"
                    rows={2}
                    maxLength={501}
                  />
                  {errors.content && <FieldError msg={errors.content.message!} />}
                </div>
              </>
            )}

            {/* Active toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Controller
                name="is_active"
                control={control}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <label style={{ fontSize: 14, color: "#1E293B", cursor: "pointer" }}>
                Active
              </label>
            </div>
          </div>

          <DialogFooter style={{ marginTop: 20 }}>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              style={{ background: "#0D9488", borderColor: "#0D9488", color: "#fff", minWidth: 80 }}
            >
              {isSubmitting ? <Spinner size={15} /> : editing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: "#374151",
  marginBottom: 5,
};

function FieldError({ msg }: { msg: string }) {
  return (
    <p style={{ fontSize: 12, color: "#E11D48", marginTop: 4, marginBottom: 0 }}>
      {msg}
    </p>
  );
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────

interface DeleteConfirmProps {
  template: GlobalTemplate | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ template, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <AlertDialog open={!!template}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete template?</AlertDialogTitle>
          <AlertDialogDescription>
            Delete <strong>"{template?.name}"</strong>? This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            style={{ background: "#E11D48", borderColor: "#E11D48" }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GlobalTemplateManager() {
  const {
    templates,
    loading,
    error,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    toggleActive,
  } = useGlobalTemplates();

  const [activeTab, setActiveTab]         = useState<TemplateType>("quick");
  const [showModal, setShowModal]         = useState(false);
  const [editingTemplate, setEditing]     = useState<GlobalTemplate | null>(null);
  const [deletingTemplate, setDeleting]   = useState<GlobalTemplate | null>(null);
  const [togglingId, setTogglingId]       = useState<string | null>(null);

  // ── Filtered lists by tab ──────────────────────────────────────────────────
  const displayed = templates.filter((t) => t.template_type === activeTab);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openAddModal  = () => { setEditing(null); setShowModal(true); };
  const openEditModal = (t: GlobalTemplate) => { setEditing(t); setShowModal(true); };
  const closeModal    = () => { setShowModal(false); setEditing(null); };

  const handleSubmit = async (data: CreateTemplateInput): Promise<boolean> => {
    if (editingTemplate) {
      return updateTemplate(editingTemplate.id, data);
    }
    return addTemplate(data);
  };

  const handleToggle = async (id: string, active: boolean) => {
    setTogglingId(id);
    await toggleActive(id, active);
    setTogglingId(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return;
    await deleteTemplate(deletingTemplate.id);
    setDeleting(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid #E2E8F0",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #F1F5F9",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1E293B" }}>
          My Templates
        </h2>
        <Button
          onClick={openAddModal}
          size="sm"
          style={{ background: "#0D9488", borderColor: "#0D9488", color: "#fff" }}
        >
          <PlusIcon size={15} />
          New Template
        </Button>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 20px" }}>
        {/* Error banner */}
        {error && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 8,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#B91C1C",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TemplateType)}>
          <TabsList style={{ marginBottom: 14 }}>
            <TabsTrigger value="quick">
              Quick Messages
              {templates.filter((t) => t.template_type === "quick").length > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    background: "#E2E8F0",
                    borderRadius: 99,
                    padding: "1px 6px",
                  }}
                >
                  {templates.filter((t) => t.template_type === "quick").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="image">
              Image Templates
              {templates.filter((t) => t.template_type === "image").length > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    background: "#E2E8F0",
                    borderRadius: 99,
                    padding: "1px 6px",
                  }}
                >
                  {templates.filter((t) => t.template_type === "image").length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick">
            {loading ? (
              <SkeletonList />
            ) : displayed.length === 0 ? (
              <EmptyState onAdd={openAddModal} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {displayed.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    isToggling={togglingId === t.id}
                    onEdit={openEditModal}
                    onDelete={setDeleting}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="image">
            {loading ? (
              <SkeletonList />
            ) : displayed.length === 0 ? (
              <EmptyState onAdd={openAddModal} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {displayed.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    isToggling={togglingId === t.id}
                    onEdit={openEditModal}
                    onDelete={setDeleting}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add / Edit Modal */}
      <TemplateFormModal
        open={showModal}
        templateType={activeTab}
        editing={editingTemplate}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        template={deletingTemplate}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleting(null)}
      />

      {/* CSS for spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
