import { useState, useEffect } from 'react';
import { discoverWithFilters, fetchFromTMDB, getImageUrl, searchMulti } from '../lib/tmdb';
import { createUrl } from '../lib/utils';
import WatchlistButton from './WatchlistButton';

interface MoodOption {
  label: string;
  emoji: string;
  movieGenres: number[];
  tvGenres: number[];
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

type Step = 'type' | 'mood' | 'era' | 'rating' | 'length' | 'taste' | 'results';

function buildFilters(
  contentType: 'movie' | 'tv',
  mood: MoodOption,
  era: EraOption,
  rating: RatingOption,
  length: LengthOption | null,
  companyIds?: number[]
): Record<string, any> {
  const filters: Record<string, any> = {};

  const genres = contentType === 'movie' ? mood.movieGenres : mood.tvGenres;
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

  if (companyIds && companyIds.length > 0) {
    filters.with_companies = companyIds.join('|');
  }

  return filters;
}

export default function FindForm() {
  const [step, setStep] = useState<Step>('type');
  const [contentType, setContentType] = useState<'movie' | 'tv'>('movie');
  const [mood, setMood] = useState<MoodOption | null>(null);
  const [era, setEra] = useState<EraOption | null>(null);
  const [rating, setRating] = useState<RatingOption | null>(null);
  const [length, setLength] = useState<LengthOption | null>(null);

  // Taste pool — full preliminary results
  const [tastePool, setTastePool] = useState<any[]>([]);
  const [tasteLoading, setTasteLoading] = useState(false);
  const [tastePage, setTastePage] = useState(1);
  const [tasteTotalPages, setTasteTotalPages] = useState(1);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [loadingMore, setLoadingMore] = useState(false);

  // Selected IDs (from grid + pinned)
  const [selectedTitles, setSelectedTitles] = useState<Set<number>>(new Set());
  // Manually pinned items added via search
  const [pinnedItems, setPinnedItems] = useState<Map<number, any>>(new Map());

  // Title search on taste step
  const [titleSearch, setTitleSearch] = useState('');
  const [titleSearchResults, setTitleSearchResults] = useState<any[]>([]);
  const [titleSearchLoading, setTitleSearchLoading] = useState(false);

  // Results
  const [results, setResults] = useState<any[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broadened, setBroadened] = useState(false);

  // Debounced title search
  useEffect(() => {
    if (!titleSearch.trim()) {
      setTitleSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setTitleSearchLoading(true);
      try {
        const data = await searchMulti(titleSearch);
        const filtered = (data.results || [])
          .filter((r: any) => r.media_type === contentType)
          .slice(0, 6);
        setTitleSearchResults(filtered);
      } catch {
        setTitleSearchResults([]);
      } finally {
        setTitleSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [titleSearch, contentType]);

  const MOVIE_STEPS: Step[] = ['type', 'mood', 'era', 'rating', 'length', 'taste'];
  const TV_STEPS: Step[] = ['type', 'mood', 'era', 'rating', 'taste'];

  const steps = contentType === 'movie' ? MOVIE_STEPS : TV_STEPS;
  const currentIdx = steps.indexOf(step);
  const progressPercent = step === 'results' ? 100 : ((currentIdx + 1) / (steps.length + 1)) * 100;

  const goBack = () => {
    const idx = steps.indexOf(step);
    if (idx > 0) {
      if (step === 'taste') {
        setSelectedTitles(new Set());
        setPinnedItems(new Map());
        setTitleSearch('');
        setTitleSearchResults([]);
      }
      setStep(steps[idx - 1]);
    }
  };

  const loadTasteSamples = async (
    type: 'movie' | 'tv',
    m: MoodOption,
    e: EraOption,
    r: RatingOption,
    l: LengthOption | null
  ) => {
    setTasteLoading(true);
    setTastePool([]);
    setVisibleCount(INITIAL_VISIBLE);
    setTastePage(1);
    try {
      const filters = buildFilters(type, m, e, r, l);
      const data = await discoverWithFilters(type, filters, 1);
      setTastePool(data.results || []);
      setTasteTotalPages(data.total_pages || 1);
    } catch {
      setTastePool([]);
    } finally {
      setTasteLoading(false);
    }
  };

  const loadMoreTaste = async () => {
    if (visibleCount < tastePool.length) {
      setVisibleCount(v => v + LOAD_MORE_BATCH);
      return;
    }
    if (tastePage >= tasteTotalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = tastePage + 1;
      const filters = buildFilters(contentType, mood!, era!, rating!, length);
      const data = await discoverWithFilters(contentType, filters, nextPage);
      setTastePool(prev => [...prev, ...(data.results || [])]);
      setTastePage(nextPage);
      setVisibleCount(v => v + LOAD_MORE_BATCH);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleTasteSelection = (id: number) => {
    setSelectedTitles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addPinnedItem = (item: any) => {
    setPinnedItems(prev => {
      const next = new Map(prev);
      next.set(item.id, item);
      return next;
    });
    setSelectedTitles(prev => new Set(prev).add(item.id));
    setTitleSearch('');
    setTitleSearchResults([]);
  };

  const removePinnedItem = (id: number) => {
    setPinnedItems(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setSelectedTitles(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const runSearch = async (
    type: 'movie' | 'tv',
    m: MoodOption,
    e: EraOption,
    r: RatingOption,
    l: LengthOption | null,
    pickedIds: number[]
  ) => {
    setLoading(true);
    setError(null);
    setBroadened(false);
    setStep('results');

    try {
      let companyIds: number[] = [];

      if (pickedIds.length > 0) {
        const detailFetches = pickedIds.map(id =>
          fetchFromTMDB(`/${type}/${id}`).catch(() => null)
        );
        const details = await Promise.all(detailFetches);
        details.forEach(d => {
          if (d?.production_companies) {
            d.production_companies.forEach((c: any) => {
              if (!companyIds.includes(c.id)) companyIds.push(c.id);
            });
          }
        });
      }

      const filters = buildFilters(type, m, e, r, l, companyIds);
      const data = await discoverWithFilters(type, filters, 1);

      if ((data.total_results === 0 || !data.results?.length) && companyIds.length > 0) {
        const fallbackFilters = buildFilters(type, m, e, r, l);
        const fallback = await discoverWithFilters(type, fallbackFilters, 1);
        setResults(fallback.results || []);
        setTotalResults(fallback.total_results || 0);
        setBroadened(true);
      } else {
        setResults(data.results || []);
        setTotalResults(data.total_results || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    setStep('type');
    setMood(null);
    setEra(null);
    setRating(null);
    setLength(null);
    setTastePool([]);
    setVisibleCount(INITIAL_VISIBLE);
    setTastePage(1);
    setTasteTotalPages(1);
    setSelectedTitles(new Set());
    setPinnedItems(new Map());
    setTitleSearch('');
    setTitleSearchResults([]);
    setResults([]);
    setTotalResults(0);
    setError(null);
    setBroadened(false);
  };

  const OptionCard = ({
    emoji,
    label,
    subtitle,
    onClick,
  }: {
    emoji?: string;
    label: string;
    subtitle?: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
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

  // Reusable poster tile for the taste step
  const TasteTile = ({
    item,
    onToggle,
    badge,
    onRemove,
  }: {
    item: any;
    onToggle: () => void;
    badge?: string;
    onRemove?: () => void;
  }) => {
    const title = item.title || item.name;
    const isSelected = selectedTitles.has(item.id);
    return (
      <div className="relative">
        <button
          onClick={onToggle}
          className={`relative w-full rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.03] focus:outline-none ${
            isSelected
              ? 'ring-4 ring-netflix-red scale-[1.03]'
              : 'ring-1 ring-gray-700 hover:ring-gray-500'
          }`}
        >
          {item.poster_path ? (
            <img
              src={getImageUrl(item.poster_path, 'w342')}
              alt={title}
              className="w-full aspect-[2/3] object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center">
              <i className="fas fa-image text-gray-600 text-3xl" />
            </div>
          )}
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
          {badge && (
            <div className="absolute top-2 left-2">
              <span className="bg-black bg-opacity-80 text-yellow-400 text-xs px-1.5 py-0.5 rounded font-medium">
                {badge}
              </span>
            </div>
          )}
        </button>
        {onRemove && (
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-600 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors z-10"
            aria-label="Remove"
          >
            <i className="fas fa-times text-white text-xs" />
          </button>
        )}
      </div>
    );
  };

  // Results view
  if (step === 'results') {
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
            <button
              onClick={restart}
              className="bg-netflix-red hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                  {totalResults.toLocaleString()} {contentType === 'movie' ? 'movies' : 'TV shows'} found
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {mood?.label} · {era?.label} · {rating?.label}
                  {length && contentType === 'movie' ? ` · ${length.label}` : ''}
                </p>
                {broadened && (
                  <p className="text-yellow-400 text-xs mt-1">
                    No exact matches for your taste picks — showing broader results
                  </p>
                )}
              </div>
              <button
                onClick={restart}
                className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors flex items-center gap-2 shrink-0"
              >
                <span>↺</span> Start Over
              </button>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-24">
                <p className="text-gray-400 text-lg mb-6">Nothing matched those filters. Try different options.</p>
                <button
                  onClick={restart}
                  className="bg-netflix-red hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Start Over
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {results.map((item: any) => {
                  const title = item.title || item.name;
                  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
                  const ratingVal = item.vote_average ? item.vote_average.toFixed(1) : null;
                  return (
                    <div key={item.id} className="group relative">
                      <a
                        href={createUrl(`/details?type=${contentType}&id=${item.id}`)}
                        className="block"
                      >
                        {item.poster_path ? (
                          <div className="relative">
                            <img
                              src={getImageUrl(item.poster_path, 'w500')}
                              alt={title}
                              className="w-full aspect-[2/3] object-cover rounded-lg mb-2 group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                            <div
                              className="absolute top-2 right-2 z-10"
                              onClick={e => e.preventDefault()}
                            >
                              <WatchlistButton
                                movieId={item.id}
                                mediaType={contentType}
                                title={title}
                                posterPath={item.poster_path}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full aspect-[2/3] bg-gray-800 rounded-lg mb-2 flex items-center justify-center">
                            <i className="fas fa-image text-gray-600 text-4xl" />
                          </div>
                        )}
                        <h3 className="text-white font-semibold text-sm truncate group-hover:text-netflix-red transition-colors">
                          {title}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {year && <span className="text-gray-400 text-xs">{year}</span>}
                          {ratingVal && <span className="text-yellow-400 text-xs">★ {ratingVal}</span>}
                        </div>
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Questionnaire wizard
  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-800 mb-8 rounded-full overflow-hidden">
        <div
          className="h-full bg-netflix-red transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center px-4 py-4">
        {step !== 'type' && (
          <button
            onClick={goBack}
            className="self-start mb-6 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm"
          >
            ← Back
          </button>
        )}

        {/* Step: type */}
        {step === 'type' && (
          <>
            <StepHeader
              title="What are you in the mood for?"
              subtitle="Let's find you something great to watch"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
              <OptionCard
                emoji="🎬"
                label="Movie"
                subtitle="A single film to enjoy"
                onClick={() => { setContentType('movie'); setStep('mood'); }}
              />
              <OptionCard
                emoji="📺"
                label="TV Show"
                subtitle="A series to follow or binge"
                onClick={() => { setContentType('tv'); setStep('mood'); }}
              />
            </div>
          </>
        )}

        {/* Step: mood */}
        {step === 'mood' && (
          <>
            <StepHeader title="What's your mood?" subtitle="Pick the vibe you're going for" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-3xl">
              {MOODS.map(m => (
                <OptionCard
                  key={m.label}
                  emoji={m.emoji}
                  label={m.label}
                  onClick={() => { setMood(m); setStep('era'); }}
                />
              ))}
            </div>
          </>
        )}

        {/* Step: era */}
        {step === 'era' && (
          <>
            <StepHeader title="How new should it be?" subtitle="Pick an era that sounds right" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full max-w-3xl">
              {ERAS.map(e => (
                <OptionCard
                  key={e.label}
                  label={e.label}
                  subtitle={e.subtitle}
                  onClick={() => { setEra(e); setStep('rating'); }}
                />
              ))}
            </div>
          </>
        )}

        {/* Step: rating */}
        {step === 'rating' && (
          <>
            <StepHeader
              title="How well-reviewed should it be?"
              subtitle="Set the bar for what you'll watch"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
              {RATING_OPTIONS.map(r => (
                <OptionCard
                  key={r.label}
                  label={r.label}
                  subtitle={r.subtitle}
                  onClick={() => {
                    setRating(r);
                    if (contentType === 'movie') {
                      setStep('length');
                    } else {
                      setStep('taste');
                      loadTasteSamples(contentType, mood!, era!, r, null);
                    }
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Step: length (movies only) */}
        {step === 'length' && (
          <>
            <StepHeader
              title="How long do you want to watch?"
              subtitle="We'll match movies to your schedule"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl">
              {LENGTHS.map(l => (
                <OptionCard
                  key={l.label}
                  label={l.label}
                  subtitle={l.subtitle}
                  onClick={() => {
                    setLength(l);
                    setStep('taste');
                    loadTasteSamples(contentType, mood!, era!, rating!, l);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Step: taste */}
        {step === 'taste' && (
          <>
            <StepHeader
              title="Does anything here catch your eye?"
              subtitle="Select titles that look appealing — or add your own favourites below"
            />

            {/* Title search box */}
            <div className="w-full max-w-4xl mb-6">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none" />
                <input
                  type="text"
                  value={titleSearch}
                  onChange={e => setTitleSearch(e.target.value)}
                  placeholder={`Search for a ${contentType === 'movie' ? 'movie' : 'TV show'} you already know you like…`}
                  className="w-full bg-gray-900 border border-gray-700 focus:border-netflix-red rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder-gray-500 outline-none transition-colors"
                />
                {titleSearchLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-netflix-red rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Search results */}
              {titleSearchResults.length > 0 && (
                <div className="mt-2 grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {titleSearchResults.map((item: any) => {
                    const isAlreadyPinned = pinnedItems.has(item.id);
                    const title = item.title || item.name;
                    return (
                      <button
                        key={item.id}
                        onClick={() => isAlreadyPinned ? removePinnedItem(item.id) : addPinnedItem(item)}
                        title={isAlreadyPinned ? `Remove "${title}"` : `Add "${title}"`}
                        className={`relative rounded-lg overflow-hidden transition-all hover:scale-[1.03] focus:outline-none ${
                          isAlreadyPinned
                            ? 'ring-2 ring-netflix-red opacity-75'
                            : 'ring-1 ring-gray-700 hover:ring-gray-400'
                        }`}
                      >
                        {item.poster_path ? (
                          <img
                            src={getImageUrl(item.poster_path, 'w185')}
                            alt={title}
                            className="w-full aspect-[2/3] object-cover"
                          />
                        ) : (
                          <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center">
                            <i className="fas fa-image text-gray-600 text-2xl" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-1.5">
                          <p className="text-white text-xs truncate">{title}</p>
                        </div>
                        {isAlreadyPinned && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-netflix-red rounded-full flex items-center justify-center">
                            <i className="fas fa-check text-white text-xs" />
                          </div>
                        )}
                        {!isAlreadyPinned && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-black bg-opacity-60 rounded-full flex items-center justify-center">
                            <i className="fas fa-plus text-white text-xs" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pinned items (added via search) */}
            {pinnedItems.size > 0 && (
              <div className="w-full max-w-4xl mb-6">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Added by you</p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {Array.from(pinnedItems.values()).map(item => (
                    <TasteTile
                      key={item.id}
                      item={item}
                      onToggle={() => toggleTasteSelection(item.id)}
                      onRemove={() => removePinnedItem(item.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Main tile grid */}
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
                    <TasteTile
                      key={item.id}
                      item={item}
                      onToggle={() => toggleTasteSelection(item.id)}
                    />
                  ))}
                </div>

                {/* Show more */}
                {(visibleCount < tastePool.length || tastePage < tasteTotalPages) && (
                  <button
                    onClick={loadMoreTaste}
                    disabled={loadingMore}
                    className="mb-6 text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <div className="w-3 h-3 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
                        Loading…
                      </>
                    ) : (
                      <>
                        <i className="fas fa-chevron-down text-xs" />
                        Show more options
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
              <button
                onClick={() => runSearch(contentType, mood!, era!, rating!, length, Array.from(selectedTitles))}
                className="bg-netflix-red hover:bg-red-700 text-white px-8 py-3 rounded-lg font-bold text-base transition-colors"
              >
                {selectedTitles.size > 0
                  ? `Find More Like These (${selectedTitles.size} selected) →`
                  : 'Show Me Everything →'}
              </button>
              {selectedTitles.size > 0 && (
                <button
                  onClick={() => runSearch(contentType, mood!, era!, rating!, length, [])}
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
