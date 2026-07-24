import { useEffect, useState } from 'react';
import { getPersonDetails, getPersonCombinedCredits, getImageUrl } from '../lib/tmdb';
import { createUrl } from '../lib/utils';

interface Credit {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  poster_path?: string;
  character?: string;
  job?: string;
  department?: string;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
}

interface FilmographySection {
  key: string;
  title: string;
  credits: Credit[];
}

const MAX_VISIBLE = 18;

function dedupeAndSort(credits: Credit[]): Credit[] {
  // A person can appear multiple times for the same title in crew
  // (e.g. Producer + Executive Producer), so only keep the first occurrence.
  const seen = new Set<string>();
  const deduped: Credit[] = [];
  for (const credit of credits) {
    const key = `${credit.media_type}-${credit.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(credit);
  }
  return deduped.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
}

function CreditGrid({ credits, subtitleField }: { credits: Credit[]; subtitleField: 'character' | 'job' }) {
  const visible = credits.slice(0, MAX_VISIBLE);
  const remaining = credits.length - visible.length;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {visible.map((credit) => {
          const title = credit.title || credit.name || 'Untitled';
          const subtitle = subtitleField === 'character' ? credit.character : credit.job;
          const year = (credit.release_date || credit.first_air_date || '').slice(0, 4);

          return (
            <a
              key={`${credit.media_type}-${credit.id}`}
              href={createUrl(`/details?type=${credit.media_type}&id=${credit.id}`)}
              className="group block"
            >
              {credit.poster_path ? (
                <img
                  src={getImageUrl(credit.poster_path, 'w300')}
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
              {subtitle && <p className="text-gray-400 text-xs truncate">{subtitle}</p>}
              {year && <p className="text-gray-500 text-xs">{year}</p>}
            </a>
          );
        })}
      </div>
      {remaining > 0 && (
        <p className="text-gray-500 text-sm mt-3">+{remaining} more</p>
      )}
    </div>
  );
}

export default function PersonHub() {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [person, setPerson] = useState<any | null>(null);
  const [sections, setSections] = useState<FilmographySection[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;

    if (!idParam || Number.isNaN(id)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const [personDetails, credits] = await Promise.all([
          getPersonDetails(id),
          getPersonCombinedCredits(id),
        ]);

        if (!mounted) return;

        if (!personDetails) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        document.title = `${personDetails.name} - NotFlix`;
        setPerson(personDetails);

        const directing = dedupeAndSort(credits.crew.filter((c) => c.job === 'Director'));
        const writing = dedupeAndSort(
          credits.crew.filter((c) => c.job === 'Writer' || c.job === 'Screenplay' || c.job === 'Story')
        );
        const production = dedupeAndSort(
          credits.crew.filter((c) => c.job === 'Producer' || c.job === 'Executive Producer')
        );
        const acting = dedupeAndSort(credits.cast);

        const builtSections: FilmographySection[] = [
          { key: 'directing', title: 'Directing', credits: directing },
          { key: 'writing', title: 'Writing', credits: writing },
          { key: 'production', title: 'Production', credits: production },
          { key: 'acting', title: 'Acting', credits: acting },
        ].filter((section) => section.credits.length > 0);

        setSections(builtSections);
        setLoading(false);
      } catch (error) {
        console.error('Error loading person hub:', error);
        if (mounted) {
          setNotFound(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading person...</p>
        </div>
      </div>
    );
  }

  if (notFound || !person) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-6xl text-red-600 mb-6"></i>
          <h1 className="text-3xl font-bold text-white mb-4">Person Not Found</h1>
          <p className="text-gray-400 mb-8">The requested person could not be found.</p>
          <a href={createUrl('/')} className="btn-primary">
            <i className="fas fa-home mr-2"></i>
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  const bio = person.biography
    ? person.biography.length > 500
      ? `${person.biography.slice(0, 500)}...`
      : person.biography
    : '';

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <section className="flex flex-col md:flex-row gap-8 mb-12">
        <div className="flex-shrink-0">
          {person.profile_path ? (
            <img
              src={getImageUrl(person.profile_path, 'w300')}
              alt={person.name}
              className="w-48 md:w-64 aspect-[2/3] object-cover rounded-lg shadow-2xl"
            />
          ) : (
            <div className="w-48 md:w-64 aspect-[2/3] bg-gray-800 rounded-lg flex items-center justify-center">
              <i className="fas fa-user text-gray-600 text-6xl"></i>
            </div>
          )}
        </div>

        <div className="flex-1 text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">{person.name}</h1>

          {person.known_for_department && (
            <p className="text-netflix-red font-semibold mb-2">{person.known_for_department}</p>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-400 text-sm mb-4">
            {person.birthday && (
              <span>
                <i className="fas fa-birthday-cake mr-2"></i>
                {person.birthday}
                {person.deathday ? ` – ${person.deathday}` : ''}
              </span>
            )}
            {person.place_of_birth && (
              <span>
                <i className="fas fa-map-marker-alt mr-2"></i>
                {person.place_of_birth}
              </span>
            )}
          </div>

          {bio && <p className="text-gray-300 leading-relaxed max-w-3xl">{bio}</p>}
        </div>
      </section>

      {sections.map((section) => (
        <section key={section.key} className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-6">{section.title}</h2>
          <CreditGrid
            credits={section.credits}
            subtitleField={section.key === 'acting' ? 'character' : 'job'}
          />
        </section>
      ))}
    </main>
  );
}
