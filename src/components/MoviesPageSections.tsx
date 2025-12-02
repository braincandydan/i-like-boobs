import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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

export default function MoviesPageSections() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    setHasAttemptedLoad(true);
    setLoading(true);
    
    try {
      if (!isSupabaseConfigured()) {
        await loadDefaultSections();
        return;
      }

      // Load sections visible on movies page
      const { data: homepageSections, error: sectionsError } = await supabase!
        .from('homepage_sections')
        .select('*')
        .eq('enabled', true);

      if (sectionsError) {
        console.error('Error loading homepage sections:', sectionsError);
        await loadDefaultSections();
        return;
      }

      if (!homepageSections || homepageSections.length === 0) {
        await loadDefaultSections();
        return;
      }

      // Filter by visibility on movies page and sort
      const visibleSections = homepageSections.filter(section => {
        const config = section.config || { visible_on: ['homepage'] };
        return (config.visible_on || []).includes('movies');
      }).sort((a, b) => {
        const aOrder = (a.config?.page_order || {})['movies'] ?? a.order_index;
        const bOrder = (b.config?.page_order || {})['movies'] ?? b.order_index;
        return aOrder - bOrder;
      });

      const loadedSections: Section[] = [];

      for (const section of visibleSections) {
        if (section.section_type === 'builtin') {
          // Load builtin section
          if (section.config?.tmdb_filters && section.config.tmdb_filters.media_type) {
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
            // Default builtin sections (filter to movie-only sections for movies page)
            if (section.section_key === 'popular-movies' || section.section_key === 'top-rated' || section.section_key === 'upcoming') {
              const movies = await loadBuiltinSection(section.section_key);
              if (movies && movies.length > 0) {
                loadedSections.push({
                  id: section.id,
                  title: section.title,
                  movies: movies,
                  mediaType: 'movie',
                  section_key: section.section_key,
                  section_type: 'builtin',
                });
              }
            }
          }
        } else if (section.section_type === 'custom' && section.custom_section_id) {
          // Load custom section
          if (section.config?.tmdb_filters && section.config.tmdb_filters.media_type) {
            // Auto-generated - fetch from TMDB
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
            // Manual custom section
            const { data: customSection, error: customError } = await supabase!
              .from('custom_sections')
              .select('*')
              .eq('id', section.custom_section_id)
              .eq('enabled', true)
              .single();

            if (!customError && customSection && Array.isArray(customSection.movies) && customSection.movies.length > 0) {
              loadedSections.push({
                id: customSection.id,
                title: customSection.title,
                movies: customSection.movies,
                mediaType: 'movie',
                section_key: section.section_key,
                section_type: 'custom',
              });
            }
          }
        }
      }

      setSections(loadedSections);
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
        case 'popular-movies':
          endpoint = tmdbEndpoints.popularMovies;
          break;
        case 'top-rated':
          endpoint = tmdbEndpoints.topRatedMovies;
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

  const loadDefaultSections = async () => {
    try {
      const [popularData, topRatedData, upcomingData] = await Promise.allSettled([
        fetchFromTMDB(tmdbEndpoints.popularMovies),
        fetchFromTMDB(tmdbEndpoints.topRatedMovies),
        fetchFromTMDB(tmdbEndpoints.upcomingMovies),
      ]);

      const defaultSections: Section[] = [];

      if (popularData.status === 'fulfilled' && popularData.value.results) {
        defaultSections.push({
          id: 'popular-movies',
          title: 'Popular Movies',
          movies: popularData.value.results.slice(0, 12),
          mediaType: 'movie',
          section_key: 'popular-movies',
          section_type: 'builtin',
        });
      }

      if (topRatedData.status === 'fulfilled' && topRatedData.value.results) {
        defaultSections.push({
          id: 'top-rated',
          title: 'Top Rated Movies',
          movies: topRatedData.value.results.slice(0, 12),
          mediaType: 'movie',
          section_key: 'top-rated',
          section_type: 'builtin',
        });
      }

      if (upcomingData.status === 'fulfilled' && upcomingData.value.results) {
        defaultSections.push({
          id: 'upcoming',
          title: 'Upcoming Movies',
          movies: upcomingData.value.results.slice(0, 12),
          mediaType: 'movie',
          section_key: 'upcoming',
          section_type: 'builtin',
        });
      }

      setSections(defaultSections);
    } catch (error) {
      console.error('Error loading default sections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sections.length > 0 && !loading) {
      // Hide server-rendered content when dynamic content loads
      setTimeout(() => {
        const serverSections = document.getElementById('server-rendered-sections');
        if (serverSections) {
          serverSections.style.display = 'none';
        }
      }, 100);
    }
  }, [sections, loading]);

  if (!hasAttemptedLoad || loading) {
    return null; // Let server-rendered content show
  }

  if (sections.length === 0) {
    return null; // Fallback to server content
  }

  return (
    <div className="space-y-12">
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
    </div>
  );
}

