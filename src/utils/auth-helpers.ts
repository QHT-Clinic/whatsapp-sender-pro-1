import { supabase } from './supabase-client';

/**
 * Safely gets the current authenticated user with fallback to session
 * Returns null if no user is found or an error occurs
 */
export async function getCurrentUser() {
  try {
    // First try to get user directly
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (user && !userError) {
      return user;
    }
    
    // Fallback to session
    console.log('⚠️ getUser failed, trying session fallback...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (session?.user && !sessionError) {
      return session.user;
    }
    
    console.error('❌ Auth failed:', { userError, sessionError });
    return null;
  } catch (err) {
    console.error('❌ Exception in getCurrentUser:', err);
    return null;
  }
}

/**
 * Checks if the user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}
