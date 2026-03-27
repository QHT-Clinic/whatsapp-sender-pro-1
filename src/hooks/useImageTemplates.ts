/**
 * useImageTemplates — Manages agent-owned image templates backed by
 * Supabase Storage ('template-images' bucket) + global_templates table.
 *
 * Security: agent_id is ALWAYS derived from supabase.auth.getUser().
 * The caller never passes agent_id — it is never accepted as a prop or param.
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/app/lib/supabaseClient";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AgentImageTemplate {
  id: string;
  agent_id: string;
  name: string;
  media_url: string;      // full Supabase Storage public URL
  storage_path: string;   // path inside bucket — stored in 'content' column
  language: "en" | "hinglish";
  is_active: boolean;
  created_at: string;
}

export interface UseImageTemplatesReturn {
  templates: AgentImageTemplate[];
  loading: boolean;
  error: string | null;
  uploadAndAdd: (file: File, name: string, language: "en" | "hinglish") => Promise<boolean>;
  deleteTemplate: (id: string, storage_path: string) => Promise<boolean>;
  toggleActive: (id: string, is_active: boolean) => Promise<boolean>;
  refetch: () => void;
}

// ─── Raw DB row shape returned by the select ─────────────────────────────────

interface RawImageRow {
  id: string;
  agent_id: string;
  name: string;
  media_url: string | null;
  content: string | null;   // storage_path lives here
  language: string;
  is_active: boolean;
  created_at: string;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useImageTemplates(): UseImageTemplatesReturn {
  const [templates, setTemplates] = useState<AgentImageTemplate[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    const user = await getAuthUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data, error: fetchErr } = await supabase
      .from("global_templates")
      .select("id, agent_id, name, media_url, content, language, is_active, created_at")
      .eq("agent_id", user.id)
      .eq("template_type", "image")
      .order("created_at", { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
    } else {
      const mapped: AgentImageTemplate[] = ((data ?? []) as RawImageRow[]).map((row) => ({
        id:           row.id,
        agent_id:     row.agent_id,
        name:         row.name,
        media_url:    row.media_url ?? "",
        storage_path: row.content   ?? "",
        language:     (row.language as "en" | "hinglish"),
        is_active:    row.is_active,
        created_at:   row.created_at,
      }));
      setTemplates(mapped);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ── Upload & Add ─────────────────────────────────────────────────────────

  const uploadAndAdd = useCallback(
    async (file: File, name: string, language: "en" | "hinglish"): Promise<boolean> => {
      const user = await getAuthUser();
      if (!user) {
        toast.error("Not authenticated");
        return false;
      }

      const storagePath = `${user.id}/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;

      const { error: uploadErr } = await supabase.storage
        .from("template-images")
        .upload(storagePath, file);

      if (uploadErr) {
        toast.error(`Upload failed: ${uploadErr.message}`);
        return false;
      }

      const publicUrl = supabase.storage
        .from("template-images")
        .getPublicUrl(storagePath).data.publicUrl;

      const { error: insertErr } = await supabase.from("global_templates").insert({
        agent_id:      user.id,
        template_type: "image",
        name,
        media_url:     publicUrl,
        content:       storagePath,   // storage_path stored here for later deletion
        language,
        is_active:     true,
        created_by:    user.id,
      });

      if (insertErr) {
        toast.error(`Failed to save template: ${insertErr.message}`);
        // clean up the already-uploaded file so it doesn't become an orphan
        await supabase.storage.from("template-images").remove([storagePath]);
        return false;
      }

      toast.success("Image template added!");
      await fetchTemplates();
      return true;
    },
    [fetchTemplates]
  );

  // ── Delete ───────────────────────────────────────────────────────────────

  const deleteTemplate = useCallback(
    async (id: string, storage_path: string): Promise<boolean> => {
      const user = await getAuthUser();
      if (!user) {
        toast.error("Not authenticated");
        return false;
      }

      const { error: storageErr } = await supabase.storage
        .from("template-images")
        .remove([storage_path]);

      if (storageErr) {
        toast.error(`Failed to delete image file: ${storageErr.message}`);
        return false;
      }

      const { error: dbErr } = await supabase
        .from("global_templates")
        .delete()
        .eq("id", id)
        .eq("agent_id", user.id);

      if (dbErr) {
        toast.error(`Failed to delete template record: ${dbErr.message}`);
        return false;
      }

      toast.success("Template deleted");
      await fetchTemplates();
      return true;
    },
    [fetchTemplates]
  );

  // ── Toggle active ────────────────────────────────────────────────────────

  const toggleActive = useCallback(
    async (id: string, is_active: boolean): Promise<boolean> => {
      const user = await getAuthUser();
      if (!user) return false;

      const { error: toggleErr } = await supabase
        .from("global_templates")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("agent_id", user.id);

      if (toggleErr) {
        toast.error(`Failed to update template: ${toggleErr.message}`);
        return false;
      }

      // Optimistic local update — avoids a round-trip for a simple boolean flip
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active } : t))
      );
      toast.success(is_active ? "Template activated" : "Template deactivated");
      return true;
    },
    []
  );

  return {
    templates,
    loading,
    error,
    uploadAndAdd,
    deleteTemplate,
    toggleActive,
    refetch: fetchTemplates,
  };
}
