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

export default function TvShowsPageSections() {
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

      // Load sections visible on tv-shows page
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

      // Filter by visibility on tv-shows page and sort
      const visibleSections = homepageSections.filter(section => {
        const config = section.config || { visible_on: ['homepage'] };
        return (config.visible_on || []).includes('tv-shows');
      }).sort((a, b) => {
        const aOrder = (a.config?.page_order || {})['tv-shows'] ?? a.order_index;
        const bOrder = (b.config?.page_order || {})['tv-shows'] ?? b.order_index;
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
            // Default builtin sections (filter to TV-only sections for TV page)
            if (section.section_key === 'popular-tv') {
              const movies = await loadBuiltinSection(section.section_key);
              if (movies && movies.length > 0) {
                loadedSections.push({
                  id: section.id,
                  title: section.title,
                  movies: movies,
                  mediaType: 'tv',
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
                mediaType: 'tv',
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
      if (sectionKey === 'popular-tv') {
        const data = await fetchFromTMDB(tmdbEndpoints.popularTv);
        return (data.results || []).slice(0, 12);
      }
      return [];
    } catch (error) {
      console.error(`Error loading ${sectionKey}:`, error);
      return [];
    }
  };

  const loadDefaultSections = async () => {
    try {
      const popularTvData = await fetchFromTMDB(tmdbEndpoints.popularTv).catch(() => ({ results: [] }));

      const defaultSections: Section[] = [];

      if (popularTvData.results) {
        defaultSections.push({
          id: 'popular-tv',
          title: 'Popular TV Shows',
          movies: popularTvData.results.slice(0, 12),
          mediaType: 'tv',
          section_key: 'popular-tv',
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

