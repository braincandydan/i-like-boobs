# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working with the owner — MUST READ

- **When a request is ambiguous, ASK before building.** Do not interpret and implement — confirm exactly what is wanted first.
- **Never add, remove, or change anything beyond what was explicitly asked.** Scope creep causes rework and frustration.
- **One thing at a time.** Implement exactly what was requested, build, confirm it works, then stop.
- The owner has explicitly said: repeated wrong implementations due to assumptions are unacceptable. If unsure about any detail, ask a single clear question before writing any code.

## Commands

```bash
npm run dev       # Dev server at localhost:3000
npm run build     # Static build to /dist
npm run preview   # Preview production build locally
```

No linting, testing, or type-checking scripts are configured.

## Environment Variables

Required for local development (create a `.env` file):
```
PUBLIC_TMDB_API_KEY=
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
PUBLIC_TMDB_BASE_URL=https://api.themoviedb.org/3       # optional
PUBLIC_TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p   # optional
```

## Architecture

**NotFlix** is a Netflix-like streaming discovery site built with Astro 5 (static output), React 19 islands, Tailwind CSS, Supabase (Postgres + Auth), and TMDB as the movie/show data source. It deploys to GitHub Pages at `/i-like-boobs` base path.

### Key layers

- **`src/pages/`** — Astro routes. `details.astro` is the single universal detail page for both movies and TV shows — it renders a shell and fetches TMDB data client-side by reading `?type=` and `id=` from the query string (there is no per-movie/per-show static route). The `watch.astro` and `watch-torrent.astro` pages handle playback via VidSrc embeds and WebTorrent fallback respectively.
- **`src/components/`** — Mostly React (`.tsx`) for interactive UI, Astro (`.astro`) for static shells. Heavy components: `SearchForm.tsx`, `CategoryManager.tsx`, `HomepageSections.tsx`.
- **`src/lib/tmdb.ts`** — All TMDB API calls: discover, search, filters (genres, certifications, actors, keywords, companies), image URL helpers.
- **`src/lib/supabase.ts`** — Supabase client, all DB operations (watchlist, custom sections, homepage config, user profiles with roles).
- **`src/stores/auth.ts`** — Nanostores atoms for user session. Auth state is reactive and shared across React islands.
- **`src/lib/authInit.ts`** — Runs client-side on every page to hydrate auth store from Supabase session.

### Auth and watchlist require Supabase

There is no localStorage-based auth or watchlist fallback — both require `PUBLIC_SUPABASE_URL`/`PUBLIC_SUPABASE_ANON_KEY` to be set. Without them, `isSupabaseConfigured()` (in `src/lib/supabase.ts`) returns false and sign-in/watchlist features are unavailable rather than degrading to a local-only mode. The watchlist itself is stored in the `watchlist` table (see `migrations/watchlist_table.sql`) and syncs across devices for a signed-in user.

### Islands architecture

Astro renders everything statically by default. React components are hydrated on the client only where interactivity is needed (e.g., `client:load` on `AuthButton`, `SearchForm`). Avoid adding `client:load` to components that don't need it.

### Base path

`astro.config.mjs` sets `base: '/i-like-boobs'`. All internal links must use the `createUrl()` helper from `src/lib/utils.ts` to prepend this base path correctly. Hardcoded `/` paths will break on GitHub Pages.

### Streaming

`watch.astro` embeds VidSrc iframes with multiple fallback domains. Auto-next-episode logic uses `postMessage` events from the iframe and TMDB episode duration data. The `resolver-poc/` directory is a standalone Vercel serverless experiment for resolving stream URLs via Browserless.io — it is not part of the main build.

### Supabase schema

Migrations live in `migrations/`. Tables include: `profiles` (with `role` column for admin gating), `watchlist`, `custom_sections`, `homepage_sections`. Row-level security (RLS) is enabled on all tables.

### Tailwind theme

Custom Netflix-inspired colors are defined in `tailwind.config.mjs`: `netflix-red`, `netflix-black`, `netflix-gray`. Use these instead of generic red/black/gray utilities for visual consistency.
