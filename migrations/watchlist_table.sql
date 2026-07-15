-- Migration: Add watchlist table for cross-device sync
-- Run this SQL in your Supabase SQL Editor
--
-- Previously the watchlist was localStorage-only (keyed by Supabase user
-- id), so it didn't sync across devices/browsers despite requiring sign-in.
-- This gives it a real backing table. CLAUDE.md already documented a
-- `watchlist` table and src/lib/supabase.ts already had a UserWatchlist
-- type for it, but neither the table nor the query functions existed until
-- now.

CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  movie_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title TEXT NOT NULL,
  poster_path TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (user_id, movie_id, media_type)
);

ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own watchlist" ON public.watchlist;
DROP POLICY IF EXISTS "Users can insert own watchlist items" ON public.watchlist;
DROP POLICY IF EXISTS "Users can delete own watchlist items" ON public.watchlist;

CREATE POLICY "Users can view own watchlist"
  ON public.watchlist
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist items"
  ON public.watchlist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist items"
  ON public.watchlist
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist(user_id);
