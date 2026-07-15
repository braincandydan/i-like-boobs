import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Create a null client if environment variables are missing
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = () => Boolean(supabase);

export type Profile = {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
};

export type CustomSection = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  type: 'manual' | 'genre' | 'year' | 'builtin';
  genre_id?: number;
  year?: number;
  movies: any[];
  enabled: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type UserWatchlist = {
  id: string;
  user_id: string;
  movie_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path?: string;
  added_at: string;
};

// Watchlist — synced via the `watchlist` table (see
// migrations/watchlist_table.sql) so it follows the user across
// devices/browsers instead of living only in one browser's localStorage.

export async function getWatchlist(userId: string): Promise<UserWatchlist[]> {
  if (!isSupabaseConfigured() || !userId) return [];

  const { data, error } = await supabase!
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  if (error) {
    console.error('Error fetching watchlist:', error);
    return [];
  }

  return data || [];
}

export async function isInWatchlist(movieId: number, mediaType: 'movie' | 'tv', userId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;

  const { data, error } = await supabase!
    .from('watchlist')
    .select('id')
    .eq('user_id', userId)
    .eq('movie_id', movieId)
    .eq('media_type', mediaType)
    .maybeSingle();

  if (error) {
    console.error('Error checking watchlist:', error);
    return false;
  }

  return Boolean(data);
}

export async function addToWatchlist(
  item: { movieId: number; mediaType: 'movie' | 'tv'; title: string; posterPath?: string },
  userId: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;

  const { error } = await supabase!
    .from('watchlist')
    .insert({
      user_id: userId,
      movie_id: item.movieId,
      media_type: item.mediaType,
      title: item.title,
      poster_path: item.posterPath || null,
    });

  if (error) {
    // Unique constraint violation just means it's already there — not a failure.
    if (error.code === '23505') return true;
    console.error('Error adding to watchlist:', error);
    return false;
  }

  return true;
}

export async function removeFromWatchlist(
  movieId: number,
  mediaType: 'movie' | 'tv',
  userId: string
): Promise<boolean> {
  if (!isSupabaseConfigured() || !userId) return false;

  const { error } = await supabase!
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('movie_id', movieId)
    .eq('media_type', mediaType);

  if (error) {
    console.error('Error removing from watchlist:', error);
    return false;
  }

  return true;
}

export type TMDBFilters = {
  media_type?: 'movie' | 'tv';
  with_genres?: number[];
  with_companies?: number[];
  primary_release_year?: number;
  first_air_date_year?: number;
  'vote_average.gte'?: number;
  'vote_average.lte'?: number;
  sort_by?: string;
  with_keywords?: number[];
  with_original_language?: string;
  region?: string;
  'primary_release_date.gte'?: string;
  'primary_release_date.lte'?: string;
  'first_air_date.gte'?: string;
  'first_air_date.lte'?: string;
  with_watch_providers?: string;
  watch_region?: string;
  certification?: string; // Movie certification (e.g., "G", "PG", "R", "NC-17", "X")
  certification_country?: string; // Country code for certification (e.g., "US")
  with_cast?: number[]; // Filter by actor/actress IDs
  [key: string]: any; // Allow other TMDB discover params
};

export type HomepageSectionConfig = {
  visible_on?: string[]; // Array of page slugs: ["homepage", "movies", "tv-shows"]
  page_order?: Record<string, number>; // Object mapping page slugs to order_index
  tmdb_filters?: TMDBFilters; // TMDB discover API parameters for auto-generated categories
};

export type HomepageSection = {
  id: string;
  section_key: string; // e.g., 'trending', 'popular-movies', or custom UUID
  title: string;
  section_type: 'builtin' | 'custom';
  custom_section_id?: string;
  order_index: number;
  enabled: boolean;
  config?: HomepageSectionConfig;
  created_at: string;
  updated_at: string;
};

// Default homepage sections
export const DEFAULT_HOMEPAGE_SECTIONS = [
  { section_key: 'trending', title: 'Trending Now', section_type: 'builtin' as const },
  { section_key: 'popular-movies', title: 'Popular Movies', section_type: 'builtin' as const },
  { section_key: 'top-rated', title: 'Top Rated Movies', section_type: 'builtin' as const },
  { section_key: 'popular-tv', title: 'Popular TV Shows', section_type: 'builtin' as const },
  { section_key: 'upcoming', title: 'Upcoming Movies', section_type: 'builtin' as const },
];
