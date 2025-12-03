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
