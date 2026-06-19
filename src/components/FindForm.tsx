import { useState, useEffect, useRef } from 'react';
import { discoverWithFilters, fetchFromTMDB, getImageUrl, searchMulti } from '../lib/tmdb';
import { createUrl } from '../lib/utils';
import WatchlistButton from './WatchlistButton';

interface MoodOption {
  label: string;
  emoji: string;
  movieGenres: number[];
  tvGenres: number[];
}

interface ToneOption {
  label: string;
  subtitle: string;
  overrideMovieGenres?: number[];
  overrideTvGenres?: number[];
  addMovieGenres?: number[];
  addTvGenres?: number[];
  addGenres?: number[];
  certLte?: string;
  keywords?: number[];
}

interface EraOption {
  label: string;
  subtitle: string;
  movieGte?: string;
  movieLte?: string;
  tvGte?: string;
  tvLte?: string;
}

interface RatingOption {
  label: string;
  subtitle: string;
  voteGte?: number;
  voteCountGte: number;
  sortBy: string;
}

interface LengthOption {
  label: string;
  subtitle: string;
  runtimeLte?: number;
  runtimeGte?: number;
}

const MOODS: MoodOption[] = [
  { label: 'Action & Adventure', emoji: '💥', movieGenres: [28, 12], tvGenres: [10759] },
  { label: 'Comedy', emoji: '😂', movieGenres: [35], tvGenres: [35] },
  { label: 'Drama', emoji: '🎭', movieGenres: [18], tvGenres: [18] },
  { label: 'Horror & Thriller', emoji: '😱', movieGenres: [27, 53], tvGenres: [27, 80] },
  { label: 'Sci-Fi & Fantasy', emoji: '🚀', movieGenres: [878, 14], tvGenres: [10765] },
  { label: 'Romance', emoji: '❤️', movieGenres: [10749], tvGenres: [10749] },
  { label: 'Crime & Mystery', emoji: '🔍', movieGenres: [80, 9648], tvGenres: [80, 9648] },
  { label: 'Documentary', emoji: '🎬', movieGenres: [99], tvGenres: [99] },
];

const TONE_MAP: Record<string, ToneOption[]> = {
  'Action & Adventure': [
    { label: 'Superhero', subtitle: 'Capes, powers, and blockbusters', keywords: [9715] },
    { label: 'Spy & Espionage', subtitle: 'Slick agents and globe-trotting intrigue', addMovieGenres: [53], addTvGenres: [53] },
    { label: 'War & Combat', subtitle: 'Gritty military stories', addMovieGenres: [10752], addTvGenres: [10768] },
    { label: 'Any style', subtitle: 'All action & adventure' },
  ],
  'Comedy': [
    { label: 'Family-friendly', subtitle: 'Light-hearted, safe for all ages', certLte: 'PG' },
    { label: 'Romantic Comedy', subtitle: 'Love, laughter, happy endings', addGenres: [10749] },
    { label: 'Satirical & Witty', subtitle: 'Sharp, clever, and irreverent' },
    { label: 'Any style', subtitle: 'All comedy' },
  ],
  'Drama': [
    { label: 'Romantic', subtitle: 'Love stories with emotional depth', addGenres: [10749] },
    { label: 'Historical', subtitle: 'Period pieces and true stories', addGenres: [36] },
    { label: 'Crime Drama', subtitle: 'Dark, morally complex stories', addGenres: [80] },
    { label: 'Any style', subtitle: 'All drama' },
  ],
  'Horror & Thriller': [
    { label: 'Psychological', subtitle: 'Mind games over jump scares', overrideMovieGenres: [53, 9648], overrideTvGenres: [9648] },
    { label: 'Supernatural', subtitle: 'Ghosts, demons, the paranormal', overrideMovieGenres: [27], overrideTvGenres: [27] },
    { label: 'Mystery & Suspense', subtitle: 'Secrets, twists, whodunits', overrideMovieGenres: [9648, 53], overrideTvGenres: [9648] },
    { label: 'Any style', subtitle: 'All horror & thriller' },
  ],
  'Sci-Fi & Fantasy': [
    { label: 'Space & Sci-Fi', subtitle: 'Futuristic tech and alien worlds', overrideMovieGenres: [878], overrideTvGenres: [10765] },
    { label: 'Fantasy & Magic', subtitle: 'Swords, spells, and other worlds', overrideMovieGenres: [14], overrideTvGenres: [10765] },
    { label: 'Superhero', subtitle: 'Powers, capes, and epic battles', keywords: [9715] },
    { label: 'Any style', subtitle: 'All sci-fi & fantasy' },
  ],
  'Romance': [
    { label: 'Romantic Comedy', subtitle: 'Funny and heartwarming', addGenres: [35] },
    { label: 'Dramatic Romance', subtitle: 'Emotional, intense love stories', addGenres: [18] },
    { label: 'Historical Romance', subtitle: 'Passion set in another era', addGenres: [36] },
    { label: 'Any style', subtitle: 'All romance' },
  ],
  'Crime & Mystery': [
    { label: 'Whodunit & Detective', subtitle: 'Puzzles, clues, investigations', overrideMovieGenres: [9648], overrideTvGenres: [9648, 80] },
    { label: 'Heist & Caper', subtitle: 'Elaborate plans and big scores', addMovieGenres: [53], addTvGenres: [53] },
    { label: 'Legal Thriller', subtitle: 'Courtrooms, lawyers, and justice', addGenres: [53] },
    { label: 'Any style', subtitle: 'All crime & mystery' },
  ],
  'Documentary': [
    { label: 'History & Culture', subtitle: 'The past, people, and civilisations', addGenres: [36] },
    { label: 'Science & Nature', subtitle: 'The natural world and discoveries' },
    { label: 'True Crime', subtitle: 'Real investigations and cases' },
    { label: 'Any style', subtitle: 'All documentaries' },
  ],
};

