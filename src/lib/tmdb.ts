const API_KEY = import.meta.env.PUBLIC_TMDB_API_KEY;
const BASE_URL = import.meta.env.PUBLIC_TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = import.meta.env.PUBLIC_TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';

if (!API_KEY) {
  console.warn('TMDB API key is not configured. Movie data will not load.');
}

export async function fetchFromTMDB(endpoint: string, params: Record<string, any> = {}) {
  if (!API_KEY) {
    throw new Error('TMDB API key is not configured');
  }

  const searchParams = new URLSearchParams({
    api_key: API_KEY,
    ...params,
  });

  try {
    const url = `${BASE_URL}${endpoint}?${searchParams}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`TMDB API Error: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error: any) {
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
  keywords: '/search/keyword',
  companies: '/search/company',
  languages: '/configuration/languages',
  regions: '/configuration/countries',
  certifications: (type: 'movie' | 'tv' = 'movie') => `/certification/${type}/list`,
};

// Import filter types from supabase
import type { TMDBFilters } from './supabase';

/**
 * Fetch genres for movies or TV shows
 */
export async function fetchGenres(type: 'movie' | 'tv' = 'movie'): Promise<{ id: number; name: string }[]> {
  try {
    const data = await fetchFromTMDB(tmdbEndpoints.genres(type));
    return data.genres || [];
  } catch (error) {
    console.error(`Error fetching ${type} genres:`, error);
    return [];
  }
}

/**
 * Search for companies by name
 */
export async function searchCompanies(query: string): Promise<{ id: number; name: string; logo_path?: string }[]> {
  try {
    if (!query.trim()) return [];
    const data = await fetchFromTMDB(tmdbEndpoints.companies, { query: query.trim() });
    return data.results || [];
  } catch (error) {
    console.error('Error searching companies:', error);
    return [];
  }
}

/**
 * Discover movies or TV shows with filters
 * Uses TMDB discover API with comprehensive filter support
 */
export async function discoverWithFilters(
  type: 'movie' | 'tv',
  filters: TMDBFilters = {},
  limit: number = 20
): Promise<any[]> {
  try {
    // Build query parameters from filters
    const params: Record<string, any> = {
      ...filters,
    };

    // Convert genre array to comma-separated string if present
    if (params.with_genres && Array.isArray(params.with_genres)) {
      params.with_genres = params.with_genres.join(',');
    }

    // Convert keyword array to comma-separated string if present
    if (params.with_keywords && Array.isArray(params.with_keywords)) {
      params.with_keywords = params.with_keywords.join(',');
    }

    // Convert companies array to comma-separated string if present
    if (params.with_companies && Array.isArray(params.with_companies)) {
      params.with_companies = params.with_companies.join(',');
    }

    // Include adult content if certification filter is set (needed for X, NC-17, etc.)
    // Also include if explicitly requested
    // Always include adult content when filtering by certification to ensure all ratings are available
    if (params.certification) {
      params.include_adult = true;
    } else if (filters.include_adult) {
      params.include_adult = true;
    }

    // Set default sort if not provided
    if (!params.sort_by) {
      params.sort_by = type === 'movie' ? 'popularity.desc' : 'popularity.desc';
    }

    // Remove media_type from params (it's in the endpoint)
    delete params.media_type;

    const data = await fetchFromTMDB(tmdbEndpoints.discover(type), params);
    return (data.results || []).slice(0, limit);
  } catch (error) {
    console.error(`Error discovering ${type} with filters:`, error);
    return [];
  }
}

/**
 * Fetch available languages for filtering
 */
export async function fetchLanguages(): Promise<{ iso_639_1: string; english_name: string }[]> {
  try {
    const data = await fetchFromTMDB(tmdbEndpoints.languages);
    return data || [];
  } catch (error) {
    console.error('Error fetching languages:', error);
    return [];
  }
}

/**
 * Fetch available regions/countries for filtering
 */
export async function fetchRegions(): Promise<{ iso_3166_1: string; english_name: string }[]> {
  try {
    const data = await fetchFromTMDB(tmdbEndpoints.regions);
    return data || [];
  } catch (error) {
    console.error('Error fetching regions:', error);
    return [];
  }
}

/**
 * Search keywords for filtering
 */
export async function searchKeywords(query: string): Promise<{ id: number; name: string }[]> {
  if (!query.trim()) return [];
  
  try {
    const data = await fetchFromTMDB(tmdbEndpoints.keywords, { query: query.trim() });
    return (data.results || []).slice(0, 10);
  } catch (error) {
    console.error('Error searching keywords:', error);
    return [];
  }
}

/**
 * Fetch movie certifications (ratings) for filtering
 * Returns certifications for US by default, but includes all countries
 */
export async function fetchMovieCertifications(): Promise<{ country: string; certifications: { certification: string; meaning: string; order: number }[] }[]> {
  try {
    const data = await fetchFromTMDB(tmdbEndpoints.certifications('movie'));
    // Data structure: { certifications: { US: [...], CA: [...], ... } }
    const certifications = data.certifications || {};
    
    // Convert to array format for easier use
    return Object.entries(certifications).map(([country, certs]: [string, any]) => ({
      country,
      certifications: certs || []
    }));
  } catch (error) {
    console.error('Error fetching movie certifications:', error);
    return [];
  }
}

/**
 * Get all unique certifications across all countries, sorted by order
 * This is useful for a unified certification filter
 */
export async function getAllMovieCertifications(): Promise<{ certification: string; meaning: string; order: number }[]> {
  try {
    const countryCerts = await fetchMovieCertifications();
    const certMap = new Map<string, { certification: string; meaning: string; order: number }>();
    
    // Collect all unique certifications, prioritizing US if available
    const usCerts = countryCerts.find(c => c.country === 'US');
    if (usCerts) {
      usCerts.certifications.forEach(cert => {
        certMap.set(cert.certification, cert);
      });
    }
    
    // Add any other certifications not in US list
    countryCerts.forEach(countryCert => {
      countryCert.certifications.forEach(cert => {
        if (!certMap.has(cert.certification)) {
          certMap.set(cert.certification, cert);
        }
      });
    });
    
    // Sort by order
    return Array.from(certMap.values()).sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error('Error getting all movie certifications:', error);
    return [];
  }
}

/**
 * Common sort_by options for discover API
 */
export const sortByOptions = [
  { value: 'popularity.desc', label: 'Popularity (Descending)' },
  { value: 'popularity.asc', label: 'Popularity (Ascending)' },
  { value: 'release_date.desc', label: 'Release Date (Newest)' },
  { value: 'release_date.asc', label: 'Release Date (Oldest)' },
  { value: 'vote_average.desc', label: 'Rating (Highest)' },
  { value: 'vote_average.asc', label: 'Rating (Lowest)' },
  { value: 'vote_count.desc', label: 'Most Votes' },
  { value: 'revenue.desc', label: 'Revenue (Highest)' },
  { value: 'primary_release_date.desc', label: 'Primary Release (Newest)' },
  { value: 'original_title.asc', label: 'Title (A-Z)' },
  { value: 'original_title.desc', label: 'Title (Z-A)' },
];

/**
 * TV-specific sort options
 */
export const tvSortByOptions = [
  { value: 'popularity.desc', label: 'Popularity (Descending)' },
  { value: 'popularity.asc', label: 'Popularity (Ascending)' },
  { value: 'first_air_date.desc', label: 'First Air Date (Newest)' },
  { value: 'first_air_date.asc', label: 'First Air Date (Oldest)' },
  { value: 'vote_average.desc', label: 'Rating (Highest)' },
  { value: 'vote_average.asc', label: 'Rating (Lowest)' },
  { value: 'vote_count.desc', label: 'Most Votes' },
  { value: 'name.asc', label: 'Name (A-Z)' },
  { value: 'name.desc', label: 'Name (Z-A)' },
];
