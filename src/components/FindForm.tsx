import { useState } from 'react';
import { discoverWithFilters, fetchFromTMDB, getImageUrl } from '../lib/tmdb';
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

// Indices to sample from 20 preliminary results for variety
const TASTE_SAMPLE_INDICES = [0, 2, 5, 8, 11, 14, 17, 19];

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

  // Taste sample state
  const [tasteSamples, setTasteSamples] = useState<any[]>([]);
  const [tasteLoading, setTasteLoading] = useState(false);
  const [selectedTitles, setSelectedTitles] = useState<Set<number>>(new Set());

  // Results state
  const [results, setResults] = useState<any[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broadened, setBroadened] = useState(false);

  const MOVIE_STEPS: Step[] = ['type', 'mood', 'era', 'rating', 'length', 'taste'];
  const TV_STEPS: Step[] = ['type', 'mood', 'era', 'rating', 'taste'];

  const steps = contentType === 'movie' ? MOVIE_STEPS : TV_STEPS;
  const currentIdx = steps.indexOf(step);
  const progressPercent = step === 'results' ? 100 : ((currentIdx + 1) / (steps.length + 1)) * 100;

  const goBack = () => {
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
    if (step === 'taste') setSelectedTitles(new Set());
  };

  const loadTasteSamples = async (
    type: 'movie' | 'tv',
    m: MoodOption,
    e: EraOption,
    r: RatingOption,
    l: LengthOption | null
  ) => {
    setTasteLoading(true);
    setTasteSamples([]);
    try {
      const filters = buildFilters(type, m, e, r, l);
      const data = await discoverWithFilters(type, filters, 1);
      const pool: any[] = data.results || [];
      const sampled = TASTE_SAMPLE_INDICES
        .filter(i => i < pool.length)
        .map(i => pool[i])
        .filter(Boolean);
      setTasteSamples(sampled);
    } catch {
      setTasteSamples([]);
    } finally {
      setTasteLoading(false);
    }
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
        // Fall back without company filter
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

  const toggleTasteSelection = (id: number) => {
    setSelectedTitles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const restart = () => {
    setStep('type');
    setMood(null);
    setEra(null);
    setRating(null);
    setLength(null);
    setTasteSamples([]);
    setSelectedTitles(new Set());
    setResults([]);
    setTotalResults(0);
    setError(null);
    setBroadened(false);
  };

  // Shared option card
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
                      // Go to taste step for TV
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
              subtitle="Select titles that appeal to you — or skip to see everything"
            />

            {tasteLoading ? (
              <div className="flex flex-col items-center gap-4 py-16">
                <div className="w-10 h-10 border-4 border-gray-700 border-t-netflix-red rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Loading suggestions…</p>
              </div>
            ) : tasteSamples.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-6">Couldn't load suggestions right now.</p>
                <button
                  onClick={() => runSearch(contentType, mood!, era!, rating!, length, [])}
                  className="bg-netflix-red hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Continue Anyway →
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-4xl mb-8">
                  {tasteSamples.map((item: any) => {
                    const title = item.title || item.name;
                    const isSelected = selectedTitles.has(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleTasteSelection(item.id)}
                        className={`relative rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.03] focus:outline-none ${
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
                          <div className="absolute inset-0 bg-netflix-red bg-opacity-20 flex items-center justify-center">
                            <div className="bg-netflix-red rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                              <i className="fas fa-check text-white text-sm" />
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                          <p className="text-white text-xs font-semibold truncate">{title}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
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
                      None of these — skip
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
