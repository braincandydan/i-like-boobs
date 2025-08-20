import { useState } from 'react';
import { fetchFromTMDB, tmdbEndpoints, getImageUrl } from '../lib/tmdb';

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
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    setIsLoading(true);
    setHasSearched(true);
    
    try {
      const data = await fetchFromTMDB(tmdbEndpoints.search, {
        query: query.trim(),
        include_adult: false
      });
      
      // Filter out person results and only keep movies and TV shows
      const filteredResults = data.results.filter(
        (item: SearchResult) => item.media_type === 'movie' || item.media_type === 'tv'
      );
      
      setResults(filteredResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
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

  return (
    <div className="w-full">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for movies, TV shows..."
            className="w-full px-4 py-3 text-lg bg-gray-800 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent pr-16"
          />
          <button 
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-2 top-2 bottom-2 px-6 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <i className="fas fa-search"></i>
            )}
          </button>
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

      {/* Results */}
      {!isLoading && hasSearched && (
        <div className="max-w-6xl mx-auto">
          {results.length > 0 ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-6">
                Search Results ({results.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {results.map((item) => {
                  const title = getTitle(item);
                  const year = getDate(item);
                  const posterUrl = item.poster_path 
                    ? getImageUrl(item.poster_path, 'w500')
                    : '/images/placeholder-poster.jpg';

                  return (
                    <a
                      key={`${item.media_type}-${item.id}`}
                      href={createUrl(`/details/${item.media_type}/${item.id}`)}
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
              <h2 className="text-xl font-bold text-white mb-2">No results found</h2>
              <p className="text-gray-400">
                Try searching with different keywords or check your spelling.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!hasSearched && !isLoading && (
        <div className="text-center py-12">
          <i className="fas fa-film text-6xl text-gray-600 mb-6"></i>
          <h2 className="text-2xl font-bold text-white mb-4">Discover Movies & TV Shows</h2>
          <p className="text-gray-400 text-lg">
            Search through thousands of movies and TV shows to find your next favorite.
          </p>
        </div>
      )}
    </div>
  );
}
