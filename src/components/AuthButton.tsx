import { useStore } from '@nanostores/react';
import { useState, useEffect } from 'react';
import { $user, $profile, $isLoading, signOut, isAdmin, initAuth } from '../stores/auth';

export default function AuthButton() {
  const user = useStore($user);
  const profile = useStore($profile);
  const isLoading = useStore($isLoading);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    // Initialize auth when component mounts
    initAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-600 animate-pulse"></div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center space-x-2">
        <a 
          href="/auth/signin" 
          className="text-white hover:text-red-600 transition-colors"
        >
          Sign In
        </a>
        <a 
          href="/auth/signup" 
          className="btn-primary"
        >
          Sign Up
        </a>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    setShowDropdown(false);
    window.location.href = '/';
  };

  return (
    <div className="relative">
      <button
        className="flex items-center space-x-2 text-white hover:text-red-600 transition-colors"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center">
          {profile?.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt="Profile" 
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <i className="fas fa-user text-sm"></i>
          )}
        </div>
        <span className="hidden sm:block">
          {profile?.username || profile?.full_name || user.email}
        </span>
        <i className="fas fa-chevron-down text-xs"></i>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg py-2 z-50">
          <a 
            href="/profile" 
            className="block px-4 py-2 text-white hover:bg-gray-700 transition-colors"
          >
            <i className="fas fa-user mr-2"></i>
            Profile
          </a>
          <a 
            href="/watchlist" 
            className="block px-4 py-2 text-white hover:bg-gray-700 transition-colors"
          >
            <i className="fas fa-heart mr-2"></i>
            My Watchlist
          </a>
          {isAdmin() && (
            <a 
              href="/admin" 
              className="block px-4 py-2 text-white hover:bg-gray-700 transition-colors"
            >
              <i className="fas fa-cogs mr-2"></i>
              Admin Panel
            </a>
          )}
          <hr className="my-2 border-gray-600" />
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 transition-colors"
          >
            <i className="fas fa-sign-out-alt mr-2"></i>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
