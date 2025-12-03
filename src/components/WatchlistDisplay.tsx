import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $user } from '../stores/auth';
import { 
  getWatchlist, 
  removeFromWatchlist, 
  onStorageChange,
  type WatchlistItem 
} from '../lib/localStorage';
import { createUrl } from '../lib/utils';

export default function WatchlistDisplay() {
  const user = useStore($user);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWatchlist();
  }, [user]);

  // Listen for storage changes to sync across tabs
  useEffect(() => {
    const cleanup = onStorageChange(() => {
      loadWatchlist();
    });
    return cleanup;
  }, []);

  const loadWatchlist = () => {
    try {
      if (user) {
        // Use Supabase user ID
        const userWatchlist = getWatchlist(user.id);
        setWatchlist(userWatchlist);
      } else {
        setWatchlist([]);
      }
    } catch (error) {
      console.error('Error loading watchlist:', error);
      setWatchlist([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFromWatchlist = (movieId: number, mediaType: 'movie' | 'tv') => {
    if (!user) return;
    
    try {
      const success = removeFromWatchlist(movieId, mediaType, user.id);
      if (success) {
        setWatchlist(prev => prev.filter(item => !(item.movieId === movieId && item.mediaType === mediaType)));
      }
    } catch (error) {
      console.error('Error removing from watchlist:', error);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-16">
        <i className="fas fa-heart text-6xl text-gray-600 mb-6"></i>
        <h2 className="text-2xl font-bold text-white mb-4">Sign in to view your watchlist</h2>
        <p className="text-gray-400 mb-8">Create an account or sign in to save your favorite movies and TV shows!</p>
        
        <div className="space-x-4">
          <a href={createUrl("/auth/signin")} className="btn-primary">
            Sign In
          </a>
          <a href={createUrl("/auth/signup")} className="btn-secondary">
            Sign Up
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        <p className="text-gray-400 mt-4">Loading your watchlist...</p>
      </div>
    );
  }

  if (watchlist.length === 0) {
    return (
      <div className="text-center py-16">
        <i className="fas fa-heart text-6xl text-gray-600 mb-6"></i>
        <h2 className="text-2xl font-bold text-white mb-4">Your watchlist is empty</h2>
        <p className="text-gray-400 mb-8">Start adding movies and TV shows to your watchlist!</p>
        
        <div className="space-x-4">
          <a href={createUrl("/movies")} className="btn-primary">
            Browse Movies
          </a>
          <a href={createUrl("/tv-shows")} className="btn-secondary">
            Browse TV Shows
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          My Watchlist ({watchlist.length} {watchlist.length === 1 ? 'item' : 'items'})
        </h2>
        <p className="text-gray-400">
          Your saved movies and TV shows
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {watchlist.map((item) => (
          <div key={`${item.mediaType}-${item.movieId}`} className="group relative">
            <div className="aspect-[2/3] relative overflow-hidden rounded-lg bg-gray-800">
              {item.posterPath ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500${item.posterPath}`}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-700">
                  <i className="fas fa-film text-4xl text-gray-500"></i>
                </div>
              )}
              
              {/* Remove button */}
              <button
                onClick={() => handleRemoveFromWatchlist(item.movieId, item.mediaType)}
                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                title="Remove from watchlist"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>

              {/* Media type badge */}
              <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs font-medium">
                {item.mediaType === 'movie' ? 'Movie' : 'TV Show'}
              </div>
            </div>

            {/* Title and link */}
            <div className="mt-3">
              <a
                href={`/details/${item.mediaType}/${item.movieId}`}
                className="text-white font-medium hover:text-blue-400 transition-colors duration-200 line-clamp-2"
              >
                {item.title}
              </a>
              <p className="text-gray-500 text-sm mt-1">
                Added {new Date(item.addedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
