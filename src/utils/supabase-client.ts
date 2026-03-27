import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";

console.log("🔧 Supabase initialized");

// Create Supabase client
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
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
