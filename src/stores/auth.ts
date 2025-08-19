import { atom } from 'nanostores';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, type Profile } from '../lib/supabase';

// Store for the current user
export const $user = atom<User | null>(null);
export const $profile = atom<Profile | null>(null);
export const $isLoading = atom<boolean>(true);

// Initialize auth state
export async function initAuth() {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured() || !supabase) {
      console.warn('Supabase not configured - authentication features disabled');
      $isLoading.set(false);
      return;
    }

    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      $user.set(session.user);
      await loadUserProfile(session.user.id);
    }
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        $user.set(session.user);
        await loadUserProfile(session.user.id);
      } else {
        $user.set(null);
        $profile.set(null);
      }
    });
  } catch (error) {
    console.error('Error initializing auth:', error);
  } finally {
    $isLoading.set(false);
  }
}

// Load user profile from database
async function loadUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    $profile.set(data);
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// Sign up new user
export async function signUp(email: string, password: string, userData: { 
  username?: string; 
  full_name?: string; 
}) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error signing up:', error);
    return { success: false, error: error.message };
  }
}

// Sign in user
export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error signing in:', error);
    return { success: false, error: error.message };
  }
}

// Sign out user
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    $user.set(null);
    $profile.set(null);
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error: error.message };
  }
}

// Check if user is admin
export function isAdmin(): boolean {
  const profile = $profile.get();
  return profile?.role === 'admin';
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return $user.get() !== null;
}
