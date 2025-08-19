# NotFlix - Astro Migration

A modern movie discovery app built with Astro, featuring user authentication, watchlists, and admin functionality.

## 🚀 Features

### 🎬 Core Features
- **Movie Discovery**: Browse trending, popular, and top-rated movies/TV shows
- **Search**: Find your favorite content
- **Detailed Information**: View movie details, ratings, cast, and more
- **Responsive Design**: Works perfectly on all devices

### 👤 User Features
- **User Authentication**: Sign up, sign in, and manage profiles
- **Personal Watchlists**: Save movies and TV shows to watch later
- **User Profiles**: Customize your profile and preferences

### 🛡️ Admin Features
- **Content Management**: Control which sections appear on the homepage
- **Custom Sections**: Create curated movie collections
- **User Management**: Admin dashboard for managing users
- **Role-based Access**: Admin-only areas and features

## 🏗️ Tech Stack

- **Framework**: [Astro](https://astro.build/) - Static site generator with islands architecture
- **Frontend**: React components for interactive elements
- **Styling**: Tailwind CSS for responsive design
- **Authentication**: Supabase Auth for user management
- **Database**: Supabase PostgreSQL for user data and watchlists
- **API**: TMDB (The Movie Database) for movie data
- **State Management**: Nanostores for lightweight reactive state
- **Deployment**: Vercel/Netlify ready

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (free tier available)

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd notflix-astro
   npm install
   ```

2. **Set up Supabase**:
   - Create a new project at [supabase.com](https://supabase.com)
   - Copy your project URL and anon key
   - Create the required tables (see Database Setup below)

3. **Environment Setup**:
   ```bash
   cp .env.example .env
   ```
   
   Fill in your environment variables:
   ```env
   PUBLIC_SUPABASE_URL=your_supabase_project_url
   PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   PUBLIC_TMDB_API_KEY=6f2345080ac02f962901b6baa3723f58
   PUBLIC_TMDB_BASE_URL=https://api.themoviedb.org/3
   PUBLIC_TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p
   PUBLIC_SITE_URL=http://localhost:4321
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

### Database Setup

Create these tables in your Supabase database:

```sql
-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- User watchlist
CREATE TABLE user_watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  title TEXT NOT NULL,
  poster_path TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(user_id, movie_id, media_type)
);

-- Custom sections (for admin content management)
CREATE TABLE custom_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('manual', 'genre', 'year')),
  genre_id INTEGER,
  year INTEGER,
  movies JSONB DEFAULT '[]'::jsonb,
  enabled BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_sections ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Policies for watchlist
CREATE POLICY "Users can view own watchlist" ON user_watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own watchlist items" ON user_watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own watchlist items" ON user_watchlist FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own watchlist items" ON user_watchlist FOR DELETE USING (auth.uid() = user_id);

-- Policies for custom sections (admin only)
CREATE POLICY "Admin can manage custom sections" ON custom_sections FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
CREATE POLICY "Everyone can view enabled custom sections" ON custom_sections FOR SELECT USING (enabled = true);
```

## 📁 Project Structure

```
src/
├── components/           # Reusable components
│   ├── AuthButton.tsx   # Authentication dropdown
│   ├── MovieCard.astro  # Movie display card
│   ├── Navbar.astro     # Navigation bar
│   ├── SignInForm.tsx   # Sign in form
│   ├── SignUpForm.tsx   # Sign up form
│   └── WatchlistButton.tsx # Add/remove from watchlist
├── layouts/
│   └── Layout.astro     # Base page layout
├── lib/
│   ├── supabase.ts      # Supabase client and types
│   └── tmdb.ts          # TMDB API client
├── pages/               # File-based routing
│   ├── auth/            # Authentication pages
│   ├── admin/           # Admin dashboard (coming soon)
│   └── index.astro      # Homepage
├── stores/
│   └── auth.ts          # Authentication state management
└── styles/
    └── global.css       # Global styles with Tailwind
```

## 🔧 Key Improvements over Original

### ✅ **Better Performance**
- Static site generation (SSG) for faster loading
- Optimized images and lazy loading
- Minimal JavaScript shipped to browser

### ✅ **Modern Authentication**
- Secure user authentication with Supabase
- Role-based access control (user/admin)
- Password reset and email verification

### ✅ **Better Developer Experience**
- TypeScript for type safety
- Component-based architecture
- Hot module replacement in development

### ✅ **Enhanced Features**
- User watchlists stored in database
- Admin content management system
- Responsive design with Tailwind CSS

### ✅ **Easy Deployment**
- Deploy to Vercel/Netlify with one click
- Environment variable support
- Automatic builds on git push

## 🚀 Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables
4. Deploy automatically

### Netlify
1. Push code to GitHub
2. Connect repository to Netlify
3. Add environment variables
4. Deploy automatically

## 🔐 Admin Setup

To make a user an admin:

1. Sign up normally through the app
2. In your Supabase dashboard, go to Table Editor → profiles
3. Find your user and change `role` from `'user'` to `'admin'`
4. You'll now see the Admin menu in the navigation

## 🎯 Next Steps

- [ ] Complete admin dashboard migration
- [ ] Add movie details pages
- [ ] Implement search functionality
- [ ] Add user profiles page
- [ ] Set up email templates
- [ ] Add social authentication (Google, GitHub)

## 📝 License

MIT License - feel free to use this for your own projects!

## 🙏 Acknowledgments

- [TMDB](https://www.themoviedb.org/) for movie data
- [Astro](https://astro.build/) for the amazing framework
- [Supabase](https://supabase.com/) for backend services
- [Tailwind CSS](https://tailwindcss.com/) for styling