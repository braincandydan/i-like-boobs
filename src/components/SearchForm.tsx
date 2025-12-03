import { useState, useEffect } from 'react';
import { fetchFromTMDB, tmdbEndpoints, getImageUrl, fetchGenres, sortByOptions, tvSortByOptions, discoverWithFilters } from '../lib/tmdb';
import type { TMDBFilters } from '../lib/supabase';

interface SearchFormProps {
  basePath?: string;
}

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type: 'movie' | 'tv' | 'person';
}

export default function SearchForm({ basePath = '/' }: SearchFormProps) {
  // Create URL with base path for GitHub Pages
  function createUrl(path: string): string {
    // Remove leading slash from path if it exists
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    
    // Ensure base ends with slash and combine
    const baseWithSlash = basePath.endsWith('/') ? basePath : `${basePath}/`;
    
    return `${baseWithSlash}${cleanPath}`;
  }
  const [query, setQuery] = useState('');
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMode, setSearchMode] = useState<'search' | 'discover'>('search');
  
  // Filter state
  const [filters, setFilters] = useState({
    mediaType: 'all' as 'all' | 'movie' | 'tv',
    genres: [] as number[],
    startYear: '' as string | number,
    endYear: '' as string | number,
    minRating: '' as string | number,
    sortBy: 'popularity.desc' as string
  });
  
  const [availableGenres, setAvailableGenres] = useState<{ id: number; name: string }[]>([]);
  const [loadingGenres, setLoadingGenres] = useState(false);
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showRatingDropdown, setShowRatingDropdown] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // If no query and no filters, don't search
    if (!query.trim() && !hasActiveFilters) return;
    
    setIsLoading(true);
    setHasSearched(true);
    
    try {
      // If there's a text query, use search API
      if (query.trim()) {
        setSearchMode('search');
        const data = await fetchFromTMDB(tmdbEndpoints.search, {
          query: query.trim(),
          include_adult: false
        });
        
        // Filter out person results and only keep movies and TV shows
        const movieTvResults = data.results.filter(
          (item: SearchResult) => item.media_type === 'movie' || item.media_type === 'tv'
        );
        
        setAllResults(movieTvResults);
      } else {
        // No query but filters are set - use discover API
        setSearchMode('discover');
        await handleDiscover();
      }
    } catch (error) {
      console.error('Search error:', error);
      setAllResults([]);
      setFilteredResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscover = async () => {
    if (!hasActiveFilters) return;
    
    setIsLoading(true);
    setHasSearched(true);
    setSearchMode('discover');
    
    try {
      // Build TMDB filters
      const tmdbFilters: TMDBFilters = {};
      
      // Media type is required for discover
      const mediaType = filters.mediaType === 'all' ? 'movie' : filters.mediaType;
      tmdbFilters.media_type = mediaType;
      
      // Genres
      if (filters.genres.length > 0) {
        tmdbFilters.with_genres = filters.genres;
      }
      
      // Year range
      if (filters.startYear || filters.endYear) {
        const startYear = filters.startYear ? (typeof filters.startYear === 'string' ? parseInt(filters.startYear) : filters.startYear) : undefined;
        const endYear = filters.endYear ? (typeof filters.endYear === 'string' ? parseInt(filters.endYear) : filters.endYear) : undefined;
        
        if (startYear && !isNaN(startYear) && endYear && !isNaN(endYear) && startYear === endYear) {
          // Single year selected
          if (mediaType === 'movie') {
            tmdbFilters.primary_release_year = startYear;
          } else {
            tmdbFilters.first_air_date_year = startYear;
          }
        } else {
          // Year range
          if (startYear && !isNaN(startYear)) {
            if (mediaType === 'movie') {
              tmdbFilters['primary_release_date.gte'] = `${startYear}-01-01`;
            } else {
              tmdbFilters['first_air_date.gte'] = `${startYear}-01-01`;
            }
          }
          if (endYear && !isNaN(endYear)) {
            if (mediaType === 'movie') {
              tmdbFilters['primary_release_date.lte'] = `${endYear}-12-31`;
            } else {
              tmdbFilters['first_air_date.lte'] = `${endYear}-12-31`;
            }
          }
        }
      }
      
      // Rating
      if (filters.minRating) {
        const minRating = typeof filters.minRating === 'string' ? parseFloat(filters.minRating) : filters.minRating;
        if (!isNaN(minRating)) {
          tmdbFilters['vote_average.gte'] = minRating;
        }
      }
      
      // Sort
      if (filters.sortBy && filters.sortBy !== 'relevance') {
        // Map our sort options to TMDB sort options
        const sortMap: Record<string, string> = {
          'rating.desc': 'vote_average.desc',
          'rating.asc': 'vote_average.asc',
          'year.desc': mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
          'year.asc': mediaType === 'movie' ? 'primary_release_date.asc' : 'first_air_date.asc',
          'title.asc': mediaType === 'movie' ? 'original_title.asc' : 'name.asc',
          'title.desc': mediaType === 'movie' ? 'original_title.desc' : 'name.desc',
        };
        tmdbFilters.sort_by = sortMap[filters.sortBy] || 'popularity.desc';
      } else {
        tmdbFilters.sort_by = 'popularity.desc';
      }
      
      // Discover for the selected media type
      let results = await discoverWithFilters(mediaType, tmdbFilters, 100);
      
      // If "all" was selected, also get the other type
      if (filters.mediaType === 'all') {
        const otherType = mediaType === 'movie' ? 'tv' : 'movie';
        const otherFilters = { ...tmdbFilters, media_type: otherType };
        // Adjust year field for the other type
        if (filters.year) {
          const year = typeof filters.year === 'string' ? parseInt(filters.year) : filters.year;
          if (!isNaN(year)) {
            delete otherFilters.primary_release_year;
            delete otherFilters.first_air_date_year;
            if (otherType === 'movie') {
              otherFilters.primary_release_year = year;
            } else {
              otherFilters.first_air_date_year = year;
            }
          }
        }
        const otherResults = await discoverWithFilters(otherType, otherFilters, 100);
        results = [...results, ...otherResults];
      }
      
      setAllResults(results);
    } catch (error) {
      console.error('Discover error:', error);
      setAllResults([]);
      setFilteredResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = (item: SearchResult) => {
    return item.media_type === 'movie' ? item.title : item.name;
  };

  const getDate = (item: SearchResult) => {
    const date = item.media_type === 'movie' ? item.release_date : item.first_air_date;
    if (!date) return '';
    return new Date(date).getFullYear().toString();
  };

  // Load genres on mount
  useEffect(() => {
    const loadGenres = async () => {
      setLoadingGenres(true);
      try {
        const [movieGenres, tvGenres] = await Promise.all([
          fetchGenres('movie'),
          fetchGenres('tv')
        ]);
        // Combine and deduplicate genres
        const allGenres = [...movieGenres];
        tvGenres.forEach(tvGenre => {
          if (!allGenres.find(g => g.id === tvGenre.id)) {
            allGenres.push(tvGenre);
          }
        });
        setAvailableGenres(allGenres.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error('Error loading genres:', error);
      } finally {
        setLoadingGenres(false);
      }
    };
    loadGenres();
  }, []);

  // Apply filters to results whenever filters or allResults change
  // For search mode, apply client-side filters. For discover mode, results are already filtered.
  useEffect(() => {
    if (allResults.length === 0) {
      setFilteredResults([]);
      return;
    }

    // If using discover API, results are already filtered, just apply sorting if needed
    if (searchMode === 'discover') {
      let filtered = [...allResults];
      
      // Only apply sorting if not already sorted by TMDB
      if (filters.sortBy && filters.sortBy !== 'relevance' && filters.sortBy !== 'popularity.desc') {
        filtered.sort((a, b) => {
          switch (filters.sortBy) {
            case 'rating.desc':
              return b.vote_average - a.vote_average;
            case 'rating.asc':
              return a.vote_average - b.vote_average;
            case 'year.desc': {
              const aDate = a.media_type === 'movie' ? a.release_date : a.first_air_date;
              const bDate = b.media_type === 'movie' ? b.release_date : b.first_air_date;
              if (!aDate) return 1;
              if (!bDate) return -1;
              return new Date(bDate).getTime() - new Date(aDate).getTime();
            }
            case 'year.asc': {
              const aDate = a.media_type === 'movie' ? a.release_date : a.first_air_date;
              const bDate = b.media_type === 'movie' ? b.release_date : b.first_air_date;
              if (!aDate) return 1;
              if (!bDate) return -1;
              return new Date(aDate).getTime() - new Date(bDate).getTime();
            }
            case 'title.asc': {
              const aTitle = a.media_type === 'movie' ? a.title : a.name;
              const bTitle = b.media_type === 'movie' ? b.title : b.name;
              return (aTitle || '').localeCompare(bTitle || '');
            }
            case 'title.desc': {
              const aTitle = a.media_type === 'movie' ? a.title : a.name;
              const bTitle = b.media_type === 'movie' ? b.title : b.name;
              return (bTitle || '').localeCompare(aTitle || '');
            }
            default:
              return 0;
          }
        });
      }
      
      setFilteredResults(filtered);
      return;
    }

    // For search mode, apply all filters client-side
    let filtered = [...allResults];

    // Filter by media type
    if (filters.mediaType !== 'all') {
      filtered = filtered.filter(item => item.media_type === filters.mediaType);
    }

    // Filter by year range
    if (filters.startYear || filters.endYear) {
      const startYear = filters.startYear ? (typeof filters.startYear === 'string' ? parseInt(filters.startYear) : filters.startYear) : undefined;
      const endYear = filters.endYear ? (typeof filters.endYear === 'string' ? parseInt(filters.endYear) : filters.endYear) : undefined;
      
      if (startYear && !isNaN(startYear) || endYear && !isNaN(endYear)) {
        filtered = filtered.filter(item => {
          const date = item.media_type === 'movie' ? item.release_date : item.first_air_date;
          if (!date) return false;
          const itemYear = new Date(date).getFullYear();
          
          if (startYear && endYear && startYear === endYear) {
            // Single year
            return itemYear === startYear;
          } else {
            // Year range
            const meetsStart = !startYear || itemYear >= startYear;
            const meetsEnd = !endYear || itemYear <= endYear;
            return meetsStart && meetsEnd;
          }
        });
      }
    }

    // Filter by minimum rating
    if (filters.minRating) {
      const minRating = typeof filters.minRating === 'string' ? parseFloat(filters.minRating) : filters.minRating;
      if (!isNaN(minRating)) {
        filtered = filtered.filter(item => item.vote_average >= minRating);
      }
    }

    // Sort results
    if (filters.sortBy !== 'relevance') {
      filtered.sort((a, b) => {
        switch (filters.sortBy) {
          case 'rating.desc':
            return b.vote_average - a.vote_average;
          case 'rating.asc':
            return a.vote_average - b.vote_average;
          case 'year.desc': {
            const aDate = a.media_type === 'movie' ? a.release_date : a.first_air_date;
            const bDate = b.media_type === 'movie' ? b.release_date : b.first_air_date;
            if (!aDate) return 1;
            if (!bDate) return -1;
            return new Date(bDate).getTime() - new Date(aDate).getTime();
          }
          case 'year.asc': {
            const aDate = a.media_type === 'movie' ? a.release_date : a.first_air_date;
            const bDate = b.media_type === 'movie' ? b.release_date : b.first_air_date;
            if (!aDate) return 1;
            if (!bDate) return -1;
            return new Date(aDate).getTime() - new Date(bDate).getTime();
          }
          case 'title.asc': {
            const aTitle = a.media_type === 'movie' ? a.title : a.name;
            const bTitle = b.media_type === 'movie' ? b.title : b.name;
            return (aTitle || '').localeCompare(bTitle || '');
          }
          case 'title.desc': {
            const aTitle = a.media_type === 'movie' ? a.title : a.name;
            const bTitle = b.media_type === 'movie' ? b.title : b.name;
            return (bTitle || '').localeCompare(aTitle || '');
          }
          default:
            return 0;
        }
      });
    }

    setFilteredResults(filtered);
  }, [filters, allResults, searchMode]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      mediaType: 'all',
      genres: [],
      startYear: '',
      endYear: '',
      minRating: '',
      sortBy: 'popularity.desc'
    });
    setShowGenreDropdown(false);
    setShowYearDropdown(false);
    setShowRatingDropdown(false);
  };

  const hasActiveFilters = filters.mediaType !== 'all' || 
    filters.genres.length > 0 || 
    filters.startYear !== '' || 
    filters.endYear !== '' ||
    filters.minRating !== '' || 
    (filters.sortBy !== 'relevance' && filters.sortBy !== 'popularity.desc');

  return (
    <div className="w-full">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for movies, TV shows..."
              className="w-full px-4 py-3 text-lg bg-gray-800 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent pr-16"
            />
            <button 
              type="submit"
              disabled={isLoading || (!query.trim() && !hasActiveFilters)}
              className="absolute right-2 top-2 bottom-2 px-6 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <i className="fas fa-search"></i>
              )}
            </button>
          </div>
          {hasActiveFilters && !query.trim() && (
            <button
              type="button"
              onClick={() => handleDiscover()}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <i className="fas fa-compass mr-2"></i>
              Discover
            </button>
          )}
        </div>
      </form>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Searching...</p>
          </div>
        </div>
      )}

      {/* Filter Panel - Always Visible */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 md:gap-4">
            {/* Media Type - Button Selectors - Wider Column */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-white mb-2 text-xs md:text-sm font-semibold">Media Type</label>
              <div className="flex gap-1.5 md:gap-2">
                <button
                  type="button"
                  onClick={() => handleFilterChange('mediaType', 'all')}
                  className={`flex-1 px-4 py-2.5 md:px-5 md:py-2 rounded transition-colors text-sm md:text-base whitespace-nowrap ${
                    filters.mediaType === 'all'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('mediaType', 'movie')}
                  className={`flex-1 px-4 py-2.5 md:px-5 md:py-2 rounded transition-colors text-sm md:text-base whitespace-nowrap ${
                    filters.mediaType === 'movie'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  Movies
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('mediaType', 'tv')}
                  className={`flex-1 px-4 py-2.5 md:px-5 md:py-2 rounded transition-colors text-sm md:text-base whitespace-nowrap ${
                    filters.mediaType === 'tv'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  TV Shows
                </button>
              </div>
            </div>

            {/* Genres - Dropdown Button */}
            <div className="relative md:col-span-1 lg:col-span-2">
              <label className="block text-white mb-2 text-xs md:text-sm font-semibold">Genres</label>
              <button
                type="button"
                onClick={() => {
                  setShowGenreDropdown(!showGenreDropdown);
                  setShowYearDropdown(false);
                  setShowRatingDropdown(false);
                }}
                className={`w-full px-3 py-2.5 md:px-4 md:py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors flex items-center justify-between text-sm md:text-base h-[42px] ${
                  filters.genres.length > 0 ? 'ring-2 ring-red-600' : ''
                }`}
              >
                <span className="truncate">
                  {filters.genres.length === 0
                    ? 'Select Genres'
                    : filters.genres.length === 1
                    ? availableGenres.find(g => g.id === filters.genres[0])?.name || '1 Selected'
                    : `${filters.genres.length} Selected`}
                </span>
                <i className={`fas fa-chevron-${showGenreDropdown ? 'up' : 'down'} ml-2 flex-shrink-0`}></i>
              </button>
            </div>

            {/* Year - Dropdown */}
            <div className="relative md:col-span-1 lg:col-span-2">
              <label className="block text-white mb-2 text-xs md:text-sm font-semibold">Year</label>
              <button
                type="button"
                onClick={() => {
                  setShowYearDropdown(!showYearDropdown);
                  setShowGenreDropdown(false);
                  setShowRatingDropdown(false);
                }}
                className={`w-full px-3 py-2.5 md:px-4 md:py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors flex items-center justify-between text-sm md:text-base h-[42px] ${
                  filters.startYear || filters.endYear ? 'ring-2 ring-red-600' : ''
                }`}
              >
                <span className="truncate">
                  {filters.startYear && filters.endYear && filters.startYear === filters.endYear
                    ? filters.startYear
                    : filters.startYear && filters.endYear
                    ? `${filters.startYear}-${filters.endYear}`
                    : filters.startYear
                    ? `${filters.startYear}+`
                    : filters.endYear
                    ? `-${filters.endYear}`
                    : 'Any Year'}
                </span>
                <i className={`fas fa-chevron-${showYearDropdown ? 'up' : 'down'} ml-2 flex-shrink-0`}></i>
              </button>
            </div>

            {/* Rating - Dropdown Button */}
            <div className="relative md:col-span-1 lg:col-span-2">
              <label className="block text-white mb-2 text-xs md:text-sm font-semibold">Min Rating</label>
              <button
                type="button"
                onClick={() => {
                  setShowRatingDropdown(!showRatingDropdown);
                  setShowGenreDropdown(false);
                  setShowYearDropdown(false);
                }}
                className={`w-full px-3 py-2.5 md:px-4 md:py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors flex items-center justify-between text-sm md:text-base h-[42px] ${
                  filters.minRating ? 'ring-2 ring-red-600' : ''
                }`}
              >
                <span className="truncate">{filters.minRating ? `${filters.minRating}+` : 'Any Rating'}</span>
                <i className={`fas fa-chevron-${showRatingDropdown ? 'up' : 'down'} ml-2 flex-shrink-0`}></i>
              </button>
            </div>

            {/* Sort By - Dropdown on the Right */}
            <div className="md:col-span-1 lg:col-span-3">
              <label className="block text-white mb-2 text-xs md:text-sm font-semibold">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="w-full px-3 py-2.5 md:px-4 md:py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 text-sm md:text-base h-[42px]"
              >
                <option value="popularity.desc">Popularity (Default)</option>
                <option value="rating.desc">Rating (Highest)</option>
                <option value="rating.asc">Rating (Lowest)</option>
                <option value="year.desc">Year (Newest)</option>
                <option value="year.asc">Year (Oldest)</option>
                <option value="title.asc">Title (A-Z)</option>
                <option value="title.desc">Title (Z-A)</option>
              </select>
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div className="mt-3 md:mt-4">
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 md:py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors text-sm md:text-base"
              >
                <i className="fas fa-times mr-2"></i>
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Genre Mega Menu - Full Width Below Filters */}
      {showGenreDropdown && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={() => setShowGenreDropdown(false)}
          ></div>
          <div className="max-w-6xl mx-auto mb-6 relative z-50">
            <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
              <div className="p-4 md:p-6 border-b border-gray-700 flex justify-between items-center">
                <span className="text-white font-semibold text-base md:text-lg">Select Genres</span>
                <div className="flex items-center gap-3">
                  {filters.genres.length > 0 && (
                    <>
                      <span className="text-gray-400 text-sm">
                        {filters.genres.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={() => handleFilterChange('genres', [])}
                        className="text-red-400 text-sm hover:text-red-300 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
                      >
                        Clear All
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowGenreDropdown(false)}
                    className="text-gray-400 hover:text-white transition-colors p-2"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>
              </div>
              <div className="p-4 md:p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
                  {availableGenres.map(genre => {
                    const isSelected = filters.genres.includes(genre.id);
                    return (
                      <button
                        key={genre.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            handleFilterChange('genres', filters.genres.filter(id => id !== genre.id));
                          } else {
                            handleFilterChange('genres', [...filters.genres, genre.id]);
                          }
                        }}
                        className={`px-3 py-2.5 md:px-4 md:py-3 rounded transition-all text-sm md:text-base font-medium ${
                          isSelected
                            ? 'bg-red-600 text-white ring-2 ring-red-400'
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                      >
                        {genre.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Year Range Mega Menu */}
      {showYearDropdown && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={() => setShowYearDropdown(false)}
          ></div>
          <div className="max-w-6xl mx-auto mb-6 relative z-50">
            <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
              <div className="p-4 md:p-6 border-b border-gray-700 flex justify-between items-center">
                <span className="text-white font-semibold text-base md:text-lg">Select Year Range</span>
                <div className="flex items-center gap-3">
                  {(filters.startYear || filters.endYear) && (
                    <button
                      type="button"
                      onClick={() => {
                        handleFilterChange('startYear', '');
                        handleFilterChange('endYear', '');
                      }}
                      className="text-red-400 text-sm hover:text-red-300 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowYearDropdown(false)}
                    className="text-gray-400 hover:text-white transition-colors p-2"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>
              </div>
              <div className="p-4 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Start Year */}
                  <div>
                    <label className="block text-white mb-3 text-sm font-semibold">Start Year</label>
                    <input
                      type="number"
                      value={filters.startYear || ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? '' : parseInt(e.target.value);
                        if (value === '' || (!isNaN(value) && value >= 1900 && value <= new Date().getFullYear() + 1)) {
                          handleFilterChange('startYear', value);
                        }
                      }}
                      placeholder="From year (e.g., 2020)"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600 text-base"
                    />
                    <p className="text-gray-400 text-xs mt-2">Leave empty for no start limit</p>
                  </div>
                  
                  {/* End Year */}
                  <div>
                    <label className="block text-white mb-3 text-sm font-semibold">End Year</label>
                    <input
                      type="number"
                      value={filters.endYear || ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? '' : parseInt(e.target.value);
                        if (value === '' || (!isNaN(value) && value >= 1900 && value <= new Date().getFullYear() + 1)) {
                          handleFilterChange('endYear', value);
                        }
                      }}
                      placeholder="To year (e.g., 2023)"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600 text-base"
                    />
                    <p className="text-gray-400 text-xs mt-2">Leave empty for no end limit</p>
                  </div>
                </div>
                <div className="text-center text-gray-400 text-sm">
                  {filters.startYear && filters.endYear && filters.startYear === filters.endYear
                    ? `Selected: ${filters.startYear}`
                    : filters.startYear && filters.endYear
                    ? `Range: ${filters.startYear} - ${filters.endYear}`
                    : filters.startYear
                    ? `From: ${filters.startYear}`
                    : filters.endYear
                    ? `Until: ${filters.endYear}`
                    : 'Enter start and/or end year'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rating Mega Menu */}
      {showRatingDropdown && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={() => setShowRatingDropdown(false)}
          ></div>
          <div className="max-w-6xl mx-auto mb-6 relative z-50">
            <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
              <div className="p-4 md:p-6 border-b border-gray-700 flex justify-between items-center">
                <span className="text-white font-semibold text-base md:text-lg">Select Minimum Rating</span>
                <div className="flex items-center gap-3">
                  {filters.minRating !== '' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleFilterChange('minRating', '');
                      }}
                      className="text-red-400 text-sm hover:text-red-300 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowRatingDropdown(false)}
                    className="text-gray-400 hover:text-white transition-colors p-2"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>
              </div>
              <div className="p-4 md:p-6">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-11 gap-2 md:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      handleFilterChange('minRating', '');
                    }}
                    className={`px-4 py-3 md:px-6 md:py-4 rounded transition-all text-sm md:text-base font-medium ${
                      filters.minRating === ''
                        ? 'bg-red-600 text-white ring-2 ring-red-400'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    Any
                  </button>
                  {[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(rating => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => {
                        handleFilterChange('minRating', rating);
                      }}
                      className={`px-4 py-3 md:px-6 md:py-4 rounded transition-all text-sm md:text-base font-medium ${
                        filters.minRating === rating
                          ? 'bg-red-600 text-white ring-2 ring-red-400'
                          : 'bg-gray-700 text-white hover:bg-gray-600'
                      }`}
                    >
                      {rating}+
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Results */}
      {!isLoading && hasSearched && (
        <div className="max-w-6xl mx-auto">
          {filteredResults.length > 0 ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-6">
                {searchMode === 'discover' ? 'Discover Results' : 'Search Results'} ({filteredResults.length}
                {searchMode === 'search' && hasActiveFilters && allResults.length !== filteredResults.length && 
                  ` of ${allResults.length}`})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredResults.map((item) => {
                  const title = getTitle(item);
                  const year = getDate(item);
                  const posterUrl = item.poster_path 
                    ? getImageUrl(item.poster_path, 'w500')
                    : '/images/placeholder-poster.jpg';

                  return (
                    <a
                      key={`${item.media_type}-${item.id}`}
                      href={createUrl(`/details?type=${item.media_type}&id=${item.id}`)}
                      className="group block"
                    >
                      <div className="bg-gray-800 rounded-lg overflow-hidden transition-transform duration-300 group-hover:scale-105 group-hover:shadow-xl">
                        <div className="relative">
                          <img
                            src={posterUrl}
                            alt={title}
                            className="w-full aspect-[2/3] object-cover"
                          />
                          <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-yellow-400 px-2 py-1 rounded text-sm font-semibold">
                            {item.vote_average.toFixed(1)}
                          </div>
                          <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold uppercase">
                            {item.media_type}
                          </div>
                        </div>
                        
                        <div className="p-4">
                          <h3 className="font-semibold text-white mb-2 line-clamp-2" title={title}>
                            {title}
                          </h3>
                          <p className="text-gray-400 text-sm mb-2">
                            {year && `${year} • `}{item.media_type === 'tv' ? 'TV Show' : 'Movie'}
                          </p>
                          {item.overview && (
                            <p className="text-gray-300 text-sm line-clamp-3">
                              {item.overview}
                            </p>
                          )}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-search text-4xl text-gray-600 mb-4"></i>
              <h2 className="text-xl font-bold text-white mb-2">
                {allResults.length > 0 ? 'No results match your filters' : 'No results found'}
              </h2>
              <p className="text-gray-400 mb-4">
                {allResults.length > 0 
                  ? 'Try adjusting your filters or clearing them to see all results.'
                  : 'Try searching with different keywords or check your spelling.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!hasSearched && !isLoading && (
        <div className="text-center py-12">
          <i className="fas fa-film text-6xl text-gray-600 mb-6"></i>
          <h2 className="text-2xl font-bold text-white mb-4">Discover Movies & TV Shows</h2>
          <p className="text-gray-400 text-lg mb-4">
            Search by name or use filters above to discover content that matches your preferences.
          </p>
          {hasActiveFilters && (
            <p className="text-blue-400 text-sm">
              <i className="fas fa-info-circle mr-2"></i>
              You have active filters. Click "Discover" to browse content matching your criteria.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