const ERAS: EraOption[] = [
  { label: 'Brand New', subtitle: '2024 or newer', movieGte: '2024-01-01', tvGte: '2024-01-01' },
  { label: 'Recent', subtitle: '2015 – 2023', movieGte: '2015-01-01', movieLte: '2023-12-31', tvGte: '2015-01-01', tvLte: '2023-12-31' },
  { label: 'Modern', subtitle: '2000 – 2014', movieGte: '2000-01-01', movieLte: '2014-12-31', tvGte: '2000-01-01', tvLte: '2014-12-31' },
  { label: 'Classic', subtitle: 'Before 2000', movieLte: '1999-12-31', tvLte: '1999-12-31' },
  { label: 'Any Era', subtitle: 'No preference' },
];

const RATING_OPTIONS: RatingOption[] = [
  { label: 'Critically acclaimed', subtitle: 'Top-rated titles only (8.0+)', voteGte: 8.0, voteCountGte: 500, sortBy: 'vote_average.desc' },
  { label: 'Generally well-reviewed', subtitle: 'Solid picks people enjoy (7.0+)', voteGte: 7.0, voteCountGte: 200, sortBy: 'popularity.desc' },
  { label: 'Anything goes', subtitle: 'Hidden gems welcome', voteCountGte: 20, sortBy: 'popularity.desc' },
];

const LENGTHS: LengthOption[] = [
  { label: 'Quick', subtitle: 'Under 90 minutes', runtimeLte: 90 },
  { label: 'Standard', subtitle: '90 – 130 minutes', runtimeGte: 90, runtimeLte: 130 },
  { label: 'Epic', subtitle: '2 hours or more', runtimeGte: 120 },
  { label: 'No preference', subtitle: 'Any runtime' },
];

const INITIAL_VISIBLE = 8;
const LOAD_MORE_BATCH = 8;

type Step = 'type' | 'mood' | 'tone' | 'era' | 'rating' | 'length' | 'taste' | 'results';

function buildFilters(
  contentType: 'movie' | 'tv',
  mood: MoodOption,
  tone: ToneOption | null,
  era: EraOption,
  rating: RatingOption,
  length: LengthOption | null,
  companyIds?: number[]
): Record<string, any> {
  const filters: Record<string, any> = {};

  let genres = contentType === 'movie' ? [...mood.movieGenres] : [...mood.tvGenres];

  if (tone) {
    if (contentType === 'movie' && tone.overrideMovieGenres) genres = tone.overrideMovieGenres;
    else if (contentType === 'tv' && tone.overrideTvGenres) genres = tone.overrideTvGenres;

    if (contentType === 'movie' && tone.addMovieGenres) genres = [...genres, ...tone.addMovieGenres];
    else if (contentType === 'tv' && tone.addTvGenres) genres = [...genres, ...tone.addTvGenres];

    if (tone.addGenres) genres = [...genres, ...tone.addGenres];
  }

  if (genres.length > 0) filters.with_genres = genres;

  if (contentType === 'movie') {
    if (era.movieGte) filters['primary_release_date.gte'] = era.movieGte;
    if (era.movieLte) filters['primary_release_date.lte'] = era.movieLte;
  } else {
    if (era.tvGte) filters['first_air_date.gte'] = era.tvGte;
    if (era.tvLte) filters['first_air_date.lte'] = era.tvLte;
  }

  if (rating.voteGte !== undefined) filters['vote_average.gte'] = rating.voteGte;
  filters['vote_count.gte'] = rating.voteCountGte;
  filters.sort_by = rating.sortBy;

  if (length && contentType === 'movie') {
    if (length.runtimeLte !== undefined) filters['with_runtime.lte'] = length.runtimeLte;
    if (length.runtimeGte !== undefined) filters['with_runtime.gte'] = length.runtimeGte;
  }

  if (tone && contentType === 'movie' && tone.certLte) {
    filters.certification_country = 'US';
    filters['certification.lte'] = tone.certLte;
  }

  if (tone?.keywords?.length) filters.with_keywords = tone.keywords.join(',');
  if (companyIds?.length) filters.with_companies = companyIds.join('|');

  return filters;
}

