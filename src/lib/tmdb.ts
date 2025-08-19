const API_KEY = import.meta.env.PUBLIC_TMDB_API_KEY;
const BASE_URL = import.meta.env.PUBLIC_TMDB_BASE_URL;
const IMAGE_BASE_URL = import.meta.env.PUBLIC_TMDB_IMAGE_BASE_URL;

if (!API_KEY) {
  throw new Error('TMDB API key is required');
}

export async function fetchFromTMDB(endpoint: string, params: Record<string, any> = {}) {
  const searchParams = new URLSearchParams({
    api_key: API_KEY,
    ...params,
  });

  try {
    const response = await fetch(`${BASE_URL}${endpoint}?${searchParams}`);
    
    if (!response.ok) {
      throw new Error(`TMDB API Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('TMDB API Request Error:', error);
    throw error;
  }
}

export function getImageUrl(path: string, size: string = 'w500'): string {
  if (!path) {
    return '/placeholder-poster.jpg';
  }
  return `${IMAGE_BASE_URL}/${size}${path}`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatRuntime(minutes: number): string {
  if (!minutes) return 'Unknown';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}m`;
  }
  
  return `${hours}h ${mins}m`;
}

// API endpoints
export const tmdbEndpoints = {
  trending: '/trending/movie/week',
  popularMovies: '/movie/popular',
  topRatedMovies: '/movie/top_rated',
  upcomingMovies: '/movie/upcoming',
  popularTv: '/tv/popular',
  movieDetails: (id: number) => `/movie/${id}`,
  tvDetails: (id: number) => `/tv/${id}`,
  search: '/search/multi',
  genres: (type: 'movie' | 'tv' = 'movie') => `/genre/${type}/list`,
  discover: (type: 'movie' | 'tv' = 'movie') => `/discover/${type}`,
};
