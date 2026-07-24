import { useState, useEffect } from 'react';
import { getCompanyDetails, discoverWithFilters, getImageUrl } from '../lib/tmdb';
import { createUrl } from '../lib/utils';

interface DiscoverResult {
  results: any[];
  total_pages: number;
  total_results: number;
}

const MAX_ITEMS = 24;

function TitleGrid({ items, mediaType }: { items: any[]; mediaType: 'movie' | 'tv' }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((item) => {
        const title = item.title || item.name;
        const dateStr = item.release_date || item.first_air_date;
        const year = dateStr ? new Date(dateStr).getFullYear() : null;

        return (
          <a
            key={item.id}
            href={createUrl(`/details?type=${mediaType}&id=${item.id}`)}
            className="group block"
          >
            {item.poster_path ? (
              <img
                src={getImageUrl(item.poster_path, 'w500')}
                alt={title}
                className="w-full aspect-[2/3] object-cover rounded-lg mb-2 group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            ) : (
              <div className="w-full aspect-[2/3] bg-gray-800 rounded-lg mb-2 flex items-center justify-center">
                <i className="fas fa-image text-gray-600 text-4xl"></i>
              </div>
            )}
            <h3 className="text-white font-semibold text-sm truncate group-hover:text-netflix-red transition-colors">
              {title}
            </h3>
            {year && <p className="text-gray-400 text-xs">{year}</p>}
          </a>
        );
      })}
    </div>
  );
}

export default function CompanyHub() {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [movies, setMovies] = useState<DiscoverResult>({ results: [], total_pages: 0, total_results: 0 });
  const [tvShows, setTvShows] = useState<DiscoverResult>({ results: [], total_pages: 0, total_results: 0 });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id || isNaN(Number(id))) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const [companyData, movieResults, tvResults] = await Promise.all([
          getCompanyDetails(Number(id)),
          discoverWithFilters('movie', { with_companies: [id], sort_by: 'popularity.desc' }).catch(() => ({
            results: [],
            total_pages: 0,
            total_results: 0,
          })),
          discoverWithFilters('tv', { with_companies: [id], sort_by: 'popularity.desc' }).catch(() => ({
            results: [],
            total_pages: 0,
            total_results: 0,
          })),
        ]);

        if (!mounted) return;

        if (!companyData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setCompany(companyData);
        setMovies(movieResults);
        setTvShows(tvResults);
        document.title = `${companyData.name} - NotFlix`;
        setLoading(false);
      } catch (error) {
        console.error('Error loading company hub:', error);
        if (mounted) {
          setNotFound(true);
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading company...</p>
        </div>
      </div>
    );
  }

  if (notFound || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-6xl text-red-600 mb-6"></i>
          <h1 className="text-3xl font-bold text-white mb-4">Company Not Found</h1>
          <p className="text-gray-400 mb-8">The requested company could not be found.</p>
          <a href={createUrl('/')} className="btn-primary">
            <i className="fas fa-home mr-2"></i>
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  const description =
    company.description && company.description.length > 500
      ? `${company.description.slice(0, 500)}...`
      : company.description;

  const hasMovies = movies.results.length > 0;
  const hasTv = tvShows.results.length > 0;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-gray-800 rounded-lg p-6 mb-12 flex flex-col md:flex-row gap-6 items-start">
        {company.logo_path && (
          <div className="bg-white rounded-lg p-4 inline-block flex-shrink-0">
            <img
              src={getImageUrl(company.logo_path, 'w300')}
              alt={company.name}
              className="max-h-24 max-w-[200px] object-contain"
            />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{company.name}</h1>
          {company.headquarters && (
            <p className="text-gray-400 mb-4">
              <i className="fas fa-map-marker-alt mr-2"></i>
              {company.headquarters}
            </p>
          )}
          {description && <p className="text-gray-300 leading-relaxed max-w-4xl">{description}</p>}
        </div>
      </div>

      {!hasMovies && !hasTv && (
        <p className="text-gray-400 text-center py-12">No titles found for this company yet.</p>
      )}

      {hasMovies && (
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Movies</h2>
          {movies.total_results > MAX_ITEMS && (
            <p className="text-gray-500 text-sm mb-6">
              Showing {Math.min(MAX_ITEMS, movies.results.length)} of {movies.total_results} (+
              {movies.total_results - Math.min(MAX_ITEMS, movies.results.length)} more)
            </p>
          )}
          {movies.total_results <= MAX_ITEMS && <div className="mb-6"></div>}
          <TitleGrid items={movies.results.slice(0, MAX_ITEMS)} mediaType="movie" />
        </section>
      )}

      {hasTv && (
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">TV Shows</h2>
          {tvShows.total_results > MAX_ITEMS && (
            <p className="text-gray-500 text-sm mb-6">
              Showing {Math.min(MAX_ITEMS, tvShows.results.length)} of {tvShows.total_results} (+
              {tvShows.total_results - Math.min(MAX_ITEMS, tvShows.results.length)} more)
            </p>
          )}
          {tvShows.total_results <= MAX_ITEMS && <div className="mb-6"></div>}
          <TitleGrid items={tvShows.results.slice(0, MAX_ITEMS)} mediaType="tv" />
        </section>
      )}
    </main>
  );
}
