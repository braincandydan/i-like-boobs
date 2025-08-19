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
  type: 'manual' | 'genre' | 'year';
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
