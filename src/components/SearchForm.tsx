import { useState, useEffect } from 'react';
import {
  fetchFromTMDB, tmdbEndpoints, getImageUrl, fetchGenres,
  discoverWithFilters, getAllMovieCertifications, searchActors,
  searchCompanies, fetchWatchProviders,
} from '../lib/tmdb';
import { supabase, isSupabaseConfigured, type TMDBFilters } from '../lib/supabase';
import WatchlistButton from './WatchlistButton';

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

interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

interface Company {
  id: number;
  name: string;
  logo_path?: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function PaginationControls({
  currentPage,
  totalPages,
  totalResults,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const getPages = (): (number | null)[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | null)[] = [1];
    if (currentPage > 3) pages.push(null);
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push(null);
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-gray-500 text-xs">
        Page {currentPage} of {totalPages.toLocaleString()} &middot; {totalResults.toLocaleString()} results
      </p>
      <div className="flex items-center gap-1 flex-wrap justify-center">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded-md disabled:opacity-40 hover:bg-gray-600 transition-colors"
        >
          ← Prev
        </button>
        {getPages().map((p, i) =>
          p === null ? (
            <span key={`el-${i}`} className="px-1 text-gray-500 text-sm select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-9 h-8 text-sm rounded-md transition-colors font-medium ${
                p === currentPage ? 'bg-red-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded-md disabled:opacity-40 hover:bg-gray-600 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// ─── Filter button ────────────────────────────────────────────────────────────

function FilterBtn({
  label, count, active, open, onClick,
}: {
  label: string; count?: number; active: boolean; open: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-2.5 text-xs rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
        active || open
          ? 'bg-gray-700 text-white ring-1 ring-red-500'
          : 'bg-gray-700 text-gray-400 hover:text-white'
      }`}
    >
      {label}
      {count != null && count > 0 && (
        <span className="bg-red-600 text-white w-4 h-4 rounded-full text-xs flex items-center justify-center leading-none font-bold">
          {count}
        </span>
      )}
      <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-xs opacity-60`} />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SearchForm({ basePath = '/' }: SearchFormProps) {
  function createUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
    return `${base}${cleanPath}`;
  }

  const getSectionIdFromUrl = () => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('sectionId') || '';
    }
    return '';
  };

  // ── Core ──
  const [query, setQuery] = useState('');
  const [sectionId] = useState(getSectionIdFromUrl);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMode, setSearchMode] = useState<'search' | 'discover'>('search');

  // ── Pagination ──
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);

  // ── Pre-search filters ──
  const [filters, setFilters] = useState({
    mediaType: 'all' as 'all' | 'movie' | 'tv',
    genres: [] as number[],
    startYear: '' as string | number,
    endYear: '' as string | number,
    minRating: '' as string | number,
    certification: '' as string,
    actors: [] as number[],
    watchProviders: [] as number[],
    companies: [] as number[],
    sortBy: 'popularity.desc' as string,
  });

  // ── Post-search refinement ──
  const [postText, setPostText] = useState('');
  const [postMediaType, setPostMediaType] = useState<'all' | 'movie' | 'tv'>('all');
  const [postMinRating, setPostMinRating] = useState<number | ''>('');
  const [postSortBy, setPostSortBy] = useState('');

  // ── Single active dropdown ──
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // ── Reference data ──
  const [availableGenres, setAvailableGenres] = useState<{ id: number; name: string }[]>([]);
  const [availableCertifications, setAvailableCertifications] = useState<{ certification: string; meaning: string; order: number }[]>([]);
  const [availableProviders, setAvailableProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // ── Actor search ──
  const [actorQuery, setActorQuery] = useState('');
  const [actorResults, setActorResults] = useState<{ id: number; name: string; profile_path?: string; known_for_department?: string }[]>([]);
  const [searchingActors, setSearchingActors] = useState(false);
  const [selectedActors, setSelectedActors] = useState<{ id: number; name: string; profile_path?: string }[]>([]);

  // ── Company search ──
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyResults, setCompanyResults] = useState<Company[]>([]);
  const [searchingCompanies, setSearchingCompanies] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<Company[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<Provider[]>([]);

  // ── Torrent ──
  const [showStreams, setShowStreams] = useState(false);
  const [directTorrentResults, setDirectTorrentResults] = useState<any[]>([]);
  const [loadingDirectTorrents, setLoadingDirectTorrents] = useState(false);

  // ── Helpers ──
  const toggleDropdown = (name: string) =>
    setActiveDropdown(prev => (prev === name ? null : name));

  const getTitle = (item: SearchResult) => item.media_type === 'movie' ? item.title : item.name;

  const getYear = (item: SearchResult) => {
    const d = item.media_type === 'movie' ? item.release_date : item.first_air_date;
    return d ? new Date(d).getFullYear().toString() : '';
  };

  const extractQuality = (title: string) => {
    const m = title.match(/\b(4K|2160p|1080p|720p|480p|360p|HD|SD)\b/i);
    return m ? m[1] : 'Unknown';
  };

  // ── Computed ──
  const hasActiveFilters =
    filters.mediaType !== 'all' ||
    filters.genres.length > 0 ||
    filters.startYear !== '' ||
    filters.endYear !== '' ||
    filters.minRating !== '' ||
    filters.certification !== '' ||
    filters.actors.length > 0 ||
    filters.watchProviders.length > 0 ||
    filters.companies.length > 0 ||
    (filters.sortBy !== 'relevance' && filters.sortBy !== 'popularity.desc');

  const hasPostFilters =
    postText.trim() !== '' ||
    postMediaType !== 'all' ||
    postMinRating !== '' ||
    postSortBy !== '';

  const displayedResults = (() => {
    let results = [...allResults];
    if (postText.trim()) {
      const t = postText.toLowerCase();
      results = results.filter(item => (item.title || item.name || '').toLowerCase().includes(t));
    }
    if (postMediaType !== 'all') results = results.filter(item => item.media_type === postMediaType);
    if (postMinRating !== '') {
      const min = typeof postMinRating === 'string' ? parseFloat(postMinRating as string) : postMinRating;
      if (!isNaN(min as number)) results = results.filter(item => item.vote_average >= (min as number));
    }
    const sortBy = postSortBy || filters.sortBy;
    if (sortBy && sortBy !== 'relevance') {
      results = [...results].sort((a, b) => {
        switch (sortBy) {
          case 'popularity.desc': return ((b as any).popularity || 0) - ((a as any).popularity || 0);
          case 'popularity.asc': return ((a as any).popularity || 0) - ((b as any).popularity || 0);
          case 'rating.desc': case 'vote_average.desc': return b.vote_average - a.vote_average;
          case 'rating.asc': case 'vote_average.asc': return a.vote_average - b.vote_average;
          case 'year.desc': case 'release_date.desc': case 'first_air_date.desc': {
            const ad = a.media_type === 'movie' ? a.release_date : a.first_air_date;
            const bd = b.media_type === 'movie' ? b.release_date : b.first_air_date;
            if (!ad) return 1; if (!bd) return -1;
            return new Date(bd).getTime() - new Date(ad).getTime();
          }
          case 'year.asc': case 'release_date.asc': case 'first_air_date.asc': {
            const ad = a.media_type === 'movie' ? a.release_date : a.first_air_date;
            const bd = b.media_type === 'movie' ? b.release_date : b.first_air_date;
            if (!ad) return 1; if (!bd) return -1;
            return new Date(ad).getTime() - new Date(bd).getTime();
          }
          case 'title.asc': case 'original_title.asc': case 'name.asc':
            return (a.title || a.name || '').localeCompare(b.title || b.name || '');
          case 'title.desc': case 'original_title.desc': case 'name.desc':
            return (b.title || b.name || '').localeCompare(a.title || a.name || '');
          default: return 0;
        }
      });
    }
    return results;
  })();

  // ── Build TMDB filters ──
  const buildTMDBFilters = (mediaType: 'movie' | 'tv'): TMDBFilters => {
    const f: TMDBFilters = {};
    if (filters.genres.length > 0) f.with_genres = filters.genres;

    if (filters.startYear || filters.endYear) {
      const sy = filters.startYear ? (typeof filters.startYear === 'string' ? parseInt(filters.startYear) : filters.startYear as number) : undefined;
      const ey = filters.endYear ? (typeof filters.endYear === 'string' ? parseInt(filters.endYear) : filters.endYear as number) : undefined;
      if (sy && ey && sy === ey) {
        if (mediaType === 'movie') f.primary_release_year = sy;
        else f.first_air_date_year = sy;
      } else {
        if (sy && !isNaN(sy)) {
          if (mediaType === 'movie') f['primary_release_date.gte'] = `${sy}-01-01`;
          else f['first_air_date.gte'] = `${sy}-01-01`;
        }
        if (ey && !isNaN(ey)) {
          if (mediaType === 'movie') f['primary_release_date.lte'] = `${ey}-12-31`;
          else f['first_air_date.lte'] = `${ey}-12-31`;
        }
      }
    }

    if (filters.minRating) {
      const r = typeof filters.minRating === 'string' ? parseFloat(filters.minRating) : filters.minRating as number;
      if (!isNaN(r)) f['vote_average.gte'] = r;
    }
    if (filters.certification && mediaType === 'movie') {
      f.certification = filters.certification;
      f.certification_country = 'US';
    }
    if (filters.actors.length > 0) f.with_cast = filters.actors;
    if (filters.companies.length > 0) f.with_companies = filters.companies;
    if (filters.watchProviders.length > 0) {
      f.with_watch_providers = filters.watchProviders;
      f.watch_region = 'US';
    }
    const sortMap: Record<string, string> = {
      'rating.desc': 'vote_average.desc', 'rating.asc': 'vote_average.asc',
      'year.desc': mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
      'year.asc': mediaType === 'movie' ? 'primary_release_date.asc' : 'first_air_date.asc',
      'title.asc': mediaType === 'movie' ? 'original_title.asc' : 'name.asc',
      'title.desc': mediaType === 'movie' ? 'original_title.desc' : 'name.desc',
    };
    f.sort_by = sortMap[filters.sortBy] || filters.sortBy || 'popularity.desc';
    return f;
  };

  // ── Search handlers ──
  const handleSearch = async (e?: React.FormEvent, page = 1) => {
    if (e) e.preventDefault();
    setActiveDropdown(null);

    if (showStreams && query.trim()) {
      setIsLoading(true);
      setHasSearched(true);
      setSearchMode('search');
      try {
        await searchTorrentsDirectly(query.trim(), filters.mediaType === 'tv' ? 'TV' : 'Movies');
      } catch { setDirectTorrentResults([]); }
      finally { setIsLoading(false); }
      return;
    }

    if (!query.trim() && !hasActiveFilters) return;
    setIsLoading(true);
    setHasSearched(true);
    setCurrentPage(page);
    if (page === 1) { setPostText(''); setPostMediaType('all'); setPostMinRating(''); setPostSortBy(''); }

    try {
      if (query.trim()) {
        setSearchMode('search');
        const data = await fetchFromTMDB(tmdbEndpoints.search, { query: query.trim(), include_adult: true, page });
        const results = (data.results || []).filter(
          (item: SearchResult) => item.media_type === 'movie' || item.media_type === 'tv'
        );
        setAllResults(results);
        setTotalPages(Math.min(data.total_pages || 0, 500));
        setTotalResults(data.total_results || 0);
      } else {
        await handleDiscover(page);
      }
    } catch (err) {
      console.error('Search error:', err);
      setAllResults([]); setTotalPages(0); setTotalResults(0);
    } finally { setIsLoading(false); }
  };

  const handleDiscover = async (page = 1) => {
    if (!hasActiveFilters) return;
    setIsLoading(true); setHasSearched(true); setSearchMode('discover'); setCurrentPage(page);
    if (page === 1) { setPostText(''); setPostMediaType('all'); setPostMinRating(''); setPostSortBy(''); }

    try {
      const mediaType = filters.mediaType === 'all' ? 'movie' : filters.mediaType;
      const tmdbFilters = buildTMDBFilters(mediaType);
      tmdbFilters.media_type = mediaType;
      const res = await discoverWithFilters(mediaType, tmdbFilters, page);
      let results = res.results.map((item: any) => ({ ...item, media_type: item.media_type || mediaType }));
      let tp = res.total_pages, tr = res.total_results;

      if (filters.mediaType === 'all') {
        const otherType: 'movie' | 'tv' = mediaType === 'movie' ? 'tv' : 'movie';
        const otherFilters = buildTMDBFilters(otherType);
        otherFilters.media_type = otherType;
        const otherRes = await discoverWithFilters(otherType, otherFilters, page);
        const otherResults = otherRes.results.map((item: any) => ({ ...item, media_type: item.media_type || otherType }));
        results = [...results, ...otherResults];
        tp = Math.max(tp, otherRes.total_pages);
        tr = tr + otherRes.total_results;
      }

      setAllResults(results);
      setTotalPages(Math.min(tp, 500));
      setTotalResults(tr);
    } catch (err) {
      console.error('Discover error:', err);
      setAllResults([]); setTotalPages(0); setTotalResults(0);
    } finally { setIsLoading(false); }
  };

  const handlePageChange = async (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (searchMode === 'search' && query.trim()) await handleSearch(undefined, page);
    else await handleDiscover(page);
  };

  // ── Filter helpers ──
  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'mediaType' && value === 'tv') next.certification = '';
      return next;
    });
  };

  const clearFilters = () => {
    setFilters({ mediaType: 'all', genres: [], startYear: '', endYear: '', minRating: '', certification: '', actors: [], watchProviders: [], companies: [], sortBy: 'popularity.desc' });
    setSelectedActors([]); setActorQuery(''); setActorResults([]);
    setSelectedCompanies([]); setCompanyQuery(''); setCompanyResults([]);
    setSelectedProviders([]); setActiveDropdown(null);
  };

  // ── Actor search ──
  const handleActorSearch = async (q: string) => {
    setActorQuery(q);
    if (!q.trim()) { setActorResults([]); return; }
    setSearchingActors(true);
    try { setActorResults(await searchActors(q)); }
    catch { setActorResults([]); }
    finally { setSearchingActors(false); }
  };

  const addActor = (actor: { id: number; name: string; profile_path?: string }) => {
    if (selectedActors.find(a => a.id === actor.id)) return;
    setSelectedActors(prev => [...prev, actor]);
    setFilters(prev => ({ ...prev, actors: [...prev.actors, actor.id] }));
    setActorQuery(''); setActorResults([]);
  };

  const removeActor = (id: number) => {
    setSelectedActors(prev => prev.filter(a => a.id !== id));
    setFilters(prev => ({ ...prev, actors: prev.actors.filter(aid => aid !== id) }));
  };

  // ── Company search ──
  const handleCompanySearch = async (q: string) => {
    setCompanyQuery(q);
    if (!q.trim()) { setCompanyResults([]); return; }
    setSearchingCompanies(true);
    try { setCompanyResults(await searchCompanies(q)); }
    catch { setCompanyResults([]); }
    finally { setSearchingCompanies(false); }
  };

  const addCompany = (company: Company) => {
    if (selectedCompanies.find(c => c.id === company.id)) return;
    setSelectedCompanies(prev => [...prev, company]);
    setFilters(prev => ({ ...prev, companies: [...prev.companies, company.id] }));
    setCompanyQuery(''); setCompanyResults([]);
  };

  const removeCompany = (id: number) => {
    setSelectedCompanies(prev => prev.filter(c => c.id !== id));
    setFilters(prev => ({ ...prev, companies: prev.companies.filter(cid => cid !== id) }));
  };

  // ── Provider toggle ──
  const toggleProvider = (provider: Provider) => {
    const exists = filters.watchProviders.includes(provider.provider_id);
    if (exists) {
      setFilters(prev => ({ ...prev, watchProviders: prev.watchProviders.filter(id => id !== provider.provider_id) }));
      setSelectedProviders(prev => prev.filter(p => p.provider_id !== provider.provider_id));
    } else {
      setFilters(prev => ({ ...prev, watchProviders: [...prev.watchProviders, provider.provider_id] }));
      setSelectedProviders(prev => [...prev, provider]);
    }
  };

  // ── Torrent search ──
  const searchTorrentsDirectly = async (searchQuery: string, category: 'Movies' | 'TV' = 'Movies'): Promise<any[]> => {
    if (!searchQuery.trim()) return [];
    setLoadingDirectTorrents(true);
    try {
      const cleanQuery = searchQuery.replace(/[^\w\s'-]/g, ' ').trim().replace(/\s+/g, ' ');
      let data: any = null;
      const proxies = ['https://api.allorigins.win/raw?url=', 'https://corsproxy.io/?', 'https://api.codetabs.com/v1/proxy?quest='];

      for (const proxy of proxies) {
        try {
          const searchUrl = `https://1337x.to/search/${encodeURIComponent(cleanQuery)}/1/`;
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 15000);
          const res = await fetch(`${proxy}${encodeURIComponent(searchUrl)}`, { headers: { Accept: 'text/html' }, signal: ctrl.signal });
          clearTimeout(tid);
          if (res.ok) {
            const html = await res.text();
            const magnets = html.match(/magnet:\?xt=urn:btih:[a-zA-Z0-9]{40}[^"'\s<>]*/gi);
            if (magnets && magnets.length > 0) {
              const titleRe = /<a[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/a>/gi;
              const titles: string[] = [];
              let m;
              while ((m = titleRe.exec(html)) !== null && titles.length < magnets.length) {
                const t = m[1].trim();
                if (t && t.length > 3 && t.length < 200) titles.push(t);
              }
              data = magnets.slice(0, 20).map((mag, i) => ({ title: titles[i] || `Torrent ${i + 1} - ${cleanQuery}`, magnet: mag, size: '', seeders: 0, leechers: 0, category, provider: '1337x' }));
              if (data.length > 0) break;
            }
          }
        } catch (e: any) { if (e.name !== 'AbortError') console.warn('Torrent proxy failed:', e.message); }
      }

      if (!data || data.length === 0) { setDirectTorrentResults([]); return []; }
      const formatted = data.map((t: any) => ({ ...t, quality: extractQuality(t.title) }));
      setDirectTorrentResults(formatted);
      return formatted;
    } catch { setDirectTorrentResults([]); return []; }
    finally { setLoadingDirectTorrents(false); }
  };

  // ── Effects ──
  useEffect(() => {
    const load = async () => {
      setLoadingProviders(true);
      const [movieGenres, tvGenres, certs, mp, tvp] = await Promise.all([
        fetchGenres('movie').catch(() => [] as { id: number; name: string }[]),
        fetchGenres('tv').catch(() => [] as { id: number; name: string }[]),
        getAllMovieCertifications().catch(() => [] as { certification: string; meaning: string; order: number }[]),
        fetchWatchProviders('movie').catch(() => [] as Provider[]),
        fetchWatchProviders('tv').catch(() => [] as Provider[]),
      ]);
      setLoadingProviders(false);
      const allGenres = [...movieGenres];
      tvGenres.forEach(g => { if (!allGenres.find(ag => ag.id === g.id)) allGenres.push(g); });
      setAvailableGenres(allGenres.sort((a, b) => a.name.localeCompare(b.name)));
      setAvailableCertifications(certs);
      const combined = new Map<number, Provider>();
      [...mp, ...tvp].forEach(p => combined.set(p.provider_id, p));
      setAvailableProviders(Array.from(combined.values()).sort((a, b) => a.display_priority - b.display_priority).slice(0, 30));
    };
    load();
  }, []);

  useEffect(() => {
    const loadSection = async () => {
      if (!sectionId || hasSearched || !isSupabaseConfigured() || !supabase) return;
      try {
        const { data: section } = await supabase
          .from('homepage_sections').select('id, title, config').eq('id', sectionId).single();
        if (!section?.config?.tmdb_filters) return;
        const tf = section.config.tmdb_filters as TMDBFilters;
        setFilters(prev => ({
          ...prev,
          mediaType: tf.media_type === 'movie' ? 'movie' : tf.media_type === 'tv' ? 'tv' : 'all',
          genres: tf.with_genres || prev.genres,
          minRating: tf['vote_average.gte'] ?? prev.minRating,
          certification: tf.certification || prev.certification,
          sortBy: tf.sort_by || prev.sortBy,
        }));
        setSearchMode('discover'); setIsLoading(true); setHasSearched(true);
        const mediaType = tf.media_type || 'movie';
        const res = await discoverWithFilters(mediaType, tf, 1);
        setAllResults(res.results.map((item: any) => ({ ...item, media_type: item.media_type || mediaType })));
        setTotalPages(res.total_pages); setTotalResults(res.total_results); setCurrentPage(1);
      } catch (err) { console.error('Error loading section:', err); }
      finally { setIsLoading(false); }
    };
    loadSection();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  // ── Render ──
  const yearLabel = (() => {
    const s = filters.startYear, e = filters.endYear;
    if (s && e && s === e) return String(s);
    if (s && e) return `${s}–${e}`;
    if (s) return `${s}+`;
    if (e) return `–${e}`;
    return '';
  })();

  return (
    <div className="w-full">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search movies, TV shows..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || (!query.trim() && !hasActiveFilters)}
            className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Search'}
          </button>
          {hasActiveFilters && !query.trim() && (
            <button type="button" onClick={() => handleDiscover(1)} disabled={isLoading}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium whitespace-nowrap">
              <i className="fas fa-compass mr-1.5" />Discover
            </button>
          )}
        </div>
      </form>

      {/* Compact filter bar */}
      <div className="max-w-6xl mx-auto mb-4">
        <div className="bg-gray-900/80 border border-gray-800 rounded-lg p-2.5">
          <div className="flex flex-wrap gap-1.5 items-center">
            {/* Media type */}
            <div className="flex bg-gray-800 rounded-md p-0.5 gap-0.5">
              {(['all', 'movie', 'tv'] as const).map(t => (
                <button key={t} type="button" onClick={() => handleFilterChange('mediaType', t)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors font-medium ${filters.mediaType === t ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {t === 'all' ? 'All' : t === 'movie' ? 'Movies' : 'TV Shows'}
                </button>
              ))}
            </div>

            {/* Streams */}
            <button type="button" onClick={() => setShowStreams(s => !s)}
              className={`h-8 px-2.5 text-xs rounded-md transition-colors flex items-center gap-1 ${showStreams ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}`}>
              <i className="fas fa-stream text-xs" />Streams
            </button>

            <div className="w-px h-5 bg-gray-700 mx-0.5" />

            <FilterBtn label="Genres" count={filters.genres.length} active={filters.genres.length > 0} open={activeDropdown === 'genre'} onClick={() => toggleDropdown('genre')} />
            <FilterBtn label={yearLabel ? `Year: ${yearLabel}` : 'Year'} active={!!(filters.startYear || filters.endYear)} open={activeDropdown === 'year'} onClick={() => toggleDropdown('year')} />
            <FilterBtn label={filters.minRating !== '' ? `★ ${filters.minRating}+` : 'Rating'} active={filters.minRating !== ''} open={activeDropdown === 'rating'} onClick={() => toggleDropdown('rating')} />
            {filters.mediaType !== 'tv' && (
              <FilterBtn label={filters.certification || 'Certification'} active={!!filters.certification} open={activeDropdown === 'cert'} onClick={() => toggleDropdown('cert')} />
            )}
            <FilterBtn label="Streaming" count={filters.watchProviders.length} active={filters.watchProviders.length > 0} open={activeDropdown === 'providers'} onClick={() => toggleDropdown('providers')} />
            <FilterBtn label="Cast" count={filters.actors.length} active={filters.actors.length > 0} open={activeDropdown === 'actor'} onClick={() => toggleDropdown('actor')} />
            <FilterBtn label="Studio" count={filters.companies.length} active={filters.companies.length > 0} open={activeDropdown === 'company'} onClick={() => toggleDropdown('company')} />

            <div className="w-px h-5 bg-gray-700 mx-0.5" />

            <select value={filters.sortBy} onChange={e => handleFilterChange('sortBy', e.target.value)}
              className="h-8 px-2 text-xs bg-gray-700 text-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 hover:text-white">
              <option value="popularity.desc">Popular ↓</option>
              <option value="popularity.asc">Popular ↑</option>
              <option value="rating.desc">Rating ↓</option>
              <option value="rating.asc">Rating ↑</option>
              <option value="year.desc">Newest</option>
              <option value="year.asc">Oldest</option>
              <option value="title.asc">Title A–Z</option>
              <option value="title.desc">Title Z–A</option>
            </select>

            {hasActiveFilters && (
              <button type="button" onClick={clearFilters}
                className="h-8 px-2.5 text-xs rounded-md bg-gray-700 text-red-400 hover:text-red-300 hover:bg-gray-600 transition-colors flex items-center gap-1">
                <i className="fas fa-times text-xs" />Clear
              </button>
            )}
          </div>

          {/* Active selection chips */}
          {(selectedActors.length > 0 || selectedCompanies.length > 0 || selectedProviders.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-800">
              {selectedActors.map(actor => (
                <span key={actor.id} className="flex items-center gap-1 bg-gray-700 text-white text-xs px-2 py-0.5 rounded-full">
                  {actor.profile_path && <img src={getImageUrl(actor.profile_path, 'w45')} alt="" className="w-4 h-4 rounded-full object-cover" />}
                  {actor.name}
                  <button onClick={() => removeActor(actor.id)} className="ml-0.5 text-gray-400 hover:text-white"><i className="fas fa-times text-xs" /></button>
                </span>
              ))}
              {selectedCompanies.map(c => (
                <span key={c.id} className="flex items-center gap-1 bg-gray-700 text-white text-xs px-2 py-0.5 rounded-full">
                  {c.name}
                  <button onClick={() => removeCompany(c.id)} className="ml-0.5 text-gray-400 hover:text-white"><i className="fas fa-times text-xs" /></button>
                </span>
              ))}
              {selectedProviders.map(p => (
                <span key={p.provider_id} className="flex items-center gap-1 bg-gray-700 text-white text-xs px-2 py-0.5 rounded-full">
                  {p.logo_path && <img src={getImageUrl(p.logo_path, 'w45')} alt="" className="w-4 h-4 rounded object-contain" />}
                  {p.provider_name}
                  <button onClick={() => toggleProvider(p)} className="ml-0.5 text-gray-400 hover:text-white"><i className="fas fa-times text-xs" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {activeDropdown && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setActiveDropdown(null)} />
      )}

      {/* Genre dropdown */}
      {activeDropdown === 'genre' && (
        <div className="max-w-6xl mx-auto mb-4 relative z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-white font-semibold text-sm">Select Genres</span>
              <div className="flex items-center gap-2">
                {filters.genres.length > 0 && (
                  <button onClick={() => handleFilterChange('genres', [])} className="text-red-400 text-xs hover:text-red-300">Clear all</button>
                )}
                <button onClick={() => setActiveDropdown(null)} className="text-gray-500 hover:text-white"><i className="fas fa-times" /></button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {availableGenres.map(genre => {
                  const on = filters.genres.includes(genre.id);
                  return (
                    <button key={genre.id} type="button"
                      onClick={() => handleFilterChange('genres', on ? filters.genres.filter(id => id !== genre.id) : [...filters.genres, genre.id])}
                      className={`px-2 py-1.5 rounded text-xs font-medium transition-all text-center ${on ? 'bg-red-600 text-white ring-1 ring-red-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'}`}>
                      {genre.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Year dropdown */}
      {activeDropdown === 'year' && (
        <div className="max-w-6xl mx-auto mb-4 relative z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-white font-semibold text-sm">Year Range</span>
              <div className="flex items-center gap-2">
                {(filters.startYear || filters.endYear) && (
                  <button onClick={() => { handleFilterChange('startYear', ''); handleFilterChange('endYear', ''); }} className="text-red-400 text-xs hover:text-red-300">Clear</button>
                )}
                <button onClick={() => setActiveDropdown(null)} className="text-gray-500 hover:text-white"><i className="fas fa-times" /></button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2 mb-4">
                {[2020, 2010, 2000, 1990, 1980].map(decade => (
                  <button key={decade} type="button"
                    onClick={() => { handleFilterChange('startYear', decade); handleFilterChange('endYear', decade + 9); }}
                    className="px-3 py-1.5 text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white rounded transition-colors">
                    {decade}s
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">From</label>
                  <input type="number" value={filters.startYear || ''} placeholder="e.g. 2010"
                    min="1900" max={new Date().getFullYear() + 1}
                    onChange={e => { const v = e.target.value === '' ? '' : parseInt(e.target.value); if (v === '' || (!isNaN(v as number) && (v as number) >= 1900)) handleFilterChange('startYear', v); }}
                    className="w-full px-3 py-2 text-sm bg-gray-800 text-white rounded focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">To</label>
                  <input type="number" value={filters.endYear || ''} placeholder="e.g. 2024"
                    min="1900" max={new Date().getFullYear() + 1}
                    onChange={e => { const v = e.target.value === '' ? '' : parseInt(e.target.value); if (v === '' || (!isNaN(v as number) && (v as number) >= 1900)) handleFilterChange('endYear', v); }}
                    className="w-full px-3 py-2 text-sm bg-gray-800 text-white rounded focus:outline-none focus:ring-1 focus:ring-red-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rating dropdown */}
      {activeDropdown === 'rating' && (
        <div className="max-w-6xl mx-auto mb-4 relative z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-white font-semibold text-sm">Minimum Rating</span>
              <div className="flex items-center gap-2">
                {filters.minRating !== '' && <button onClick={() => handleFilterChange('minRating', '')} className="text-red-400 text-xs hover:text-red-300">Clear</button>}
                <button onClick={() => setActiveDropdown(null)} className="text-gray-500 hover:text-white"><i className="fas fa-times" /></button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleFilterChange('minRating', '')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filters.minRating === '' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                  Any
                </button>
                {[9, 8, 7, 6, 5, 4, 3].map(r => (
                  <button key={r} onClick={() => handleFilterChange('minRating', r)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filters.minRating === r ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                    ★ {r}+
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Certification dropdown */}
      {activeDropdown === 'cert' && filters.mediaType !== 'tv' && (
        <div className="max-w-6xl mx-auto mb-4 relative z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-white font-semibold text-sm">Certification</span>
              <div className="flex items-center gap-2">
                {filters.certification && <button onClick={() => handleFilterChange('certification', '')} className="text-red-400 text-xs hover:text-red-300">Clear</button>}
                <button onClick={() => setActiveDropdown(null)} className="text-gray-500 hover:text-white"><i className="fas fa-times" /></button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleFilterChange('certification', '')}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${!filters.certification ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                  Any
                </button>
                {availableCertifications.map(cert => (
                  <button key={cert.certification} onClick={() => handleFilterChange('certification', cert.certification)} title={cert.meaning}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filters.certification === cert.certification ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                    {cert.certification}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Streaming providers dropdown */}
      {activeDropdown === 'providers' && (
        <div className="max-w-6xl mx-auto mb-4 relative z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-white font-semibold text-sm">Streaming Services</span>
              <div className="flex items-center gap-2">
                {filters.watchProviders.length > 0 && (
                  <button onClick={() => { setFilters(p => ({ ...p, watchProviders: [] })); setSelectedProviders([]); }} className="text-red-400 text-xs hover:text-red-300">Clear all</button>
                )}
                <button onClick={() => setActiveDropdown(null)} className="text-gray-500 hover:text-white"><i className="fas fa-times" /></button>
              </div>
            </div>
            <div className="p-4">
              {loadingProviders ? (
                <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-10 gap-2">
                  {availableProviders.map(provider => {
                    const on = filters.watchProviders.includes(provider.provider_id);
                    return (
                      <button key={provider.provider_id} type="button" onClick={() => toggleProvider(provider)} title={provider.provider_name}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${on ? 'bg-red-600/20 ring-1 ring-red-500' : 'bg-gray-800 hover:bg-gray-700'}`}>
                        {provider.logo_path ? (
                          <img src={getImageUrl(provider.logo_path, 'w92')} alt={provider.provider_name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                            <i className="fas fa-play text-gray-400 text-xs" />
                          </div>
                        )}
                        <span className="text-xs text-gray-300 text-center line-clamp-1 leading-tight w-full">{provider.provider_name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actor dropdown */}
      {activeDropdown === 'actor' && (
        <div className="max-w-6xl mx-auto mb-4 relative z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-white font-semibold text-sm">Cast / Actors</span>
              <button onClick={() => setActiveDropdown(null)} className="text-gray-500 hover:text-white"><i className="fas fa-times" /></button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <input type="text" value={actorQuery} onChange={e => handleActorSearch(e.target.value)}
                  placeholder="Search actors..." autoFocus
                  className="w-full px-3 py-2 text-sm bg-gray-800 text-white rounded focus:outline-none focus:ring-1 focus:ring-red-500" />
                {searchingActors && <i className="fas fa-spinner fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />}
              </div>
              {actorResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                  {actorResults.map(actor => (
                    <button key={actor.id} type="button" onClick={() => addActor(actor)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-800 rounded flex items-center gap-3">
                      {actor.profile_path ? (
                        <img src={getImageUrl(actor.profile_path, 'w45')} alt={actor.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0"><i className="fas fa-user text-gray-500 text-xs" /></div>
                      )}
                      <div>
                        <div className="text-white text-sm">{actor.name}</div>
                        {actor.known_for_department && <div className="text-gray-500 text-xs">{actor.known_for_department}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedActors.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs mb-2">Selected:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedActors.map(actor => (
                      <span key={actor.id} className="flex items-center gap-1 bg-gray-700 text-white text-xs px-2 py-1 rounded-full">
                        {actor.name}
                        <button onClick={() => removeActor(actor.id)} className="text-gray-400 hover:text-white"><i className="fas fa-times text-xs" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Studio/Company dropdown */}
      {activeDropdown === 'company' && (
        <div className="max-w-6xl mx-auto mb-4 relative z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-white font-semibold text-sm">Production Studio</span>
              <button onClick={() => setActiveDropdown(null)} className="text-gray-500 hover:text-white"><i className="fas fa-times" /></button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <input type="text" value={companyQuery} onChange={e => handleCompanySearch(e.target.value)}
                  placeholder="Search studios (e.g. Marvel, A24, Pixar)..." autoFocus
                  className="w-full px-3 py-2 text-sm bg-gray-800 text-white rounded focus:outline-none focus:ring-1 focus:ring-red-500" />
                {searchingCompanies && <i className="fas fa-spinner fa-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />}
              </div>
              {companyResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                  {companyResults.map(company => (
                    <button key={company.id} type="button" onClick={() => addCompany(company)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-800 rounded flex items-center gap-3">
                      {company.logo_path ? (
                        <img src={getImageUrl(company.logo_path, 'w92')} alt={company.name} className="w-10 h-6 object-contain flex-shrink-0 bg-white rounded px-1" />
                      ) : (
                        <div className="w-10 h-6 bg-gray-700 rounded flex items-center justify-center flex-shrink-0"><i className="fas fa-building text-gray-500 text-xs" /></div>
                      )}
                      <span className="text-white text-sm">{company.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedCompanies.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs mb-2">Selected:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCompanies.map(c => (
                      <span key={c.id} className="flex items-center gap-1 bg-gray-700 text-white text-xs px-2 py-1 rounded-full">
                        {c.name}
                        <button onClick={() => removeCompany(c.id)} className="text-gray-400 hover:text-white"><i className="fas fa-times text-xs" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Searching...</p>
          </div>
        </div>
      )}

      {/* Results */}
      {!isLoading && hasSearched && (
        <div className="max-w-6xl mx-auto">
          {showStreams ? (
            <>
              <h2 className="text-xl font-bold text-white mb-4">
                Torrent Results {query.trim() && `for "${query}"`}
                {directTorrentResults.length > 0 && ` (${directTorrentResults.length})`}
              </h2>
              {loadingDirectTorrents ? (
                <div className="flex items-center justify-center py-16 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
                  <p className="text-white text-sm">Searching torrents...</p>
                </div>
              ) : directTorrentResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {directTorrentResults.map((stream, index) => (
                    <div key={index} className="bg-gray-800 rounded-lg p-4">
                      <h3 className="text-white text-sm font-medium mb-2 line-clamp-2">{stream.title}</h3>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {stream.quality && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">{stream.quality}</span>}
                        {stream.size && <span className="text-xs text-gray-400">{stream.size}</span>}
                        {stream.seeders > 0 && <span className="text-xs text-green-400">{stream.seeders} seeds</span>}
                      </div>
                      <a
                        href={stream.magnet ? createUrl(`/watch-torrent?title=${encodeURIComponent(stream.title || '')}&magnet=${encodeURIComponent(stream.magnet)}`) : '#'}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-xs font-medium transition-colors text-center block"
                        onClick={e => { if (!stream.magnet) { e.preventDefault(); alert('No magnet link available.'); } }}
                      >
                        <i className="fas fa-play mr-1" />Watch
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <i className="fas fa-magnet text-5xl text-red-600 mb-4" />
                  <h3 className="text-xl font-bold text-white mb-3">Manual Magnet Entry</h3>
                  <p className="text-gray-400 mb-6 text-sm max-w-md mx-auto">
                    Automatic torrent search is unavailable due to browser CORS restrictions. Paste a magnet link manually.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mb-6">
                    {['https://1337x.to', 'https://thepiratebay.org', 'https://yts.mx'].map(url => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                        className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-xs transition-colors">
                        <i className="fas fa-external-link-alt mr-1" />{url.replace('https://', '')}
                      </a>
                    ))}
                  </div>
                  <a href={createUrl(`/watch-torrent?title=${encodeURIComponent(query.trim())}`)}
                    className="inline-block bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors font-semibold">
                    <i className="fas fa-magnet mr-2" />Open Torrent Player
                  </a>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Header + top pagination */}
              <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
                <h2 className="text-lg font-bold text-white">
                  {searchMode === 'discover' ? 'Discover' : 'Search'} Results
                  {displayedResults.length !== allResults.length && (
                    <span className="text-gray-400 font-normal text-sm ml-2">
                      {displayedResults.length} shown of {allResults.length}
                    </span>
                  )}
                </h2>
                {totalPages > 1 && (
                  <PaginationControls currentPage={currentPage} totalPages={totalPages} totalResults={totalResults} onPageChange={handlePageChange} />
                )}
              </div>

              {/* Post-search refinement bar */}
              {allResults.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-2.5 bg-gray-900/60 border border-gray-800 rounded-lg mb-4">
                  <div className="relative flex-1 min-w-40">
                    <i className="fas fa-filter absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-xs pointer-events-none" />
                    <input type="text" value={postText} onChange={e => setPostText(e.target.value)}
                      placeholder="Filter results by title..."
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-gray-800 text-white border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-red-500" />
                  </div>

                  <div className="flex bg-gray-800 rounded p-0.5 gap-0.5">
                    {(['all', 'movie', 'tv'] as const).map(t => (
                      <button key={t} onClick={() => setPostMediaType(t)}
                        className={`px-2 py-1 text-xs rounded transition-colors ${postMediaType === t ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                        {t === 'all' ? 'All' : t === 'movie' ? 'Movies' : 'TV'}
                      </button>
                    ))}
                  </div>

                  <select value={postMinRating} onChange={e => setPostMinRating(e.target.value !== '' ? parseFloat(e.target.value) : '')}
                    className="py-1.5 px-2 text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-red-500">
                    <option value="">Any Rating</option>
                    {[9, 8, 7, 6, 5].map(r => <option key={r} value={r}>★ {r}+</option>)}
                  </select>

                  <select value={postSortBy} onChange={e => setPostSortBy(e.target.value)}
                    className="py-1.5 px-2 text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-red-500">
                    <option value="">Sort: Default</option>
                    <option value="popularity.desc">Popular ↓</option>
                    <option value="rating.desc">Rating ↓</option>
                    <option value="rating.asc">Rating ↑</option>
                    <option value="year.desc">Newest</option>
                    <option value="year.asc">Oldest</option>
                    <option value="title.asc">Title A–Z</option>
                    <option value="title.desc">Title Z–A</option>
                  </select>

                  {hasPostFilters && (
                    <button onClick={() => { setPostText(''); setPostMediaType('all'); setPostMinRating(''); setPostSortBy(''); }}
                      className="px-2 py-1.5 text-xs bg-gray-700 text-gray-400 rounded hover:text-white transition-colors flex items-center gap-1">
                      <i className="fas fa-times text-xs" />Clear
                    </button>
                  )}
                </div>
              )}

              {/* Results grid */}
              {displayedResults.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {displayedResults.map(item => {
                      const title = getTitle(item);
                      const year = getYear(item);
                      const posterUrl = item.poster_path ? getImageUrl(item.poster_path, 'w500') : '/images/placeholder-poster.jpg';
                      const mediaType: 'movie' | 'tv' =
                        item.media_type === 'movie' || item.media_type === 'tv'
                          ? item.media_type : item.title ? 'movie' : 'tv';
                      return (
                        <div key={`${mediaType}-${item.id}`} className="group">
                          <a href={createUrl(`/details?type=${mediaType}&id=${item.id}`)} className="block">
                            <div className="relative rounded-lg overflow-hidden shadow-md transition-transform duration-200 active:scale-95 group-hover:scale-105 group-hover:shadow-xl bg-gray-800">
                              <img src={posterUrl} alt={title} className="w-full aspect-[2/3] object-cover" loading="lazy" />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-10 pb-2 px-2">
                                <h3 className="text-white text-xs font-semibold line-clamp-2 leading-tight">{title}</h3>
                                {year && <p className="text-gray-400 text-xs mt-0.5">{year}</p>}
                              </div>
                              <div className="absolute top-1.5 left-1.5">
                                <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-xs font-bold uppercase leading-none">
                                  {mediaType === 'tv' ? 'TV' : 'Film'}
                                </span>
                              </div>
                              <div className="absolute top-1.5 right-1.5">
                                <span className="bg-black/70 text-yellow-400 px-1.5 py-0.5 rounded text-xs font-semibold leading-none">
                                  ★ {item.vote_average.toFixed(1)}
                                </span>
                              </div>
                              <div className="absolute bottom-2 right-1.5" onClick={e => e.preventDefault()}>
                                <WatchlistButton movieId={item.id} mediaType={mediaType} title={title || ''} posterPath={item.poster_path} />
                              </div>
                            </div>
                          </a>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8">
                      <PaginationControls currentPage={currentPage} totalPages={totalPages} totalResults={totalResults} onPageChange={handlePageChange} />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <i className="fas fa-search text-4xl text-gray-700 mb-4" />
                  <h2 className="text-lg font-bold text-white mb-2">
                    {allResults.length > 0 ? 'No results match your filters' : 'No results found'}
                  </h2>
                  <p className="text-gray-500 text-sm mb-4">
                    {allResults.length > 0
                      ? 'Try adjusting or clearing the result filters.'
                      : 'Try different keywords or adjust the search filters.'}
                  </p>
                  {allResults.length > 0 && hasPostFilters && (
                    <button onClick={() => { setPostText(''); setPostMediaType('all'); setPostMinRating(''); setPostSortBy(''); }}
                      className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
                      Clear Result Filters
                    </button>
                  )}
                  {hasActiveFilters && allResults.length === 0 && (
                    <button onClick={clearFilters} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
                      Clear Search Filters
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Initial state */}
      {!hasSearched && !isLoading && (
        <div className="text-center py-16">
          <i className="fas fa-film text-5xl text-gray-700 mb-5" />
          <h2 className="text-xl font-bold text-white mb-3">Discover Movies & TV Shows</h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Search by name or use the filters above to browse by genre, streaming service, rating, and more.
          </p>
          {hasActiveFilters && (
            <p className="text-blue-400 text-xs mt-4">
              <i className="fas fa-info-circle mr-1" />
              Filters active — click Discover to browse matching content.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
