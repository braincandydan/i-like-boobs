import { atom } from 'nanostores';
import { 
  getCurrentUser, 
  setCurrentUser, 
  isUserSignedIn, 
  signUpUser, 
  signInUser, 
  signOutUser,
  onStorageChange,
  type LocalUser 
} from '../lib/localStorage';

// Store for the current user - using LocalUser instead of Supabase User
export const $user = atom<LocalUser | null>(null);
export const $profile = atom<LocalUser | null>(null);
export const $isLoading = atom<boolean>(true);

// Initialize auth state
export function initAuth() {
  try {
    // Get current user from localStorage
    const user = getCurrentUser();
    
    if (user && isUserSignedIn()) {
      $user.set(user);
      $profile.set(user);
    } else {
      $user.set(null);
      $profile.set(null);
    }
    
    // Listen for storage changes (cross-tab synchronization)
    onStorageChange(() => {
      const updatedUser = getCurrentUser();
      if (updatedUser && isUserSignedIn()) {
        $user.set(updatedUser);
        $profile.set(updatedUser);
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

// Sign up new user
export function signUp(email: string, password: string, userData: { 
  username?: string; 
  full_name?: string; 
}) {
  try {
    const result = signUpUser(email, password, userData);
    
    if (result.success && result.user) {
      $user.set(result.user);
      $profile.set(result.user);
    }
    
    return result;
  } catch (error) {
    console.error('Error signing up:', error);
    return { success: false, error: 'Failed to create account' };
  }
}

// Sign in user
export function signIn(email: string, password: string) {
  try {
    const result = signInUser(email, password);
    
    if (result.success && result.user) {
      $user.set(result.user);
      $profile.set(result.user);
    }
    
    return result;
  } catch (error) {
    console.error('Error signing in:', error);
    return { success: false, error: 'Failed to sign in' };
  }
}

// Sign out user
export function signOut() {
  try {
    signOutUser();
    $user.set(null);
    $profile.set(null);
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error: 'Failed to sign out' };
  }
}

// Check if user is admin (simplified for localStorage - no roles in our LocalUser type)
export function isAdmin(): boolean {
  // For static hosting, we can implement a simple admin check
  // You could maintain an admin list or add role to LocalUser interface
  const user = $user.get();
  return user?.email === 'admin@notflix.com'; // Simple admin check
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return $user.get() !== null && isUserSignedIn();
}
