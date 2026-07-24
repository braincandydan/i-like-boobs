import { useState, useEffect } from 'react';
import { getNetworkDetails, discoverWithFilters, getImageUrl } from '../lib/tmdb';
import { createUrl } from '../lib/utils';

const SHOW_LIMIT = 24;

export default function NetworkHub() {
  const [network, setNetwork] = useState<any>(null);
  const [shows, setShows] = useState<any[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
        const [networkData, discoverResult] = await Promise.all([
          getNetworkDetails(Number(id)),
          discoverWithFilters('tv', { with_networks: id, sort_by: 'popularity.desc' }).catch(() => ({
            results: [],
            total_pages: 0,
            total_results: 0,
          })),
        ]);

        if (!mounted) return;

        if (!networkData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setNetwork(networkData);
        setShows(discoverResult.results || []);
        setTotalResults(discoverResult.total_results || 0);
        document.title = `${networkData.name} - NotFlix`;
        setLoading(false);
      } catch (error) {
        console.error('Error loading network hub:', error);
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
          <p className="text-white text-xl">Loading network...</p>
        </div>
      </div>
    );
  }

  if (notFound || !network) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-6xl text-red-600 mb-6"></i>
          <h1 className="text-3xl font-bold text-white mb-4">Network Not Found</h1>
          <p className="text-gray-400 mb-8">
            The requested network could not be found.
          </p>
          <a href={createUrl('/')} className="btn-primary">
            <i className="fas fa-home mr-2"></i>
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  const extraCount = Math.max(0, totalResults - shows.length);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <section className="mb-12 flex flex-col md:flex-row items-start md:items-center gap-6">
        {network.logo_path && (
          <div className="bg-white rounded-lg p-4 inline-block flex-shrink-0">
            <img
              src={getImageUrl(network.logo_path, 'w300')}
              alt={network.name}
              className="max-h-20 max-w-[200px] object-contain"
            />
          </div>
        )}
        <div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">{network.name}</h1>
          {network.headquarters && (
            <p className="text-gray-400 text-lg">{network.headquarters}</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-bold text-white mb-6">TV Shows</h2>

        {shows.length === 0 ? (
          <p className="text-gray-400">No shows found for this network yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {shows.slice(0, SHOW_LIMIT).map((show: any) => (
                <a
                  key={show.id}
                  href={createUrl(`/details?type=tv&id=${show.id}`)}
                  className="block group"
                >
                  {show.poster_path ? (
                    <img
                      src={getImageUrl(show.poster_path, 'w500')}
                      alt={show.name}
                      className="w-full aspect-[2/3] object-cover rounded-lg mb-2 group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-gray-800 rounded-lg mb-2 flex items-center justify-center">
                      <i className="fas fa-image text-gray-600 text-4xl"></i>
                    </div>
                  )}
                  <h3 className="text-white font-semibold text-sm truncate group-hover:text-netflix-red transition-colors">
                    {show.name}
                  </h3>
                  {show.first_air_date && (
                    <p className="text-gray-400 text-xs">
                      {new Date(show.first_air_date).getFullYear()}
                    </p>
                  )}
                </a>
              ))}
            </div>
            {extraCount > 0 && (
              <p className="text-gray-500 text-sm mt-6">+{extraCount} more</p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
