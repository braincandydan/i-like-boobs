import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $user } from '../stores/auth';
import { 
  addToWatchlist, 
  removeFromWatchlist, 
  isInWatchlist, 
  onStorageChange 
} from '../lib/localStorage';

interface WatchlistButtonProps {
  movieId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath?: string;
}

export default function WatchlistButton({ 
  movieId, 
  mediaType, 
  title, 
  posterPath 
}: WatchlistButtonProps) {
  const user = useStore($user);
  const [isInWatchlistState, setIsInWatchlistState] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkWatchlistStatus();
  }, [user, movieId, mediaType]);

  // Listen for storage changes to sync across tabs
  useEffect(() => {
    const cleanup = onStorageChange(() => {
      checkWatchlistStatus();
    });
    return cleanup;
  }, [movieId, mediaType]);

  const checkWatchlistStatus = () => {
    if (!user) {
      setIsInWatchlistState(false);
      return;
    }

    try {
      const inWatchlist = isInWatchlist(movieId, mediaType);
      setIsInWatchlistState(inWatchlist);
    } catch (error) {
      console.error('Error checking watchlist:', error);
      setIsInWatchlistState(false);
    }
  };

  const toggleWatchlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      // Redirect to sign in
      window.location.href = '/auth/signin';
      return;
    }

    setIsLoading(true);

    try {
      if (isInWatchlistState) {
        // Remove from watchlist
        const success = removeFromWatchlist(movieId, mediaType);
        if (success) {
          setIsInWatchlistState(false);
        } else {
          console.error('Failed to remove from watchlist');
        }
      } else {
        // Add to watchlist
        const success = addToWatchlist({
          movieId,
          mediaType,
          title,
          posterPath,
        });
        if (success) {
          setIsInWatchlistState(true);
        } else {
          console.error('Failed to add to watchlist');
        }
      }
    } catch (error) {
      console.error('Error toggling watchlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={toggleWatchlist}
      disabled={isLoading}
      className={`watchlist-btn ${isInWatchlistState ? 'added' : ''}`}
      title={isInWatchlistState ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      ) : (
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24"
          className="transition-colors duration-200"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      )}
    </button>
  );
}
