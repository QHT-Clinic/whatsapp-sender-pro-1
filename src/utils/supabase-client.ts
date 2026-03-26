import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

// Validate Supabase credentials
if (!projectId || !publicAnonKey) {
  console.error("❌ Supabase credentials missing");
  throw new Error("Supabase configuration error");
}

const SUPABASE_URL = `https://${projectId}.supabase.co`;

console.log("🔧 Supabase initialized");

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, publicAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
  global: {
    headers: {
      "x-client-info": "qht-whatsapp-sender",
    },
  },
});

console.log("✅ Supabase client ready");
