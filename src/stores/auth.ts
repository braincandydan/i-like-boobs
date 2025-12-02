import { atom } from 'nanostores';
import { supabase, isSupabaseConfigured, type Profile } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

// Store for the current user and profile
export const $user = atom<User | null>(null);
export const $profile = atom<Profile | null>(null);
export const $isLoading = atom<boolean>(true);

// Initialize auth state
export async function initAuth() {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase is not configured');
    $isLoading.set(false);
    return;
  }

  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase!.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      $isLoading.set(false);
      return;
    }

    if (session?.user) {
      $user.set(session.user);
      await loadProfile(session.user.id);
    } else {
      $user.set(null);
      $profile.set(null);
    }

    // Listen for auth changes
    supabase!.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        $user.set(session.user);
        await loadProfile(session.user.id);
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

// Load user profile
async function loadProfile(userId: string) {
  if (!isSupabaseConfigured()) return;

  try {
    const { data, error } = await supabase!
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error loading profile:', error);
      return;
    }

    $profile.set(data as Profile);
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// Sign up new user
export async function signUp(email: string, password: string, userData: { 
  username?: string; 
  full_name?: string; 
}): Promise<{ success: boolean; error?: string; warning?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    // Sign up user
    const { data: authData, error: authError } = await supabase!.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: userData.username,
          full_name: userData.full_name,
        }
      }
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    if (!authData.user) {
      return { success: false, error: 'Failed to create account' };
    }

    // Wait a moment for trigger to potentially create profile
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to load profile first (might have been created by trigger)
    let profile = null;
    let profileError = null;
    
    const { data: existingProfile, error: loadError } = await supabase!
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (loadError || !existingProfile) {
      // Profile doesn't exist, create it manually
      console.log('Profile not found, creating manually...');
      
      const { error: createError } = await supabase!
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: authData.user.email!,
          username: userData.username || null,
          full_name: userData.full_name || null,
          role: 'user'
        });

      if (createError) {
        console.error('Error creating profile:', createError);
        profileError = createError;
        
        // Try one more time with upsert
        const { error: upsertError } = await supabase!
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email: authData.user.email!,
            username: userData.username || null,
            full_name: userData.full_name || null,
            role: 'user'
          }, {
            onConflict: 'id'
          });
        
        if (upsertError) {
          console.error('Error upserting profile:', upsertError);
          return { 
            success: false, 
            error: `Account created but profile creation failed: ${upsertError.message}. Please contact support.` 
          };
        }
      }
    } else {
      // Profile exists, update it with any new data
      if (userData.username || userData.full_name) {
        const { error: updateError } = await supabase!
          .from('profiles')
          .update({
            username: userData.username || existingProfile.username,
            full_name: userData.full_name || existingProfile.full_name
          })
          .eq('id', authData.user.id);
        
        if (updateError) {
          console.error('Error updating profile:', updateError);
        }
      }
    }
    
    // Update stores and load profile
    $user.set(authData.user);
    await loadProfile(authData.user.id);
    
    // Verify profile was created/loaded
    const { data: finalProfile } = await supabase!
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
    
    if (!finalProfile) {
      console.error('Profile still not found after all attempts');
      return { 
        success: false, 
        error: 'Account created but profile was not created. Please try signing in or contact support.' 
      };
    }

    // Check if email confirmation is required
    if (authData.user.email_confirmed_at === null) {
      return { 
        success: true, 
        warning: 'Account created! Please check your email to confirm your account before signing in.' 
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error signing up:', error);
    return { success: false, error: error.message || 'Failed to create account' };
  }
}

// Sign in user
export async function signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const { data, error } = await supabase!.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.user) {
      $user.set(data.user);
      await loadProfile(data.user.id);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error signing in:', error);
    return { success: false, error: error.message || 'Failed to sign in' };
  }
}

// Sign out user
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase is not configured' };
  }

  try {
    const { error } = await supabase!.auth.signOut();

    if (error) {
      return { success: false, error: error.message };
    }

    $user.set(null);
    $profile.set(null);
    return { success: true };
  } catch (error: any) {
    console.error('Error signing out:', error);
    return { success: false, error: error.message || 'Failed to sign out' };
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
