/* credentials migrated to environment variables — see src/config/env.ts */
import { env } from "../../src/config/env";

export const projectId    = env.projectId;
export const publicAnonKey = env.supabaseAnonKey;
