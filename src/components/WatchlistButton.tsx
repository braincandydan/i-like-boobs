import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $user, $profile } from '../stores/auth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkWatchlistStatus();
    }
  }, [user, movieId, mediaType]);

  const checkWatchlistStatus = async () => {
    if (!user || !isSupabaseConfigured() || !supabase) return;

    try {
      const { data, error } = await supabase
        .from('user_watchlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('movie_id', movieId)
        .eq('media_type', mediaType)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking watchlist:', error);
        return;
      }

      setIsInWatchlist(!!data);
    } catch (error) {
      console.error('Error checking watchlist:', error);
    }
  };

  const toggleWatchlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      // Redirect to sign in
      window.location.href = '/auth/signin';
      return;
    }

    if (!isSupabaseConfigured() || !supabase) {
      alert('Authentication not configured');
      return;
    }

    setIsLoading(true);

    try {
      if (isInWatchlist) {
        // Remove from watchlist
        const { error } = await supabase
          .from('user_watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('movie_id', movieId)
          .eq('media_type', mediaType);

        if (error) throw error;
        setIsInWatchlist(false);
      } else {
        // Add to watchlist
        const { error } = await supabase
          .from('user_watchlist')
          .insert({
            user_id: user.id,
            movie_id: movieId,
            media_type: mediaType,
            title,
            poster_path: posterPath,
          });

        if (error) throw error;
        setIsInWatchlist(true);
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
      className={`watchlist-btn ${isInWatchlist ? 'added' : ''}`}
      title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
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
