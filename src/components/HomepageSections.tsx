import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, type HomepageSection, type CustomSection } from '../lib/supabase';
import { fetchFromTMDB, tmdbEndpoints, getImageUrl, discoverWithFilters } from '../lib/tmdb';
import { createUrl } from '../lib/utils';

interface Section {
  id: string;
  title: string;
  movies: any[];
  mediaType: 'movie' | 'tv';
  section_key: string;
  section_type: 'builtin' | 'custom';
}

export default function HomepageSections() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroMovie, setHeroMovie] = useState<any>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  useEffect(() => {
    console.log('HomepageSections: Component mounted, starting loadSections');
    let mounted = true;
    
    const load = async () => {
      try {
        await loadSections();
      } catch (error) {
        console.error('HomepageSections: Error in loadSections:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };
    
    load();
    
    return () => {
      mounted = false;
    };
  }, []);

  const loadSections = async () => {
    console.log('loadSections: Starting...');
    setHasAttemptedLoad(true);
    setLoading(true);
    
    try {
      console.log('loadSections: Checking Supabase config...', isSupabaseConfigured());
      if (!isSupabaseConfigured()) {
        // Fallback to default sections if Supabase not configured
        console.log('loadSections: Supabase not configured, loading defaults');
        await loadDefaultSections();
        return;
      }
      // Load homepage sections from database - filter by visibility on homepage
      const { data: homepageSections, error: sectionsError } = await supabase!
        .from('homepage_sections')
        .select('*')
        .eq('enabled', true)
        .order('order_index', { ascending: true });

      if (sectionsError) {
        console.error('Error loading homepage sections:', sectionsError);
        console.log('Falling back to default sections');
        await loadDefaultSections();
        return;
      }

      if (!homepageSections || homepageSections.length === 0) {
        console.log('No homepage sections found in database, loading defaults');
        await loadDefaultSections();
        return;
      }

      // Filter sections by homepage visibility and sort by page_order
      const visibleSections = homepageSections.filter(section => {
        const config = section.config || { visible_on: ['homepage'] };
        return (config.visible_on || ['homepage']).includes('homepage');
      }).sort((a, b) => {
        const aOrder = (a.config?.page_order || {})['homepage'] ?? a.order_index;
        const bOrder = (b.config?.page_order || {})['homepage'] ?? b.order_index;
        return aOrder - bOrder;
      });

      // Load data for each section
      const loadedSections: Section[] = [];

      for (const section of visibleSections) {
        if (section.section_type === 'builtin') {
          // Check if section has TMDB filters
          if (section.config?.tmdb_filters && section.config.tmdb_filters.media_type) {
            // Load with TMDB filters
            const movies = await discoverWithFilters(
              section.config.tmdb_filters.media_type,
              section.config.tmdb_filters,
              12
            );
            if (movies && movies.length > 0) {
              loadedSections.push({
                id: section.id,
                title: section.title,
                movies: movies,
                mediaType: section.config.tmdb_filters.media_type,
                section_key: section.section_key,
                section_type: 'builtin',
              });
            }
          } else {
            // Load builtin section data from TMDB using default method
            const movies = await loadBuiltinSection(section.section_key);
            if (movies && movies.length > 0) {
              loadedSections.push({
                id: section.id,
                title: section.title,
                movies: movies,
                mediaType: getMediaTypeForSection(section.section_key),
                section_key: section.section_key,
                section_type: 'builtin',
              });
            }
          }
        } else if (section.section_type === 'custom' && section.custom_section_id) {
          // Check if custom section has TMDB filters for auto-generation
          if (section.config?.tmdb_filters && section.config.tmdb_filters.media_type) {
            // Auto-generated category - fetch from TMDB
            const movies = await discoverWithFilters(
              section.config.tmdb_filters.media_type,
              section.config.tmdb_filters,
              12
            );
            if (movies && movies.length > 0) {
              loadedSections.push({
                id: section.id,
                title: section.title,
                movies: movies,
                mediaType: section.config.tmdb_filters.media_type,
                section_key: section.section_key,
                section_type: 'custom',
              });
            }
          } else {
            // Manual custom section - load from custom_sections
            const { data: customSection, error: customError } = await supabase!
              .from('custom_sections')
              .select('*')
              .eq('id', section.custom_section_id)
              .eq('enabled', true)
              .single();

            if (!customError && customSection && Array.isArray(customSection.movies)) {
              if (customSection.movies.length > 0) {
                loadedSections.push({
                  id: customSection.id,
                  title: customSection.title,
                  movies: customSection.movies,
                  mediaType: 'movie', // Default, but could be mixed
                  section_key: section.section_key,
                  section_type: 'custom',
                });
              } else {
                console.log(`Custom section "${customSection.title}" has no movies yet, skipping from homepage`);
              }
            } else if (customError) {
              console.error('Error loading custom section:', customError);
            }
          }
        }
      }

      setSections(loadedSections);

      // Set hero movie from first section
      if (loadedSections.length > 0 && loadedSections[0].movies.length > 0) {
        setHeroMovie(loadedSections[0].movies[0]);
      }

      // Hide server-rendered content when dynamic content is ready
      setTimeout(() => {
        const fallbackHero = document.getElementById('fallback-hero');
        const serverSections = document.getElementById('server-rendered-sections');
        if (fallbackHero && loadedSections.length > 0) {
          fallbackHero.style.display = 'none';
        }
        if (serverSections && loadedSections.length > 0) {
          serverSections.style.display = 'none';
        }
      }, 500);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading sections, falling back to defaults:', error);
      await loadDefaultSections();
    }
  };

  const loadBuiltinSection = async (sectionKey: string): Promise<any[]> => {
    try {
      let endpoint = '';
      switch (sectionKey) {
        case 'trending':
          endpoint = tmdbEndpoints.trending;
          break;
        case 'popular-movies':
          endpoint = tmdbEndpoints.popularMovies;
          break;
        case 'top-rated':
          endpoint = tmdbEndpoints.topRatedMovies;
          break;
        case 'popular-tv':
          endpoint = tmdbEndpoints.popularTv;
          break;
        case 'upcoming':
          endpoint = tmdbEndpoints.upcomingMovies;
          break;
        default:
          return [];
      }

      const data = await fetchFromTMDB(endpoint);
      return (data.results || []).slice(0, 12);
    } catch (error) {
      console.error(`Error loading ${sectionKey}:`, error);
      return [];
    }
  };

  const getMediaTypeForSection = (sectionKey: string): 'movie' | 'tv' => {
    return sectionKey === 'popular-tv' ? 'tv' : 'movie';
  };

  const loadDefaultSections = async () => {
    setLoading(true);
    try {
      console.log('Loading default sections from TMDB...');
      console.log('TMDB API Key configured:', !!import.meta.env.PUBLIC_TMDB_API_KEY);
      
      const [trendingData, popularMoviesData, topRatedData, popularTvData, upcomingData] = await Promise.allSettled([
        fetchFromTMDB(tmdbEndpoints.trending),
        fetchFromTMDB(tmdbEndpoints.popularMovies),
        fetchFromTMDB(tmdbEndpoints.topRatedMovies),
        fetchFromTMDB(tmdbEndpoints.popularTv),
        fetchFromTMDB(tmdbEndpoints.upcomingMovies),
      ]);
      
      // Extract results from Promise.allSettled
      const getResults = (result: PromiseSettledResult<any>, sectionName: string) => {
        if (result.status === 'fulfilled') {
          console.log(`${sectionName}: Success`, result.value?.results?.length || 0, 'items');
          return result.value?.results || [];
        } else {
          console.error(`Error fetching ${sectionName}:`, result.reason);
          return [];
        }
      };
      
      const trendingResults = getResults(trendingData, 'Trending');
      const popularMoviesResults = getResults(popularMoviesData, 'Popular Movies');
      const topRatedResults = getResults(topRatedData, 'Top Rated');
      const popularTvResults = getResults(popularTvData, 'Popular TV');
      const upcomingResults = getResults(upcomingData, 'Upcoming');

      const defaultSections: Section[] = [
        {
          id: 'trending',
          title: 'Trending Now',
          movies: trendingResults.slice(0, 12),
          mediaType: 'movie',
          section_key: 'trending',
          section_type: 'builtin',
        },
        {
          id: 'popular-movies',
          title: 'Popular Movies',
          movies: popularMoviesResults.slice(0, 12),
          mediaType: 'movie',
          section_key: 'popular-movies',
          section_type: 'builtin',
        },
        {
          id: 'top-rated',
          title: 'Top Rated Movies',
          movies: topRatedResults.slice(0, 12),
          mediaType: 'movie',
          section_key: 'top-rated',
          section_type: 'builtin',
        },
        {
          id: 'popular-tv',
          title: 'Popular TV Shows',
          movies: popularTvResults.slice(0, 12),
          mediaType: 'tv',
          section_key: 'popular-tv',
          section_type: 'builtin',
        },
        {
          id: 'upcoming',
          title: 'Upcoming Movies',
          movies: upcomingResults.slice(0, 12),
          mediaType: 'movie',
          section_key: 'upcoming',
          section_type: 'builtin',
        },
      ].filter(section => section.movies.length > 0);
      
      console.log('Sections with content:', defaultSections.length, 'out of 5');
      
      if (defaultSections.length === 0) {
        console.error('All TMDB API calls failed or returned no data. Check your TMDB API key and network connection.');
        // Still set loading to false so error state shows
        setLoading(false);
        return;
      }

      setSections(defaultSections);

      // Set hero movie
      if (defaultSections.length > 0 && defaultSections[0].movies.length > 0) {
        setHeroMovie(defaultSections[0].movies[0]);
      }

      // Hide server-rendered content when dynamic content is ready
      setTimeout(() => {
        const fallbackHero = document.getElementById('fallback-hero');
        const serverSections = document.getElementById('server-rendered-sections');
        if (fallbackHero && loadedSections.length > 0) {
          fallbackHero.style.display = 'none';
        }
        if (serverSections && loadedSections.length > 0) {
          serverSections.style.display = 'none';
        }
      }, 500);
      
      console.log('Default sections loaded:', defaultSections.length);
    } catch (error) {
      console.error('Error loading default sections:', error);
      // Even on error, set loading to false so we can show error state
    } finally {
      setLoading(false);
    }
  };

  // Don't show blocking spinner - let server-rendered content show through
  // Only render content once we have sections or heroMovie, or if loading is complete
  if (!hasAttemptedLoad || (loading && sections.length === 0 && !heroMovie)) {
    // Still loading - return null so server-rendered content shows
    return null;
  }
  
  // Check if server-rendered content exists (fallback)
  const hasServerContent = typeof document !== 'undefined' && 
    (document.getElementById('server-rendered-sections') !== null);
  
  // If we have sections, hide server-rendered content
  if (sections.length > 0) {
    setTimeout(() => {
      const serverSections = document.getElementById('server-rendered-sections');
      const fallbackHero = document.getElementById('fallback-hero');
      if (serverSections) {
        serverSections.style.display = 'none';
      }
      if (fallbackHero && heroMovie) {
        fallbackHero.style.display = 'none';
      }
    }, 100);
  }

  // Only show error if:
  // 1. We've attempted to load
  // 2. Loading is complete
  // 3. We have no sections or hero
  // 4. AND there's no server-rendered fallback content
  if (!loading && sections.length === 0 && !heroMovie && hasAttemptedLoad && !hasServerContent) {
    const hasApiKey = !!import.meta.env.PUBLIC_TMDB_API_KEY;
    
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-6xl text-yellow-500 mb-6"></i>
          <h2 className="text-2xl font-bold text-white mb-4">No Content Available</h2>
          <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
            Unable to load homepage content.
            {!hasApiKey && (
              <>
                <br />
                <strong className="text-red-500">TMDB API key is not configured.</strong>
                <br />
                Please set PUBLIC_TMDB_API_KEY in your environment variables.
              </>
            )}
            {hasApiKey && (
              <>
                <br />
                Please check your network connection and TMDB API configuration.
                <br />
                Open browser console (F12) for more details.
              </>
            )}
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="btn-primary"
            >
              Refresh Page
            </button>
            <button
              onClick={() => {
                console.log('TMDB API Key configured:', hasApiKey);
                console.log('TMDB Base URL:', import.meta.env.PUBLIC_TMDB_BASE_URL);
                loadSections();
              }}
              className="btn-secondary"
            >
              Retry Loading
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Hero Section */}
      {heroMovie && (
        <section className="relative h-[70vh] flex items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url('https://image.tmdb.org/t/p/original${heroMovie.backdrop_path || heroMovie.poster_path}')`,
            }}
          ></div>
          <div className="absolute inset-0 bg-black bg-opacity-50"></div>

          <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-shadow">
              {heroMovie.title || heroMovie.name}
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-shadow max-w-2xl mx-auto">
              {heroMovie.overview?.slice(0, 200)}...
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={createUrl(`/details?type=${heroMovie.media_type || 'movie'}&id=${heroMovie.id}`)}
                className="btn-primary text-lg px-8 py-3"
              >
                <i className="fas fa-play mr-2"></i>
                Watch Now
              </a>
              <a
                href={createUrl(`/details?type=${heroMovie.media_type || 'movie'}&id=${heroMovie.id}`)}
                className="btn-secondary text-lg px-8 py-3"
              >
                <i className="fas fa-info-circle mr-2"></i>
                More Info
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Content Sections */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {sections.map((section) => (
          <section key={section.id}>
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-white">
              {section.title}
            </h2>

            <div className="content-grid">
              {section.movies.map((movie: any) => {
                const mediaType = movie.media_type || section.mediaType;
                const movieId = movie.id;
                const title = movie.title || movie.name;

                return (
                  <a
                    key={`${movieId}-${mediaType}`}
                    href={createUrl(`/details?type=${mediaType}&id=${movieId}`)}
                    className="movie-card group"
                  >
                    {movie.poster_path ? (
                      <img
                        src={getImageUrl(movie.poster_path, 'w500')}
                        alt={title}
                        className="w-full aspect-[2/3] object-cover rounded-lg mb-2 group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-gray-800 rounded-lg mb-2 flex items-center justify-center">
                        <i className="fas fa-image text-gray-600 text-4xl"></i>
                      </div>
                    )}
                    <h3 className="text-white font-semibold text-sm truncate group-hover:text-red-600 transition-colors">
                      {title}
                    </h3>
                    {movie.release_date && (
                      <p className="text-gray-400 text-xs">
                        {new Date(movie.release_date || movie.first_air_date).getFullYear()}
                      </p>
                    )}
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}

