import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $user, $profile, isAdmin, initAuth } from '../stores/auth';
import CategoryManager from './CategoryManager';

export default function AdminPanel() {
  const user = useStore($user);
  const profile = useStore($profile);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize auth if not already done
    if (!user && !isInitialized) {
      initAuth();
      setIsInitialized(true);
    }
  }, [user, isInitialized]);

  // Check if user is admin
  const userIsAdmin = isAdmin();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Please sign in</h1>
          <p className="text-gray-400 mb-6">You need to be signed in to access the admin panel.</p>
          <a href="/auth/signin" className="btn-primary">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (!userIsAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-shield-alt text-6xl text-red-600 mb-6"></i>
          <h1 className="text-3xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            You need admin privileges to access this panel.
          </p>
          <a href="/" className="btn-secondary">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Admin Panel</h1>
        <p className="text-gray-400">Manage homepage categories and custom sections</p>
      </div>

      {/* Single unified interface - no tabs needed */}
      <CategoryManager />
    </div>
  );
}

