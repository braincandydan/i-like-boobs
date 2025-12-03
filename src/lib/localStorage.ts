// Local storage utilities for GitHub Pages deployment
// Since we can't use a server/database, we'll store user data locally

export interface LocalUser {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  createdAt: string;
}

export interface WatchlistItem {
  id: string;
  movieId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath?: string;
  addedAt: string;
}

const STORAGE_KEYS = {
  USER: 'notflix_user',
  WATCHLIST: 'notflix_watchlist',
  SESSION: 'notflix_session'
};

// User management
export function getCurrentUser(): LocalUser | null {
  try {
    const userData = localStorage.getItem(STORAGE_KEYS.USER);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export function setCurrentUser(user: LocalUser | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(STORAGE_KEYS.SESSION, 'active');
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    }
  } catch (error) {
    console.error('Error setting current user:', error);
  }
}

export function isUserSignedIn(): boolean {
  return getCurrentUser() !== null && localStorage.getItem(STORAGE_KEYS.SESSION) === 'active';
}

// Simple auth functions
export function signUpUser(email: string, password: string, userData: { username?: string; full_name?: string }): { success: boolean; error?: string; user?: LocalUser } {
  try {
    // Check if user already exists
    const existingUsers = getStoredUsers();
    if (existingUsers.some(u => u.email === email)) {
      return { success: false, error: 'User with this email already exists' };
    }

    // Create new user
    const newUser: LocalUser = {
      id: generateId(),
      email,
      username: userData.username,
      full_name: userData.full_name,
      createdAt: new Date().toISOString()
    };

    // Store user credentials (in real app, never store passwords in localStorage!)
    const users = [...existingUsers, newUser];
    localStorage.setItem('notflix_users', JSON.stringify(users));
    localStorage.setItem(`notflix_password_${email}`, password); // Demo only - never do this in production!

    setCurrentUser(newUser);
    return { success: true, user: newUser };
  } catch (error) {
    return { success: false, error: 'Failed to create account' };
  }
}

export function signInUser(email: string, password: string): { success: boolean; error?: string; user?: LocalUser } {
  try {
    const users = getStoredUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const storedPassword = localStorage.getItem(`notflix_password_${email}`);
    if (storedPassword !== password) {
      return { success: false, error: 'Invalid password' };
    }

    setCurrentUser(user);
    return { success: true, user };
  } catch (error) {
    return { success: false, error: 'Failed to sign in' };
  }
}

export function signOutUser(): void {
  setCurrentUser(null);
  // Clear watchlist for demo - in real app you might want to keep it
  // localStorage.removeItem(STORAGE_KEYS.WATCHLIST);
}

function getStoredUsers(): LocalUser[] {
  try {
    const users = localStorage.getItem('notflix_users');
    return users ? JSON.parse(users) : [];
  } catch (error) {
    return [];
  }
}

// Watchlist management
// Updated to work with Supabase authenticated users
export function getWatchlist(userId?: string): WatchlistItem[] {
  try {
    // Try to get userId from parameter, or from localStorage user, or from Supabase user
    let id = userId;
    
    if (!id) {
      // Try localStorage user first (for backward compatibility)
      const localUser = getCurrentUser();
      if (localUser) {
        id = localUser.id;
      }
    }
    
    if (!id) return [];

    const watchlistData = localStorage.getItem(`${STORAGE_KEYS.WATCHLIST}_${id}`);
    return watchlistData ? JSON.parse(watchlistData) : [];
  } catch (error) {
    console.error('Error getting watchlist:', error);
    return [];
  }
}

export function addToWatchlist(item: Omit<WatchlistItem, 'id' | 'addedAt'>, userId?: string): boolean {
  try {
    // Try to get userId from parameter, or from localStorage user
    let id = userId;
    
    if (!id) {
      const localUser = getCurrentUser();
      if (localUser) {
        id = localUser.id;
      }
    }
    
    if (!id) return false;

    const watchlist = getWatchlist(id);
    
    // Check if item already exists
    const exists = watchlist.some(w => w.movieId === item.movieId && w.mediaType === item.mediaType);
    if (exists) return false;

    const newItem: WatchlistItem = {
      ...item,
      id: generateId(),
      addedAt: new Date().toISOString()
    };

    const updatedWatchlist = [...watchlist, newItem];
    localStorage.setItem(`${STORAGE_KEYS.WATCHLIST}_${id}`, JSON.stringify(updatedWatchlist));
    
    // Trigger storage event for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: `${STORAGE_KEYS.WATCHLIST}_${id}`,
      newValue: JSON.stringify(updatedWatchlist)
    }));
    
    return true;
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    return false;
  }
}

export function removeFromWatchlist(movieId: number, mediaType: 'movie' | 'tv', userId?: string): boolean {
  try {
    // Try to get userId from parameter, or from localStorage user
    let id = userId;
    
    if (!id) {
      const localUser = getCurrentUser();
      if (localUser) {
        id = localUser.id;
      }
    }
    
    if (!id) return false;

    const watchlist = getWatchlist(id);
    const updatedWatchlist = watchlist.filter(w => !(w.movieId === movieId && w.mediaType === mediaType));
    
    localStorage.setItem(`${STORAGE_KEYS.WATCHLIST}_${id}`, JSON.stringify(updatedWatchlist));
    
    // Trigger storage event for cross-tab sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: `${STORAGE_KEYS.WATCHLIST}_${id}`,
      newValue: JSON.stringify(updatedWatchlist)
    }));
    
    return true;
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    return false;
  }
}

export function isInWatchlist(movieId: number, mediaType: 'movie' | 'tv', userId?: string): boolean {
  try {
    const watchlist = getWatchlist(userId);
    return watchlist.some(w => w.movieId === movieId && w.mediaType === mediaType);
  } catch (error) {
    console.error('Error checking watchlist:', error);
    return false;
  }
}

// Utility function to generate unique IDs
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Storage event listener for cross-tab synchronization
export function onStorageChange(callback: () => void): () => void {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key?.startsWith('notflix_')) {
      callback();
    }
  };

  window.addEventListener('storage', handleStorageChange);
  
  return () => {
    window.removeEventListener('storage', handleStorageChange);
  };
}