export default function FindForm() {
  const [step, setStep] = useState<Step>('type');
  const [contentType, setContentType] = useState<'movie' | 'tv'>('movie');
  const [mood, setMood] = useState<MoodOption | null>(null);
  const [tone, setTone] = useState<ToneOption | null>(null);
  const [era, setEra] = useState<EraOption | null>(null);
  const [rating, setRating] = useState<RatingOption | null>(null);
  const [length, setLength] = useState<LengthOption | null>(null);

  // Taste pool
  const [tastePool, setTastePool] = useState<any[]>([]);
  const [tasteLoading, setTasteLoading] = useState(false);
  const [tastePage, setTastePage] = useState(1);
  const [tasteTotalPages, setTasteTotalPages] = useState(1);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [tasteLoadingMore, setTasteLoadingMore] = useState(false);
  const [tasteFilters, setTasteFilters] = useState<Record<string, any>>({});

  // Selections
  const [selectedTitles, setSelectedTitles] = useState<Set<number>>(new Set());
  const [pinnedItems, setPinnedItems] = useState<Map<number, any>>(new Map());

  // Title search
  const [titleSearch, setTitleSearch] = useState('');
  const [titleSearchResults, setTitleSearchResults] = useState<any[]>([]);
  const [titleSearchLoading, setTitleSearchLoading] = useState(false);

  // Results
  const [results, setResults] = useState<any[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broadened, setBroadened] = useState(false);

  // Results refinement
  const [baseFilters, setBaseFilters] = useState<Record<string, any>>({});
  const [resultFilters, setResultFilters] = useState<Record<string, any>>({});
  const [resultPage, setResultPage] = useState(1);
  const [resultTotalPages, setResultTotalPages] = useState(1);
  const [refineLoading, setRefineLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!titleSearch.trim()) { setTitleSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setTitleSearchLoading(true);
      try {
        const data = await searchMulti(titleSearch);
        setTitleSearchResults(
          (data.results || []).filter((r: any) => r.media_type === contentType).slice(0, 6)
        );
      } catch { setTitleSearchResults([]); }
      finally { setTitleSearchLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [titleSearch, contentType]);

  const MOVIE_STEPS: Step[] = ['type', 'mood', 'tone', 'era', 'rating', 'length', 'taste'];
  const TV_STEPS: Step[] = ['type', 'mood', 'tone', 'era', 'rating', 'taste'];
  const steps = contentType === 'movie' ? MOVIE_STEPS : TV_STEPS;
  const currentIdx = steps.indexOf(step);
  const progressPercent = step === 'results' ? 100 : ((currentIdx + 1) / (steps.length + 1)) * 100;

  const goBack = () => {
    const idx = steps.indexOf(step);
    if (idx > 0) {
      if (step === 'taste') {
        setSelectedTitles(new Set()); setPinnedItems(new Map());
        setTitleSearch(''); setTitleSearchResults([]);
        setTasteFilters({});
      }
      setStep(steps[idx - 1]);
    }
  };

  const loadTasteSamples = async (
    type: 'movie' | 'tv', m: MoodOption, t: ToneOption | null,
    e: EraOption, r: RatingOption, l: LengthOption | null,
    extra: Record<string, any> = {}
  ) => {
    setTasteLoading(true);
    setTastePool([]); setVisibleCount(INITIAL_VISIBLE); setTastePage(1);
    try {
      const merged = { ...buildFilters(type, m, t, e, r, l), ...extra };
      const data = await discoverWithFilters(type, merged, 1);
      setTastePool(data.results || []);
      setTasteTotalPages(data.total_pages || 1);
    } catch { setTastePool([]); }
    finally { setTasteLoading(false); }
  };

  const refineTaste = (overrides: Record<string, any>) => {
    setTasteFilters(overrides);
    loadTasteSamples(contentType, mood!, tone, era!, rating!, length, overrides);
  };

  const loadMoreTasteSamples = async () => {
    if (visibleCount < tastePool.length) { setVisibleCount(v => v + LOAD_MORE_BATCH); return; }
    if (tastePage >= tasteTotalPages) return;
    setTasteLoadingMore(true);
    try {
      const next = tastePage + 1;
      const merged = { ...buildFilters(contentType, mood!, tone, era!, rating!, length), ...tasteFilters };
      const data = await discoverWithFilters(contentType, merged, next);
      setTastePool(prev => [...prev, ...(data.results || [])]);
      setTastePage(next); setVisibleCount(v => v + LOAD_MORE_BATCH);
    } catch {} finally { setTasteLoadingMore(false); }
  };

  const toggleTasteSelection = (id: number) => {
    setSelectedTitles(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const addPinnedItem = (item: any) => {
    setPinnedItems(prev => { const n = new Map(prev); n.set(item.id, item); return n; });
    setSelectedTitles(prev => new Set(prev).add(item.id));
    setTitleSearch(''); setTitleSearchResults([]);
  };

  const removePinnedItem = (id: number) => {
    setPinnedItems(prev => { const n = new Map(prev); n.delete(id); return n; });
    setSelectedTitles(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const runSearch = async (
    type: 'movie' | 'tv', m: MoodOption, t: ToneOption | null,
    e: EraOption, r: RatingOption, l: LengthOption | null, pickedIds: number[]
  ) => {
    setLoading(true); setError(null); setBroadened(false); setStep('results');
    try {
      let companyIds: number[] = [];
      if (pickedIds.length > 0) {
        const details = await Promise.all(pickedIds.map(id => fetchFromTMDB(`/${type}/${id}`).catch(() => null)));
        details.forEach(d => d?.production_companies?.forEach((c: any) => {
          if (!companyIds.includes(c.id)) companyIds.push(c.id);
        }));
      }

      const base = buildFilters(type, m, t, e, r, l, companyIds);
      const data = await discoverWithFilters(type, base, 1);

      if ((data.total_results === 0 || !data.results?.length) && companyIds.length > 0) {
        const fallbackBase = buildFilters(type, m, t, e, r, l);
        const fallback = await discoverWithFilters(type, fallbackBase, 1);
        setResults(fallback.results || []);
        setTotalResults(fallback.total_results || 0);
        setResultTotalPages(fallback.total_pages || 1);
        setBaseFilters(fallbackBase);
        setBroadened(true);
      } else {
        setResults(data.results || []);
        setTotalResults(data.total_results || 0);
        setResultTotalPages(data.total_pages || 1);
        setBaseFilters(base);
      }
      setResultFilters({});
      setResultPage(1);
    } catch (err: any) { setError(err.message || 'Failed to load results'); }
    finally { setLoading(false); }
  };

  const applyRefinement = async (overrides: Record<string, any>) => {
    setRefineLoading(true);
    const merged = { ...baseFilters, ...overrides };
    try {
      const data = await discoverWithFilters(contentType, merged, 1);
      setResults(data.results || []);
      setTotalResults(data.total_results || 0);
      setResultTotalPages(data.total_pages || 1);
      setResultFilters(overrides);
      setResultPage(1);
    } catch {}
    finally { setRefineLoading(false); }
  };

  const loadMoreResults = async () => {
    if (resultPage >= resultTotalPages) return;
    setLoadMoreLoading(true);
    try {
      const next = resultPage + 1;
      const merged = { ...baseFilters, ...resultFilters };
      const data = await discoverWithFilters(contentType, merged, next);
      setResults(prev => [...prev, ...(data.results || [])]);
      setResultPage(next);
    } catch {}
    finally { setLoadMoreLoading(false); }
  };

  useEffect(() => { loadMoreRef.current = loadMoreResults; });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreRef.current(); },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const restart = () => {
    setStep('type'); setMood(null); setTone(null); setEra(null); setRating(null); setLength(null);
    setTastePool([]); setVisibleCount(INITIAL_VISIBLE); setTastePage(1); setTasteTotalPages(1);
    setTasteFilters({});
    setSelectedTitles(new Set()); setPinnedItems(new Map());
    setTitleSearch(''); setTitleSearchResults([]);
    setResults([]); setTotalResults(0); setError(null); setBroadened(false);
    setBaseFilters({}); setResultFilters({}); setResultPage(1); setResultTotalPages(1);
  };

  const OptionCard = ({ emoji, label, subtitle, onClick }: {
    emoji?: string; label: string; subtitle?: string; onClick: () => void;
  }) => (
    <button onClick={onClick}
      className="group bg-gray-900 hover:bg-netflix-red border border-gray-700 hover:border-netflix-red rounded-xl p-5 text-left transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-netflix-red"
    >
      {emoji && <div className="text-3xl mb-2">{emoji}</div>}
      <div className="text-white font-bold text-base leading-tight">{label}</div>
      {subtitle && <div className="text-gray-400 text-xs mt-1 group-hover:text-red-100">{subtitle}</div>}
    </button>
  );

  const StepHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="text-center mb-8">
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{title}</h2>
      {subtitle && <p className="text-gray-400 text-base">{subtitle}</p>}
    </div>
  );

  const TasteTile = ({ item, onToggle, onRemove }: { item: any; onToggle: () => void; onRemove?: () => void }) => {
    const title = item.title || item.name;
    const isSelected = selectedTitles.has(item.id);
    return (
      <div className="relative">
        <button onClick={onToggle}
          className={`relative w-full rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.03] focus:outline-none ${
            isSelected ? 'ring-4 ring-netflix-red scale-[1.03]' : 'ring-1 ring-gray-700 hover:ring-gray-500'
          }`}
        >
          {item.poster_path
            ? <img src={getImageUrl(item.poster_path, 'w342')} alt={title} className="w-full aspect-[2/3] object-cover" loading="lazy" />
            : <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center"><i className="fas fa-image text-gray-600 text-3xl" /></div>
          }
          {isSelected && (
            <div className="absolute inset-0 bg-netflix-red bg-opacity-20 flex items-start justify-end p-2">
              <div className="bg-netflix-red rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                <i className="fas fa-check text-white text-xs" />
              </div>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
            <p className="text-white text-xs font-semibold truncate">{title}</p>
          </div>
        </button>
        {onRemove && (
          <button onClick={e => { e.stopPropagation(); onRemove(); }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-600 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors z-10"
            aria-label="Remove"
          >
            <i className="fas fa-times text-white text-xs" />
          </button>
        )}
      </div>
    );
  };

  // ─── Results view ───────────────────────────────────────────────────────────
  if (step === 'results') {
    const rf = resultFilters;
    const isMovie = contentType === 'movie';
    const sortBy = rf.sort_by || baseFilters.sort_by;

    // Refinement chip helper
    const Chip = ({ label, icon, active, onClick }: {
      label: string; icon?: string; active: boolean; onClick: () => void;
    }) => (
      <button onClick={onClick}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
          active
            ? 'bg-netflix-red border-netflix-red text-white'
            : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white'
        }`}
      >
        {icon && <i className={`fas ${icon} text-xs`} />}
        {label}
      </button>
    );

    const setSort = (sort: string) => {
      const already = sortBy === sort;
      applyRefinement(already ? {} : { sort_by: sort });
    };

    // Mutually exclusive cert chips — clears all cert keys then sets the chosen one
    const toggleCertRange = (lte: string | null, gte: string | null) => {
      const isActive = lte ? rf['certification.lte'] === lte : rf['certification.gte'] === gte;
      const n = { ...rf };
      delete n['certification.lte']; delete n['certification.gte']; delete n.certification_country;
      if (!isActive) {
        if (lte) { n['certification.lte'] = lte; n.certification_country = 'US'; }
        if (gte) { n['certification.gte'] = gte; n.certification_country = 'US'; }
      }
      applyRefinement(n);
    };

    const toggleRuntime = (key: 'with_runtime.lte' | 'with_runtime.gte', value: number) => {
      const current = rf[key];
      if (current === value) {
        const n = { ...rf }; delete n[key]; applyRefinement(n);
      } else {
        const n = { ...rf };
        delete n['with_runtime.lte']; delete n['with_runtime.gte'];
        applyRefinement({ ...n, [key]: value });
      }
    };

    const dateGteKey = isMovie ? 'primary_release_date.gte' : 'first_air_date.gte';
    const dateLteKey = isMovie ? 'primary_release_date.lte' : 'first_air_date.lte';

    const toggleDateFilter = (key: string, value: string) => {
      const current = rf[key];
      if (current === value) {
        const n = { ...rf }; delete n[key]; applyRefinement(n);
      } else {
        const n = { ...rf };
        // Clear the opposite date key so newer/older don't conflict
        if (key === dateGteKey) delete n[dateLteKey];
        if (key === dateLteKey) delete n[dateGteKey];
        applyRefinement({ ...n, [key]: value });
      }
    };

    return (
      <div className="py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-12 h-12 border-4 border-gray-700 border-t-netflix-red rounded-full animate-spin" />
            <p className="text-white text-lg">Finding your perfect match…</p>
          </div>
        ) : error ? (
          <div className="text-center py-32">
            <p className="text-red-400 text-lg mb-6">{error}</p>
            <button onClick={restart} className="bg-netflix-red hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">Try Again</button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                  {refineLoading ? 'Updating…' : `${totalResults.toLocaleString()} ${isMovie ? 'movies' : 'TV shows'} found`}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {mood?.label}{tone && tone.label !== 'Any style' ? ` · ${tone.label}` : ''}{' · '}{era?.label}{' · '}{rating?.label}
                  {length && isMovie ? ` · ${length.label}` : ''}
                </p>
                {broadened && <p className="text-yellow-400 text-xs mt-1">No exact matches for your taste picks — showing broader results</p>}
              </div>
              <button onClick={restart} className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2 shrink-0">
                <span>↺</span> Start Over
              </button>
            </div>

            {/* Refinement chips */}
            <div className="overflow-x-auto mb-6 pb-4 border-b border-gray-800">
              <div className="flex gap-2 min-w-max">
                <span className="text-gray-500 text-xs self-center mr-1 shrink-0">Refine:</span>

                {/* Sort */}
                <Chip label="Most popular" icon="fa-fire" active={sortBy === 'popularity.desc'} onClick={() => setSort('popularity.desc')} />
                <Chip label="Highest rated" icon="fa-star" active={sortBy === 'vote_average.desc'} onClick={() => setSort('vote_average.desc')} />
                <Chip label="Newest first" icon="fa-sort-amount-down" active={sortBy === (isMovie ? 'primary_release_date.desc' : 'first_air_date.desc')}
                  onClick={() => setSort(isMovie ? 'primary_release_date.desc' : 'first_air_date.desc')} />
                <Chip label="Oldest first" icon="fa-sort-amount-up" active={sortBy === (isMovie ? 'primary_release_date.asc' : 'first_air_date.asc')}
                  onClick={() => setSort(isMovie ? 'primary_release_date.asc' : 'first_air_date.asc')} />

                <span className="text-gray-700 self-center">|</span>

                {/* Date range filters — Show newer / Show older */}
                <Chip label="Show newer" icon="fa-calendar-plus" active={rf[dateGteKey] === '2020-01-01'}
                  onClick={() => toggleDateFilter(dateGteKey, '2020-01-01')} />
                <Chip label="Show older" icon="fa-calendar-minus" active={rf[dateLteKey] === '2010-12-31'}
                  onClick={() => toggleDateFilter(dateLteKey, '2010-12-31')} />

                <span className="text-gray-700 self-center">|</span>

                {/* Age rating — 3 levels for both movies and TV */}
                <span className="text-gray-700 self-center">|</span>
                {isMovie ? <>
                  <Chip label="G / PG" icon="fa-child" active={rf['certification.lte'] === 'PG'}
                    onClick={() => toggleCertRange('PG', null)} />
                  <Chip label="Up to PG-13" icon="fa-user" active={rf['certification.lte'] === 'PG-13'}
                    onClick={() => toggleCertRange('PG-13', null)} />
                  <Chip label="R-rated" icon="fa-exclamation-circle" active={rf['certification.gte'] === 'R'}
                    onClick={() => toggleCertRange(null, 'R')} />
                </> : <>
                  <Chip label="G / PG (TV)" icon="fa-child" active={rf['certification.lte'] === 'TV-PG'}
                    onClick={() => toggleCertRange('TV-PG', null)} />
                  <Chip label="Teen (TV-14)" icon="fa-user" active={rf['certification.lte'] === 'TV-14'}
                    onClick={() => toggleCertRange('TV-14', null)} />
                  <Chip label="Mature (TV-MA)" icon="fa-exclamation-circle" active={rf['certification.gte'] === 'TV-MA'}
                    onClick={() => toggleCertRange(null, 'TV-MA')} />
                </>}

                {/* Runtime */}
                <span className="text-gray-700 self-center">|</span>
                {isMovie ? <>
                  <Chip label="Under 90 min" icon="fa-bolt" active={rf['with_runtime.lte'] === 90} onClick={() => toggleRuntime('with_runtime.lte', 90)} />
                  <Chip label="Under 2 hrs" icon="fa-clock" active={rf['with_runtime.lte'] === 120} onClick={() => toggleRuntime('with_runtime.lte', 120)} />
                  <Chip label="Over 2 hrs" icon="fa-hourglass-half" active={rf['with_runtime.gte'] === 120} onClick={() => toggleRuntime('with_runtime.gte', 120)} />
                </> : <>
                  <Chip label="Short episodes" subtitle="under 30 min" icon="fa-bolt" active={rf['with_runtime.lte'] === 30} onClick={() => toggleRuntime('with_runtime.lte', 30)} />
                  <Chip label="Long episodes" subtitle="45 min+" icon="fa-hourglass-half" active={rf['with_runtime.gte'] === 45} onClick={() => toggleRuntime('with_runtime.gte', 45)} />
                </>}

                {/* Language */}
                <span className="text-gray-700 self-center">|</span>
                <Chip label="English" icon="fa-language" active={rf.with_original_language === 'en'}
                  onClick={() => {
                    const already = rf.with_original_language === 'en';
                    const n = { ...rf };
                    if (already) { delete n.with_original_language; applyRefinement(n); }
                    else applyRefinement({ ...n, with_original_language: 'en' });
                  }}
                />
                <Chip label="Non-English" icon="fa-globe" active={rf.with_original_language === 'xx'}
                  onClick={() => {
                    // TMDB doesn't support "not English" natively, so we cycle through popular non-English languages
                    const already = rf.with_original_language === 'xx';
                    const n = { ...rf };
                    if (already) { delete n.with_original_language; applyRefinement(n); }
                    else {
                      // Remove language filter and add vote_count boost to surface well-known non-English titles
                      delete n.with_original_language;
                      applyRefinement({ ...n, without_original_language: 'en' });
                    }
                  }}
                />

                {/* Popularity/obscurity */}
                <Chip label="Hidden gems" icon="fa-gem" active={rf['vote_count.lte'] === 500}
                  onClick={() => {
                    const already = rf['vote_count.lte'] === 500;
                    if (already) { const n = {...rf}; delete n['vote_count.lte']; applyRefinement(n); }
                    else applyRefinement({ ...rf, 'vote_count.lte': 500 });
                  }}
                />
                <Chip label="Well-known" icon="fa-crown" active={rf['vote_count.gte'] === 1000}
                  onClick={() => {
                    const already = rf['vote_count.gte'] === 1000;
                    if (already) { const n = {...rf}; delete n['vote_count.gte']; applyRefinement(n); }
                    else applyRefinement({ ...rf, 'vote_count.gte': 1000 });
                  }}
                />
              </div>
            </div>

            {refineLoading ? (
              <div className="flex justify-center py-24">
                <div className="w-10 h-10 border-4 border-gray-700 border-t-netflix-red rounded-full animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-24">
                <p className="text-gray-400 text-lg mb-3">Nothing matched those filters.</p>
                <p className="text-gray-500 text-sm mb-6">Try adjusting the refinements above or starting over.</p>
                <button onClick={restart} className="bg-netflix-red hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">Start Over</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {results.map((item: any) => {
                    const title = item.title || item.name;
                    const year = (item.release_date || item.first_air_date || '').slice(0, 4);
                    const ratingVal = item.vote_average ? item.vote_average.toFixed(1) : null;
                    return (
                      <div key={item.id} className="group relative">
                        <a href={createUrl(`/details?type=${contentType}&id=${item.id}`)} className="block">
                          {item.poster_path ? (
                            <div className="relative">
                              <img src={getImageUrl(item.poster_path, 'w500')} alt={title}
                                className="w-full aspect-[2/3] object-cover rounded-lg mb-2 group-hover:scale-105 transition-transform" loading="lazy" />
                              <div className="absolute top-2 right-2 z-10" onClick={e => e.preventDefault()}>
                                <WatchlistButton movieId={item.id} mediaType={contentType} title={title} posterPath={item.poster_path} />
                              </div>
                            </div>
                          ) : (
                            <div className="w-full aspect-[2/3] bg-gray-800 rounded-lg mb-2 flex items-center justify-center">
                              <i className="fas fa-image text-gray-600 text-4xl" />
                            </div>
                          )}
                          <h3 className="text-white font-semibold text-sm truncate group-hover:text-netflix-red transition-colors">{title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {year && <span className="text-gray-400 text-xs">{year}</span>}
                            {ratingVal && <span className="text-yellow-400 text-xs">★ {ratingVal}</span>}
                          </div>
                        </a>
                      </div>
                    );
                  })}
                </div>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-4 mt-6" />
                {loadMoreLoading && (
                  <div className="flex justify-center pb-8">
                    <div className="w-8 h-8 border-4 border-gray-700 border-t-netflix-red rounded-full animate-spin" />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    );
  }

  // ─── Questionnaire wizard ───────────────────────────────────────────────────
  return (
    <div className="min-h-[80vh] flex flex-col">
      <div className="w-full h-1 bg-gray-800 mb-8 rounded-full overflow-hidden">
        <div className="h-full bg-netflix-red transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-4">
        {step !== 'type' && (
          <button onClick={goBack} className="self-start mb-6 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
            ← Back
          </button>
        )}

        {step === 'type' && (
          <>
            <StepHeader title="What are you in the mood for?" subtitle="Let's find you something great to watch" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
              <OptionCard emoji="🎬" label="Movie" subtitle="A single film to enjoy" onClick={() => { setContentType('movie'); setStep('mood'); }} />
              <OptionCard emoji="📺" label="TV Show" subtitle="A series to follow or binge" onClick={() => { setContentType('tv'); setStep('mood'); }} />
            </div>
          </>
        )}

        {step === 'mood' && (
          <>
            <StepHeader title="What's your mood?" subtitle="Pick the vibe you're going for" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-3xl">
              {MOODS.map(m => (
                <OptionCard key={m.label} emoji={m.emoji} label={m.label} onClick={() => { setMood(m); setStep('tone'); }} />
              ))}
            </div>
          </>
        )}

        {step === 'tone' && mood && (
          <>
            <StepHeader
              title={`What kind of ${mood.label.toLowerCase()}?`}
              subtitle="Pick the style that fits what you're after"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-3xl">
              {(TONE_MAP[mood.label] || []).map(t => (
                <OptionCard key={t.label} label={t.label} subtitle={t.subtitle}
                  onClick={() => { setTone(t); setStep('era'); }} />
              ))}
            </div>
          </>
        )}

        {step === 'era' && (
          <>
            <StepHeader title="How new should it be?" subtitle="Pick an era that sounds right" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full max-w-3xl">
              {ERAS.map(e => (
                <OptionCard key={e.label} label={e.label} subtitle={e.subtitle} onClick={() => { setEra(e); setStep('rating'); }} />
              ))}
            </div>
          </>
        )}

        {step === 'rating' && (
          <>
            <StepHeader title="How well-reviewed should it be?" subtitle="Set the bar for what you'll watch" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
              {RATING_OPTIONS.map(r => (
                <OptionCard key={r.label} label={r.label} subtitle={r.subtitle}
                  onClick={() => {
                    setRating(r);
                    if (contentType === 'movie') { setStep('length'); }
                    else { setStep('taste'); loadTasteSamples(contentType, mood!, tone, era!, r, null); }
                  }}
                />
              ))}
            </div>
          </>
        )}

        {step === 'length' && (
          <>
            <StepHeader title="How long do you want to watch?" subtitle="We'll match movies to your schedule" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl">
              {LENGTHS.map(l => (
                <OptionCard key={l.label} label={l.label} subtitle={l.subtitle}
                  onClick={() => { setLength(l); setStep('taste'); loadTasteSamples(contentType, mood!, tone, era!, rating!, l); }}
                />
              ))}
            </div>
          </>
        )}

        {step === 'taste' && (
          <>
            <StepHeader title="Does anything here catch your eye?" subtitle="Select titles that look appealing — or add your own favourites below" />

            {/* Search box */}
            <div className="w-full max-w-4xl mb-6">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none" />
                <input type="text" value={titleSearch} onChange={e => setTitleSearch(e.target.value)}
                  placeholder={`Search for a ${contentType === 'movie' ? 'movie' : 'TV show'} you already know you like…`}
                  className="w-full bg-gray-900 border border-gray-700 focus:border-netflix-red rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder-gray-500 outline-none transition-colors"
                />
                {titleSearchLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-netflix-red rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {titleSearchResults.length > 0 && (
                <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {titleSearchResults.map((item: any) => {
                    const isPinned = pinnedItems.has(item.id);
                    const title = item.title || item.name;
                    return (
                      <button key={item.id} onClick={() => isPinned ? removePinnedItem(item.id) : addPinnedItem(item)}
                        title={isPinned ? `Remove "${title}"` : `Add "${title}"`}
                        className={`relative rounded-lg overflow-hidden transition-all hover:scale-[1.03] focus:outline-none ${
                          isPinned ? 'ring-2 ring-netflix-red opacity-75' : 'ring-1 ring-gray-700 hover:ring-gray-400'
                        }`}
                      >
                        {item.poster_path
                          ? <img src={getImageUrl(item.poster_path, 'w185')} alt={title} className="w-full aspect-[2/3] object-cover" />
                          : <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center"><i className="fas fa-image text-gray-600 text-2xl" /></div>
                        }
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-1.5">
                          <p className="text-white text-xs truncate">{title}</p>
                        </div>
                        <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${isPinned ? 'bg-netflix-red' : 'bg-black bg-opacity-60'}`}>
                          <i className={`fas ${isPinned ? 'fa-check' : 'fa-plus'} text-white text-xs`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pinned items */}
            {pinnedItems.size > 0 && (
              <div className="w-full max-w-4xl mb-6">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Added by you</p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {Array.from(pinnedItems.values()).map(item => (
                    <TasteTile key={item.id} item={item} onToggle={() => toggleTasteSelection(item.id)} onRemove={() => removePinnedItem(item.id)} />
                  ))}
                </div>
              </div>
            )}

            {/* Taste refinement chips */}
            {(() => {
              const tf = tasteFilters;
              const im = contentType === 'movie';
              const tasteSortBy = tf.sort_by;
              const tasteDateGteKey = im ? 'primary_release_date.gte' : 'first_air_date.gte';
              const tasteDateLteKey = im ? 'primary_release_date.lte' : 'first_air_date.lte';

              const TChip = ({ label, icon, active, onClick }: { label: string; icon?: string; active: boolean; onClick: () => void }) => (
                <button onClick={onClick}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
                    active ? 'bg-netflix-red border-netflix-red text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  {icon && <i className={`fas ${icon} text-xs`} />}
                  {label}
                </button>
              );

              const setTasteSort = (sort: string) => {
                const n = { ...tf };
                if (n.sort_by === sort) { delete n.sort_by; refineTaste(n); }
                else refineTaste({ ...n, sort_by: sort });
              };

              const toggleTasteCert = (lte: string | null, gte: string | null) => {
                const isActive = lte ? tf['certification.lte'] === lte : tf['certification.gte'] === gte;
                const n = { ...tf };
                delete n['certification.lte']; delete n['certification.gte']; delete n.certification_country;
                if (!isActive) {
                  if (lte) { n['certification.lte'] = lte; n.certification_country = 'US'; }
                  if (gte) { n['certification.gte'] = gte; n.certification_country = 'US'; }
                }
                refineTaste(n);
              };

              const toggleTasteDate = (key: string, value: string) => {
                const n = { ...tf };
                if (n[key] === value) { delete n[key]; refineTaste(n); }
                else {
                  if (key === tasteDateGteKey) delete n[tasteDateLteKey];
                  if (key === tasteDateLteKey) delete n[tasteDateGteKey];
                  refineTaste({ ...n, [key]: value });
                }
              };

              const toggleTasteRuntime = (key: 'with_runtime.lte' | 'with_runtime.gte', value: number) => {
                const n = { ...tf };
                if (n[key] === value) { delete n[key]; refineTaste(n); }
                else { delete n['with_runtime.lte']; delete n['with_runtime.gte']; refineTaste({ ...n, [key]: value }); }
              };

              return (
                <div className="w-full max-w-4xl mb-5">
                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-2 min-w-max">
                      <span className="text-gray-500 text-xs self-center mr-1 shrink-0">Filter pool:</span>

                      <TChip label="Most popular" icon="fa-fire" active={tasteSortBy === 'popularity.desc'} onClick={() => setTasteSort('popularity.desc')} />
                      <TChip label="Highest rated" icon="fa-star" active={tasteSortBy === 'vote_average.desc'} onClick={() => setTasteSort('vote_average.desc')} />
                      <TChip label="Newest first" icon="fa-sort-amount-down" active={tasteSortBy === (im ? 'primary_release_date.desc' : 'first_air_date.desc')}
                        onClick={() => setTasteSort(im ? 'primary_release_date.desc' : 'first_air_date.desc')} />
                      <TChip label="Oldest first" icon="fa-sort-amount-up" active={tasteSortBy === (im ? 'primary_release_date.asc' : 'first_air_date.asc')}
                        onClick={() => setTasteSort(im ? 'primary_release_date.asc' : 'first_air_date.asc')} />

                      <span className="text-gray-700 self-center">|</span>

                      <TChip label="Show newer" icon="fa-calendar-plus" active={tf[tasteDateGteKey] === '2020-01-01'}
                        onClick={() => toggleTasteDate(tasteDateGteKey, '2020-01-01')} />
                      <TChip label="Show older" icon="fa-calendar-minus" active={tf[tasteDateLteKey] === '2010-12-31'}
                        onClick={() => toggleTasteDate(tasteDateLteKey, '2010-12-31')} />

                      <span className="text-gray-700 self-center">|</span>

                      {im ? <>
                        <TChip label="G / PG" icon="fa-child" active={tf['certification.lte'] === 'PG'} onClick={() => toggleTasteCert('PG', null)} />
                        <TChip label="Up to PG-13" icon="fa-user" active={tf['certification.lte'] === 'PG-13'} onClick={() => toggleTasteCert('PG-13', null)} />
                        <TChip label="R-rated" icon="fa-exclamation-circle" active={tf['certification.gte'] === 'R'} onClick={() => toggleTasteCert(null, 'R')} />
                      </> : <>
                        <TChip label="G / PG (TV)" icon="fa-child" active={tf['certification.lte'] === 'TV-PG'} onClick={() => toggleTasteCert('TV-PG', null)} />
                        <TChip label="Teen (TV-14)" icon="fa-user" active={tf['certification.lte'] === 'TV-14'} onClick={() => toggleTasteCert('TV-14', null)} />
                        <TChip label="Mature (TV-MA)" icon="fa-exclamation-circle" active={tf['certification.gte'] === 'TV-MA'} onClick={() => toggleTasteCert(null, 'TV-MA')} />
                      </>}

                      <span className="text-gray-700 self-center">|</span>

                      {im ? <>
                        <TChip label="Under 90 min" icon="fa-bolt" active={tf['with_runtime.lte'] === 90} onClick={() => toggleTasteRuntime('with_runtime.lte', 90)} />
                        <TChip label="Under 2 hrs" icon="fa-clock" active={tf['with_runtime.lte'] === 120} onClick={() => toggleTasteRuntime('with_runtime.lte', 120)} />
                        <TChip label="Over 2 hrs" icon="fa-hourglass-half" active={tf['with_runtime.gte'] === 120} onClick={() => toggleTasteRuntime('with_runtime.gte', 120)} />
                      </> : <>
                        <TChip label="Short episodes" icon="fa-bolt" active={tf['with_runtime.lte'] === 30} onClick={() => toggleTasteRuntime('with_runtime.lte', 30)} />
                        <TChip label="Long episodes" icon="fa-hourglass-half" active={tf['with_runtime.gte'] === 45} onClick={() => toggleTasteRuntime('with_runtime.gte', 45)} />
                      </>}

                      <span className="text-gray-700 self-center">|</span>

                      <TChip label="English" icon="fa-language" active={tf.with_original_language === 'en'}
                        onClick={() => {
                          const n = { ...tf };
                          if (n.with_original_language === 'en') { delete n.with_original_language; refineTaste(n); }
                          else refineTaste({ ...n, with_original_language: 'en' });
                        }}
                      />
                      <TChip label="Non-English" icon="fa-globe" active={!!tf.without_original_language}
                        onClick={() => {
                          const n = { ...tf };
                          if (n.without_original_language) { delete n.without_original_language; refineTaste(n); }
                          else { delete n.with_original_language; refineTaste({ ...n, without_original_language: 'en' }); }
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Suggestion grid */}
            {tasteLoading ? (
              <div className="flex flex-col items-center gap-4 py-16">
                <div className="w-10 h-10 border-4 border-gray-700 border-t-netflix-red rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Loading suggestions…</p>
              </div>
            ) : tastePool.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-6">Couldn't load suggestions right now.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-4xl mb-4">
                  {tastePool.slice(0, visibleCount).map((item: any) => (
                    <TasteTile key={item.id} item={item} onToggle={() => toggleTasteSelection(item.id)} />
                  ))}
                </div>
                {(visibleCount < tastePool.length || tastePage < tasteTotalPages) && (
                  <button onClick={loadMoreTasteSamples} disabled={tasteLoadingMore}
                    className="mb-6 text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {tasteLoadingMore
                      ? <><div className="w-3 h-3 border-2 border-gray-600 border-t-white rounded-full animate-spin" /> Loading…</>
                      : <><i className="fas fa-chevron-down text-xs" /> Show more options</>
                    }
                  </button>
                )}
              </>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
              <button onClick={() => runSearch(contentType, mood!, tone, era!, rating!, length, Array.from(selectedTitles))}
                className="bg-netflix-red hover:bg-red-700 text-white px-8 py-3 rounded-lg font-bold text-base transition-colors"
              >
                {selectedTitles.size > 0 ? `Find More Like These (${selectedTitles.size} selected) →` : 'Show Me Everything →'}
              </button>
              {selectedTitles.size > 0 && (
                <button onClick={() => runSearch(contentType, mood!, tone, era!, rating!, length, [])}
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Skip — show everything
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
