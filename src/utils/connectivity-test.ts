/**
 * Supabase Connectivity Test Utility
 * Tests if Supabase is reachable before attempting authentication
 */

import { env } from "@/config/env";

export interface ConnectivityResult {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Test if Supabase is reachable
 */
export async function testSupabaseConnectivity(): Promise<ConnectivityResult> {
  const supabaseUrl = env.supabaseUrl;

  console.log("🔍 Testing Supabase connectivity...");
  console.log("📍 Target URL:", supabaseUrl);

  try {
    // Test 1: Basic HTTP connectivity
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(supabaseUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
    });

    clearTimeout(timeoutId);

    console.log("✅ HTTP Response:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Supabase returned status ${response.status}. Project may be paused or misconfigured.`,
        details: {
          status: response.status,
          statusText: response.statusText,
        },
      };
    }

    // Test 2: Check response body
    const data = await response.json();
    console.log("✅ Response data:", data);

    if (data.msg === "ok") {
      console.log("✅ Supabase is reachable and healthy!");
      return {
        success: true,
        message: "Supabase connection successful",
        details: data,
      };
    } else {
      return {
        success: false,
        message: "Supabase responded but with unexpected data",
        details: data,
      };
    }
  } catch (error: any) {
    console.error("❌ Connectivity test failed:", error);

    // Detailed error diagnosis
    if (error.name === "AbortError") {
      return {
        success: false,
        message: "Connection timeout. Supabase is unreachable or very slow.",
        details: {
          error: "Timeout after 10 seconds",
          possibleCauses: [
            "Supabase project is paused",
            "Network firewall blocking connection",
            "Poor internet connection",
          ],
        },
      };
    }

    if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
      return {
        success: false,
        message: "Network error: Cannot reach Supabase servers",
        details: {
          error: error.message,
          possibleCauses: [
            "No internet connection",
            "Supabase project is paused",
            "Corporate firewall blocking Supabase",
            "DNS resolution failed",
            "CORS policy blocking request",
          ],
          solutions: [
            "Check internet connection",
            "Resume Supabase project at https://supabase.com/dashboard",
            "Try different network (mobile hotspot)",
            "Disable VPN/Proxy",
            "Check firewall settings",
          ],
        },
      };
    }

    return {
      success: false,
      message: `Unknown error: ${error.message}`,
      details: error,
    };
  }
}

/**
 * Display connectivity test results to user
 */
export function displayConnectivityError(result: ConnectivityResult): string {
  if (result.success) {
    return "Connected successfully";
  }

  let message = result.message;

  if (result.details?.possibleCauses) {
    message += "\n\nPossible causes:\n";
    result.details.possibleCauses.forEach((cause: string, index: number) => {
      message += `${index + 1}. ${cause}\n`;
    });
  }

  if (result.details?.solutions) {
    message += "\nSolutions:\n";
    result.details.solutions.forEach((solution: string, index: number) => {
      message += `${index + 1}. ${solution}\n`;
    });
  }

  return message;
}

/**
 * Validate Supabase configuration
 */
export function validateSupabaseConfig(): ConnectivityResult {
  console.log("🔍 Validating Supabase configuration...");

  const projectId    = env.projectId;
  const publicAnonKey = env.supabaseAnonKey;

  // Validate project ID format
  if (projectId.length < 10 || !/^[a-z0-9]+$/.test(projectId)) {
    console.error("❌ Project ID format is invalid!");
    return {
      success: false,
      message: "Supabase Project ID has invalid format",
      details: {
        projectId,
        expected: "20 character alphanumeric string",
      },
    };
  }

  // Validate anon key format (JWT)
  if (!publicAnonKey.startsWith("eyJ")) {
    console.error("❌ Public Anon Key format is invalid!");
    return {
      success: false,
      message: "Supabase Public Key has invalid format",
      details: {
        expected: "JWT token starting with 'eyJ'",
        actual: publicAnonKey.substring(0, 10) + "...",
      },
    };
  }

  console.log("✅ Supabase configuration is valid");
  console.log("   Project ID:", projectId);
  console.log("   Anon Key:", publicAnonKey.substring(0, 20) + "...");

  return {
    success: true,
    message: "Configuration valid",
    details: {
      projectId,
      url: env.supabaseUrl,
    },
  };
}
