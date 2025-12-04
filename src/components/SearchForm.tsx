import { useState, useEffect } from 'react';
import { fetchFromTMDB, tmdbEndpoints, getImageUrl, fetchGenres, sortByOptions, tvSortByOptions, discoverWithFilters, getAllMovieCertifications, searchActors } from '../lib/tmdb';
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

export default function SearchForm({ basePath = '/' }: SearchFormProps) {
  // Create URL with base path for GitHub Pages
  function createUrl(path: string): string {
    // Remove leading slash from path if it exists
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    
    // Ensure base ends with slash and combine
    const baseWithSlash = basePath.endsWith('/') ? basePath : `${basePath}/`;
    
    return `${baseWithSlash}${cleanPath}`;
  }
  
  // Get sectionId from URL params if present
  const getSectionIdFromUrl = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('sectionId') || '';
    }
    return '';
  };
  
  const [query, setQuery] = useState('');
  const [sectionId, setSectionId] = useState(getSectionIdFromUrl());
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMode, setSearchMode] = useState<'search' | 'discover'>('search');
  
  // Filter state
  const [filters, setFilters] = useState({
    mediaType: 'all' as 'all' | 'movie' | 'tv',
    genres: [] as number[],
    startYear: '' as string | number,
    endYear: '' as string | number,
    minRating: '' as string | number,
    certification: '' as string,
    actors: [] as number[], // Actor IDs
    sortBy: 'popularity.desc' as string
  });
  
  const [availableGenres, setAvailableGenres] = useState<{ id: number; name: string }[]>([]);
  const [availableCertifications, setAvailableCertifications] = useState<{ certification: string; meaning: string; order: number }[]>([]);
  const [loadingGenres, setLoadingGenres] = useState(false);
  const [loadingCertifications, setLoadingCertifications] = useState(false);
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showRatingDropdown, setShowRatingDropdown] = useState(false);
  const [showCertificationDropdown, setShowCertificationDropdown] = useState(false);
  
  // Actor search state
  const [actorSearchQuery, setActorSearchQuery] = useState('');
  const [actorSearchResults, setActorSearchResults] = useState<{ id: number; name: string; profile_path?: string; known_for_department?: string }[]>([]);
  const [searchingActors, setSearchingActors] = useState(false);
  const [selectedActors, setSelectedActors] = useState<{ id: number; name: string; profile_path?: string }[]>([]);
  const [showActorDropdown, setShowActorDropdown] = useState(false);
  
  // Streams/Torrent state
  const [showStreams, setShowStreams] = useState(false);
  const [torrentStreams, setTorrentStreams] = useState<Record<string, any[]>>({});
  const [loadingStreams, setLoadingStreams] = useState<Record<string, boolean>>({});
  // Direct torrent search (independent of TMDB)
  const [directTorrentResults, setDirectTorrentResults] = useState<any[]>([]);
  const [loadingDirectTorrents, setLoadingDirectTorrents] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // If streams mode is active, search torrents directly
    if (showStreams && query.trim()) {
      setIsLoading(true);
      setHasSearched(true);
      setSearchMode('search');
      
      try {
        // Determine category based on filters or default to Movies
        const category = filters.mediaType === 'tv' ? 'TV' : 'Movies';
        await searchTorrentsDirectly(query.trim(), category);
      } catch (error) {
        console.error('Torrent search error:', error);
        setDirectTorrentResults([]);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // If no query and no filters, don't search
    if (!query.trim() && !hasActiveFilters) return;
    
    setIsLoading(true);
    setHasSearched(true);
    
    try {
      // If there's a text query, use search API
      if (query.trim()) {
        setSearchMode('search');
        // Always include adult content in search to show all available results
        // Users can filter results client-side if needed
        const data = await fetchFromTMDB(tmdbEndpoints.search, {
          query: query.trim(),
          include_adult: true
        });
        
        // Filter out person results and only keep movies and TV shows
        const movieTvResults = data.results.filter(
          (item: SearchResult) => item.media_type === 'movie' || item.media_type === 'tv'
        );
        
        setAllResults(movieTvResults);
      } else {
        // No query but filters are set - use discover API
        setSearchMode('discover');
        await handleDiscover();
      }
    } catch (error) {
      console.error('Search error:', error);
      setAllResults([]);
      setFilteredResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscover = async () => {
    if (!hasActiveFilters) return;
    
    setIsLoading(true);
    setHasSearched(true);
    setSearchMode('discover');
    
    try {
      // Build TMDB filters
      const tmdbFilters: TMDBFilters = {};
      
      // Media type is required for discover
      const mediaType = filters.mediaType === 'all' ? 'movie' : filters.mediaType;
      tmdbFilters.media_type = mediaType;
      
      // Genres
      if (filters.genres.length > 0) {
        tmdbFilters.with_genres = filters.genres;
      }
      
      // Year range
      if (filters.startYear || filters.endYear) {
        const startYear = filters.startYear ? (typeof filters.startYear === 'string' ? parseInt(filters.startYear) : filters.startYear) : undefined;
        const endYear = filters.endYear ? (typeof filters.endYear === 'string' ? parseInt(filters.endYear) : filters.endYear) : undefined;
        
        if (startYear && !isNaN(startYear) && endYear && !isNaN(endYear) && startYear === endYear) {
          // Single year selected
          if (mediaType === 'movie') {
            tmdbFilters.primary_release_year = startYear;
          } else {
            tmdbFilters.first_air_date_year = startYear;
          }
        } else {
          // Year range
          if (startYear && !isNaN(startYear)) {
            if (mediaType === 'movie') {
              tmdbFilters['primary_release_date.gte'] = `${startYear}-01-01`;
            } else {
              tmdbFilters['first_air_date.gte'] = `${startYear}-01-01`;
            }
          }
          if (endYear && !isNaN(endYear)) {
            if (mediaType === 'movie') {
              tmdbFilters['primary_release_date.lte'] = `${endYear}-12-31`;
            } else {
              tmdbFilters['first_air_date.lte'] = `${endYear}-12-31`;
            }
          }
        }
      }
      
      // Rating
      if (filters.minRating) {
        const minRating = typeof filters.minRating === 'string' ? parseFloat(filters.minRating) : filters.minRating;
        if (!isNaN(minRating)) {
          tmdbFilters['vote_average.gte'] = minRating;
        }
      }
      
      // Certification (only for movies)
      if (filters.certification && mediaType === 'movie') {
        tmdbFilters.certification = filters.certification;
        tmdbFilters.certification_country = 'US'; // Default to US certifications
      }
      
      // Actors
      if (filters.actors.length > 0) {
        tmdbFilters.with_cast = filters.actors;
      }
      
      // Sort
      if (filters.sortBy && filters.sortBy !== 'relevance') {
        // Map our sort options to TMDB sort options
        const sortMap: Record<string, string> = {
          'rating.desc': 'vote_average.desc',
          'rating.asc': 'vote_average.asc',
          'year.desc': mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
          'year.asc': mediaType === 'movie' ? 'primary_release_date.asc' : 'first_air_date.asc',
          'title.asc': mediaType === 'movie' ? 'original_title.asc' : 'name.asc',
          'title.desc': mediaType === 'movie' ? 'original_title.desc' : 'name.desc',
        };
        tmdbFilters.sort_by = sortMap[filters.sortBy] || 'popularity.desc';
      } else {
        tmdbFilters.sort_by = 'popularity.desc';
      }
      
      // Discover for the selected media type
      let results = await discoverWithFilters(mediaType, tmdbFilters, 100);
      
      // Ensure all results have media_type set
      results = results.map(item => ({
        ...item,
        media_type: item.media_type || mediaType
      }));
      
      // If "all" was selected, also get the other type
      if (filters.mediaType === 'all') {
        const otherType: 'movie' | 'tv' = mediaType === 'movie' ? 'tv' : 'movie';
        const otherFilters: TMDBFilters = { ...tmdbFilters, media_type: otherType };
        // Adjust year field for the other type if we have a single year
        if (filters.startYear && filters.endYear && filters.startYear === filters.endYear) {
          const year = typeof filters.startYear === 'string' ? parseInt(filters.startYear) : filters.startYear;
          if (!isNaN(year)) {
            delete otherFilters.primary_release_year;
            delete otherFilters.first_air_date_year;
            if (otherType === 'movie') {
              otherFilters.primary_release_year = year;
            } else {
              otherFilters.first_air_date_year = year;
            }
          }
        }
        const otherResults = await discoverWithFilters(otherType, otherFilters, 100);
        // Ensure other results also have media_type set
        const typedOtherResults = otherResults.map(item => ({
          ...item,
          media_type: item.media_type || otherType
        }));
        results = [...results, ...typedOtherResults];
      }
      
      setAllResults(results);
    } catch (error) {
      console.error('Discover error:', error);
      setAllResults([]);
      setFilteredResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = (item: SearchResult) => {
    return item.media_type === 'movie' ? item.title : item.name;
  };

  const getDate = (item: SearchResult) => {
    const date = item.media_type === 'movie' ? item.release_date : item.first_air_date;
    if (!date) return '';
    return new Date(date).getFullYear().toString();
  };

  // Direct torrent search (independent of TMDB)
  const searchTorrentsDirectly = async (searchQuery: string, category: 'Movies' | 'TV' = 'Movies'): Promise<any[]> => {
    if (!searchQuery.trim()) {
      return [];
    }

    setLoadingDirectTorrents(true);
    
    try {
      // Clean up search query
      let cleanQuery = searchQuery
        .replace(/[^\w\s'-]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
      
      console.log(`🔍 Direct torrent search for: "${cleanQuery}" (category: ${category})`);
      
      // Variable to hold successful data
      let data: any = null;
      
      // Direct torrent search using public APIs (no external libraries needed)
      console.log('🔍 Starting direct torrent search via public APIs...');
      
      // Try multiple public torrent search APIs
      const corsProxies = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest=',
      ];
      
      // Try searching via public torrent search services
      const searchEndpoints = [
        // Try a public torrent search API
        {
          name: 'torrentapi',
          url: `https://torrentapi.org/pubapi_v2.php?mode=search&search_string=${encodeURIComponent(cleanQuery)}&format=json_extended&app_id=torrent_search`,
          parse: (responseData: any) => {
            if (responseData.torrent_results && Array.isArray(responseData.torrent_results)) {
              return responseData.torrent_results.map((torrent: any) => ({
                title: torrent.title || 'Unknown',
                magnet: torrent.download || torrent.magnet || '',
                size: torrent.size ? formatBytes(torrent.size) : '',
                seeders: torrent.seeders || 0,
                leechers: torrent.leechers || 0,
                category: torrent.category || category,
                provider: 'torrentapi'
              })).filter((t: any) => t.magnet && t.magnet.startsWith('magnet:'));
            }
            return [];
          }
        }
      ];
      
      // Try each endpoint with CORS proxies
      for (const endpoint of searchEndpoints) {
        for (const proxy of corsProxies) {
          try {
            const apiUrl = proxy ? `${proxy}${encodeURIComponent(endpoint.url)}` : endpoint.url;
            console.log(`Trying ${endpoint.name} via ${proxy ? 'CORS proxy' : 'direct'}...`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(apiUrl, {
              method: 'GET',
              headers: { 'Accept': 'application/json' },
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const responseData = await response.json();
              const parsed = endpoint.parse(responseData);
              
              if (parsed && parsed.length > 0) {
                data = parsed;
                console.log(`✅ Found ${data.length} torrents from ${endpoint.name}`);
                break; // Success!
              }
            }
          } catch (error: any) {
            if (error.name !== 'AbortError') {
              console.warn(`${endpoint.name} failed:`, error.message);
            }
            continue;
          }
        }
        
        if (data && data.length > 0) break; // Exit if we got results
      }
      
      // Helper function to format bytes
      function formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
      }
      
      // If still no data, try HTML-based search via proxy (less reliable but might work)
      if (!data || data.length === 0) {
        console.log('Trying HTML-based search via proxy...');
        
        // Try 1337x search via proxy
        const searchUrl = `https://1337x.to/search/${encodeURIComponent(cleanQuery)}/1/`;
        
        for (const proxy of corsProxies) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(`${proxy}${encodeURIComponent(searchUrl)}`, {
              method: 'GET',
              headers: { 'Accept': 'text/html' },
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const html = await response.text();
              
              // Extract magnet links using regex
              const magnetRegex = /magnet:\?xt=urn:btih:[a-zA-Z0-9]{40}[^"'\s<>]*/gi;
              const magnetMatches = html.match(magnetRegex);
              
              if (magnetMatches && magnetMatches.length > 0) {
                console.log(`✅ Found ${magnetMatches.length} magnet links in HTML`);
                
                // Try to extract titles (basic approach)
                const titleRegex = /<a[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/a>/gi;
                const titles: string[] = [];
                let match;
                while ((match = titleRegex.exec(html)) !== null && titles.length < magnetMatches.length) {
                  const title = match[1].trim();
                  if (title && title.length > 3 && title.length < 200) {
                    titles.push(title);
                  }
                }
                
                data = magnetMatches.slice(0, 20).map((magnet, i) => ({
                  title: titles[i] || `Torrent ${i + 1} - ${cleanQuery}`,
                  magnet: magnet,
                  size: '',
                  seeders: 0,
                  leechers: 0,
                  category: category,
                  provider: '1337x'
                }));
                
                if (data.length > 0) {
                  console.log(`✅ Successfully extracted ${data.length} torrents from HTML`);
                  break;
                }
              }
            }
          } catch (error: any) {
            if (error.name !== 'AbortError') {
              console.warn(`HTML search via ${proxy} failed:`, error.message);
            }
            continue;
          }
        }
      }
      
      // Process and format results
      if (!data || data.length === 0) {
        console.warn(`No torrent data retrieved`);
        setLoadingDirectTorrents(false);
        setDirectTorrentResults([]);
        return [];
      }

      // Format streams with quality extraction
      const formattedStreams = data.map((torrent: any) => ({
        title: torrent.title,
        quality: extractQuality(torrent.title),
        size: torrent.size,
        magnet: torrent.magnet,
        seeders: torrent.seeders || 0,
        leechers: torrent.leechers || 0,
        category: torrent.category || category,
        provider: torrent.provider || 'torrent-search-api',
      }));

      // Sort by seeders (highest first)
      formattedStreams.sort((a: any, b: any) => b.seeders - a.seeders);
      
      setLoadingDirectTorrents(false);
      setDirectTorrentResults(formattedStreams);
      return formattedStreams;
    } catch (error) {
      console.error('Error in direct torrent search:', error);
      setLoadingDirectTorrents(false);
      setDirectTorrentResults([]);
      return [];
    }
  };

  // Fetch torrent streams using Torrent Search API (for TMDB results - kept for backward compatibility)
  // API: https://itorrentsearch.vercel.app/api/{site}/{query}/{page}
  const fetchTorrentStreams = async (tmdbId: number, type: 'movie' | 'tv', season?: number, episode?: number): Promise<any[]> => {
    const key = `${type}-${tmdbId}${season && episode ? `-${season}-${episode}` : ''}`;
    
    // Set loading state
    setLoadingStreams(prev => ({ ...prev, [key]: true }));
    
    try {
      // Get title from TMDB to use as search query
      let searchQuery: string = '';
      try {
        const detailsEndpoint = type === 'movie' 
          ? `/movie/${tmdbId}`
          : `/tv/${tmdbId}`;
        const details = await fetchFromTMDB(detailsEndpoint);
        searchQuery = type === 'movie' ? details.title : details.name;
        
        // For TV shows, add season/episode info to search
        if (type === 'tv' && season && episode) {
          searchQuery = `${searchQuery} S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
        }
        
        console.log(`Searching torrents for: ${searchQuery}`);
      } catch (error) {
        console.error('Error fetching title from TMDB:', error);
        setLoadingStreams(prev => ({ ...prev, [key]: false }));
        setTorrentStreams(prev => ({ ...prev, [key]: [] }));
        return [];
      }

      if (!searchQuery) {
        console.warn(`No title found for ${type} ${tmdbId}`);
        setLoadingStreams(prev => ({ ...prev, [key]: false }));
        setTorrentStreams(prev => ({ ...prev, [key]: [] }));
        return [];
      }

      // Use direct search function
      const category = type === 'movie' ? 'Movies' : 'TV';
      const results = await searchTorrentsDirectly(searchQuery, category);
      
      if (results.length > 0) {
        setTorrentStreams(prev => ({ ...prev, [key]: results }));
        setLoadingStreams(prev => ({ ...prev, [key]: false }));
        return results;
      } else {
        setTorrentStreams(prev => ({ ...prev, [key]: [] }));
        setLoadingStreams(prev => ({ ...prev, [key]: false }));
        return [];
      }
    } catch (error) {
      console.error('Error fetching torrent streams:', error);
      setLoadingStreams(prev => ({ ...prev, [key]: false }));
      setTorrentStreams(prev => ({ ...prev, [key]: [] }));
      return [];
    }
  };

  // Helper functions to extract info from stream titles
  const extractQuality = (title: string): string => {
    const qualityMatch = title.match(/\b(4K|2160p|1080p|720p|480p|360p|HD|SD)\b/i);
    return qualityMatch ? qualityMatch[1] : 'Unknown';
  };

  const extractSize = (title: string): string => {
    const sizeMatch = title.match(/(\d+\.?\d*)\s*(GB|MB|GiB|MiB)/i);
    return sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : '';
  };

  const extractSeeders = (title: string): number => {
    const seederMatch = title.match(/(\d+)\s*seed/i);
    return seederMatch ? parseInt(seederMatch[1]) : 0;
  };

  // Auto-search if sectionId is provided in URL - fetch filters and apply them
  useEffect(() => {
    const loadSectionFilters = async () => {
      if (!sectionId || hasSearched || !isSupabaseConfigured() || !supabase) return;
      
      try {
        // Fetch the section from homepage_sections
        const { data: section, error } = await supabase
          .from('homepage_sections')
          .select('id, title, config')
          .eq('id', sectionId)
          .single();
        
        if (error || !section) {
          console.error('Error fetching section:', error);
          return;
        }
        
        // Check if section has TMDB filters
        if (section.config?.tmdb_filters) {
          const tmdbFilters = section.config.tmdb_filters as TMDBFilters;
          
          // Apply filters to the filter state
          if (tmdbFilters.media_type) {
            setFilters(prev => ({
              ...prev,
              mediaType: tmdbFilters.media_type === 'movie' ? 'movie' : tmdbFilters.media_type === 'tv' ? 'tv' : 'all',
            }));
          }
          
          if (tmdbFilters.with_genres && Array.isArray(tmdbFilters.with_genres)) {
            setFilters(prev => ({
              ...prev,
              genres: tmdbFilters.with_genres!,
            }));
          }
          
          if (tmdbFilters['vote_average.gte']) {
            setFilters(prev => ({
              ...prev,
              minRating: tmdbFilters['vote_average.gte']!,
            }));
          }
          
          if (tmdbFilters.certification) {
            setFilters(prev => ({
              ...prev,
              certification: tmdbFilters.certification!,
            }));
          }
          
          if (tmdbFilters.sort_by) {
            setFilters(prev => ({
              ...prev,
              sortBy: tmdbFilters.sort_by!,
            }));
          }
          
          // Handle year filters
          if (tmdbFilters.primary_release_year) {
            const year = tmdbFilters.primary_release_year;
            setFilters(prev => ({
              ...prev,
              startYear: year,
              endYear: year,
            }));
          } else if (tmdbFilters['primary_release_date.gte'] || tmdbFilters['primary_release_date.lte']) {
            const startYear = tmdbFilters['primary_release_date.gte'] 
              ? new Date(tmdbFilters['primary_release_date.gte']).getFullYear() 
              : '';
            const endYear = tmdbFilters['primary_release_date.lte'] 
              ? new Date(tmdbFilters['primary_release_date.lte']).getFullYear() 
              : '';
            setFilters(prev => ({
              ...prev,
              startYear,
              endYear,
            }));
          }
          
          if (tmdbFilters.first_air_date_year) {
            const year = tmdbFilters.first_air_date_year;
            setFilters(prev => ({
              ...prev,
              startYear: year,
              endYear: year,
            }));
          } else if (tmdbFilters['first_air_date.gte'] || tmdbFilters['first_air_date.lte']) {
            const startYear = tmdbFilters['first_air_date.gte'] 
              ? new Date(tmdbFilters['first_air_date.gte']).getFullYear() 
              : '';
            const endYear = tmdbFilters['first_air_date.lte'] 
              ? new Date(tmdbFilters['first_air_date.lte']).getFullYear() 
              : '';
            setFilters(prev => ({
              ...prev,
              startYear,
              endYear,
            }));
          }
          
          // Use discover API with the section's filters
          setSearchMode('discover');
          setIsLoading(true);
          setHasSearched(true);
          
          const mediaType = tmdbFilters.media_type || 'movie';
          const results = await discoverWithFilters(mediaType, tmdbFilters, 100);
          
          // Ensure all results have media_type set
          const typedResults = results.map(item => ({
            ...item,
            media_type: item.media_type || mediaType
          }));
          
          setAllResults(typedResults);
          setIsLoading(false);
        } else {
          // No filters - this shouldn't happen for auto-generated categories, but handle it
          console.warn('Section has no TMDB filters');
        }
      } catch (error) {
        console.error('Error loading section filters:', error);
        setIsLoading(false);
      }
    };
    
    loadSectionFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  // Load genres and certifications on mount
  useEffect(() => {
    const loadGenres = async () => {
      setLoadingGenres(true);
      try {
        const [movieGenres, tvGenres] = await Promise.all([
          fetchGenres('movie'),
          fetchGenres('tv')
        ]);
        // Combine and deduplicate genres
        const allGenres = [...movieGenres];
        tvGenres.forEach(tvGenre => {
          if (!allGenres.find(g => g.id === tvGenre.id)) {
            allGenres.push(tvGenre);
          }
        });
        setAvailableGenres(allGenres.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error('Error loading genres:', error);
      } finally {
        setLoadingGenres(false);
      }
    };
    
    const loadCertifications = async () => {
      setLoadingCertifications(true);
      try {
        const certs = await getAllMovieCertifications();
        setAvailableCertifications(certs);
      } catch (error) {
        console.error('Error loading certifications:', error);
      } finally {
        setLoadingCertifications(false);
      }
    };
    
    loadGenres();
    loadCertifications();
  }, []);

  // Auto-fetch torrent streams when streams mode is active
  // Removed: Auto-fetch streams for TMDB results
  // Now using direct torrent search when streams mode is active (independent of TMDB)

  // Apply filters to results whenever filters or allResults change
  // For search mode, apply client-side filters. For discover mode, results are already filtered.
  useEffect(() => {
    if (allResults.length === 0) {
      setFilteredResults([]);
      return;
    }

    // If using discover API, results are already filtered, just apply sorting if needed
    if (searchMode === 'discover') {
      let filtered = [...allResults];
      
      // Only apply sorting if not already sorted by TMDB
      if (filters.sortBy && filters.sortBy !== 'relevance' && filters.sortBy !== 'popularity.desc') {
        filtered.sort((a, b) => {
          switch (filters.sortBy) {
            case 'rating.desc':
              return b.vote_average - a.vote_average;
            case 'rating.asc':
              return a.vote_average - b.vote_average;
            case 'year.desc': {
              const aDate = a.media_type === 'movie' ? a.release_date : a.first_air_date;
              const bDate = b.media_type === 'movie' ? b.release_date : b.first_air_date;
              if (!aDate) return 1;
              if (!bDate) return -1;
              return new Date(bDate).getTime() - new Date(aDate).getTime();
            }
            case 'year.asc': {
              const aDate = a.media_type === 'movie' ? a.release_date : a.first_air_date;
              const bDate = b.media_type === 'movie' ? b.release_date : b.first_air_date;
              if (!aDate) return 1;
              if (!bDate) return -1;
              return new Date(aDate).getTime() - new Date(bDate).getTime();
            }
            case 'title.asc': {
              const aTitle = a.media_type === 'movie' ? a.title : a.name;
              const bTitle = b.media_type === 'movie' ? b.title : b.name;
              return (aTitle || '').localeCompare(bTitle || '');
            }
            case 'title.desc': {
              const aTitle = a.media_type === 'movie' ? a.title : a.name;
              const bTitle = b.media_type === 'movie' ? b.title : b.name;
              return (bTitle || '').localeCompare(aTitle || '');
            }
            default:
              return 0;
          }
        });
      }
      
      setFilteredResults(filtered);
      return;
    }

    // For search mode, apply all filters client-side
    let filtered = [...allResults];

    // Filter by media type
    if (filters.mediaType !== 'all') {
      filtered = filtered.filter(item => item.media_type === filters.mediaType);
    }

    // Filter by year range
    if (filters.startYear || filters.endYear) {
      const startYear = filters.startYear ? (typeof filters.startYear === 'string' ? parseInt(filters.startYear) : filters.startYear) : undefined;
      const endYear = filters.endYear ? (typeof filters.endYear === 'string' ? parseInt(filters.endYear) : filters.endYear) : undefined;
      
      if (startYear && !isNaN(startYear) || endYear && !isNaN(endYear)) {
        filtered = filtered.filter(item => {
          const date = item.media_type === 'movie' ? item.release_date : item.first_air_date;
          if (!date) return false;
          const itemYear = new Date(date).getFullYear();
          
          if (startYear && endYear && startYear === endYear) {
            // Single year
            return itemYear === startYear;
          } else {
            // Year range
            const meetsStart = !startYear || itemYear >= startYear;
            const meetsEnd = !endYear || itemYear <= endYear;
            return meetsStart && meetsEnd;
          }
        });
      }
    }

    // Filter by minimum rating
    if (filters.minRating) {
      const minRating = typeof filters.minRating === 'string' ? parseFloat(filters.minRating) : filters.minRating;
      if (!isNaN(minRating)) {
        filtered = filtered.filter(item => item.vote_average >= minRating);
      }
    }

    // Sort results
    if (filters.sortBy !== 'relevance') {
      filtered.sort((a, b) => {
        switch (filters.sortBy) {
          case 'rating.desc':
            return b.vote_average - a.vote_average;
          case 'rating.asc':
            return a.vote_average - b.vote_average;
          case 'year.desc': {
            const aDate = a.media_type === 'movie' ? a.release_date : a.first_air_date;
            const bDate = b.media_type === 'movie' ? b.release_date : b.first_air_date;
            if (!aDate) return 1;
            if (!bDate) return -1;
            return new Date(bDate).getTime() - new Date(aDate).getTime();
          }
          case 'year.asc': {
            const aDate = a.media_type === 'movie' ? a.release_date : a.first_air_date;
            const bDate = b.media_type === 'movie' ? b.release_date : b.first_air_date;
            if (!aDate) return 1;
            if (!bDate) return -1;
            return new Date(aDate).getTime() - new Date(bDate).getTime();
          }
          case 'title.asc': {
            const aTitle = a.media_type === 'movie' ? a.title : a.name;
            const bTitle = b.media_type === 'movie' ? b.title : b.name;
            return (aTitle || '').localeCompare(bTitle || '');
          }
          case 'title.desc': {
            const aTitle = a.media_type === 'movie' ? a.title : a.name;
            const bTitle = b.media_type === 'movie' ? b.title : b.name;
            return (bTitle || '').localeCompare(aTitle || '');
          }
          default:
            return 0;
        }
      });
    }

    setFilteredResults(filtered);
  }, [filters, allResults, searchMode]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    // Close certification dropdown if media type changes to TV (certification only applies to movies)
    if (key === 'mediaType' && value === 'tv') {
      setShowCertificationDropdown(false);
      setFilters(prev => ({ ...prev, certification: '' }));
    }
  };

  const clearFilters = () => {
    setFilters({
      mediaType: 'all',
      genres: [],
      startYear: '',
      endYear: '',
      minRating: '',
      certification: '',
      actors: [],
      sortBy: 'popularity.desc'
    });
    setShowGenreDropdown(false);
    setShowYearDropdown(false);
    setShowRatingDropdown(false);
    setShowCertificationDropdown(false);
    setShowActorDropdown(false);
    setSelectedActors([]);
    setActorSearchQuery('');
    setActorSearchResults([]);
  };

  // Handle actor search
  const handleActorSearch = async (query: string) => {
    setActorSearchQuery(query);
    if (!query.trim()) {
      setActorSearchResults([]);
      return;
    }
    
    setSearchingActors(true);
    try {
      const results = await searchActors(query);
      setActorSearchResults(results);
    } catch (error) {
      console.error('Error searching actors:', error);
      setActorSearchResults([]);
    } finally {
      setSearchingActors(false);
    }
  };

  // Add actor to selected list
  const addActor = (actor: { id: number; name: string; profile_path?: string }) => {
    if (!selectedActors.find(a => a.id === actor.id)) {
      setSelectedActors([...selectedActors, actor]);
      setFilters(prev => ({
        ...prev,
        actors: [...prev.actors, actor.id]
      }));
    }
    setActorSearchQuery('');
    setActorSearchResults([]);
  };

  // Remove actor from selected list
  const removeActor = (actorId: number) => {
    setSelectedActors(selectedActors.filter(a => a.id !== actorId));
    setFilters(prev => ({
      ...prev,
      actors: prev.actors.filter(id => id !== actorId)
    }));
  };

  const hasActiveFilters = filters.mediaType !== 'all' || 
    filters.genres.length > 0 || 
    filters.startYear !== '' || 
    filters.endYear !== '' ||
    filters.minRating !== '' || 
    filters.certification !== '' ||
    filters.actors.length > 0 ||
    (filters.sortBy !== 'relevance' && filters.sortBy !== 'popularity.desc');

  return (
    <div className="w-full">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for movies, TV shows..."
              className="w-full px-4 py-3 text-lg bg-gray-800 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent pr-16"
            />
            <button 
              type="submit"
              disabled={isLoading || (!query.trim() && !hasActiveFilters)}
              className="absolute right-2 top-2 bottom-2 px-6 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <i className="fas fa-search"></i>
              )}
            </button>
          </div>
          {hasActiveFilters && !query.trim() && (
            <button
              type="button"
              onClick={() => handleDiscover()}
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <i className="fas fa-compass mr-2"></i>
              Discover
            </button>
          )}
        </div>
      </form>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Searching...</p>
          </div>
        </div>
      )}

      {/* Filter Panel - Always Visible */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 md:gap-4">
            {/* Media Type - Button Selectors - Wider Column */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-white mb-2 text-xs md:text-sm font-semibold">Media Type</label>
              <div className="flex gap-1 md:gap-1.5 flex-nowrap">
                <button
                  type="button"
                  onClick={() => handleFilterChange('mediaType', 'all')}
                  className={`px-2.5 py-2 md:px-3 md:py-2 rounded transition-colors text-xs md:text-sm whitespace-nowrap ${
                    filters.mediaType === 'all'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('mediaType', 'movie')}
                  className={`px-2.5 py-2 md:px-3 md:py-2 rounded transition-colors text-xs md:text-sm whitespace-nowrap ${
                    filters.mediaType === 'movie'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  Movies
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('mediaType', 'tv')}
                  className={`px-2.5 py-2 md:px-3 md:py-2 rounded transition-colors text-xs md:text-sm whitespace-nowrap ${
                    filters.mediaType === 'tv'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                >
                  TV Shows
                </button>
                <button
                  type="button"
                  onClick={() => setShowStreams(!showStreams)}
                  className={`px-2.5 py-2 md:px-3 md:py-2 rounded transition-colors text-xs md:text-sm whitespace-nowrap ${
                    showStreams
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
                  title="Show torrent streams"
                >
                  <i className="fas fa-stream mr-1"></i>
                  Streams
                </button>
              </div>
            </div>

            {/* Genres - Dropdown Button */}
            <div className="relative md:col-span-1 lg:col-span-2">
              <label className="block text-white mb-2 text-xs md:text-sm font-semibold">Genres</label>
              <button
                type="button"
                onClick={() => {
                  setShowGenreDropdown(!showGenreDropdown);
                  setShowYearDropdown(false);
                  setShowRatingDropdown(false);
                  setShowCertificationDropdown(false);
                }}
                className={`w-full px-3 py-2.5 md:px-4 md:py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors flex items-center justify-between text-sm md:text-base h-[42px] ${
                  filters.genres.length > 0 ? 'ring-2 ring-red-600' : ''
                }`}
              >
                <span className="truncate">
                  {filters.genres.length === 0
                    ? 'Select Genres'
                    : filters.genres.length === 1
                    ? availableGenres.find(g => g.id === filters.genres[0])?.name || '1 Selected'
                    : `${filters.genres.length} Selected`}
                </span>
                <i className={`fas fa-chevron-${showGenreDropdown ? 'up' : 'down'} ml-2 flex-shrink-0`}></i>
              </button>
            </div>

            {/* Year - Dropdown */}
            <div className="relative md:col-span-1 lg:col-span-2">
              <label className="block text-white mb-2 text-xs md:text-sm font-semibold">Year</label>
              <button
                type="button"
                onClick={() => {
                  setShowYearDropdown(!showYearDropdown);
                  setShowGenreDropdown(false);
                  setShowRatingDropdown(false);
                  setShowCertificationDropdown(false);
                  setShowActorDropdown(false);
                }}
                className={`w-full px-3 py-2.5 md:px-4 md:py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors flex items-center justify-between text-sm md:text-base h-[42px] ${
                  filters.startYear || filters.endYear ? 'ring-2 ring-red-600' : ''
                }`}
              >
                <span className="truncate">
                  {filters.startYear && filters.endYear && filters.startYear === filters.endYear
                    ? filters.startYear
                    : filters.startYear && filters.endYear
                    ? `${filters.startYear}-${filters.endYear}`
                    : filters.startYear
                    ? `${filters.startYear}+`
                    : filters.endYear
                    ? `-${filters.endYear}`
                    : 'Any Year'}
                </span>
                <i className={`fas fa-chevron-${showYearDropdown ? 'up' : 'down'} ml-2 flex-shrink-0`}></i>
              </button>
            </div>

            {/* Rating - Dropdown Button */}
            <div className="relative md:col-span-1 lg:col-span-2">
              <label className="block text-white mb-2 text-xs md:text-sm font-semibold">Min Rating</label>
              <button
                type="button"
                onClick={() => {
                  setShowRatingDropdown(!showRatingDropdown);
                  setShowGenreDropdown(false);
                  setShowYearDropdown(false);
                  setShowCertificationDropdown(false);
                  setShowActorDropdown(false);
                }}
                className={`w-full px-3 py-2.5 md:px-4 md:py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors flex items-center justify-between text-sm md:text-base h-[42px] ${
                  filters.minRating ? 'ring-2 ring-red-600' : ''
                }`}
              >
                <span className="truncate">{filters.minRating ? `${filters.minRating}+` : 'Any Rating'}</span>
                <i className={`fas fa-chevron-${showRatingDropdown ? 'up' : 'down'} ml-2 flex-shrink-0`}></i>
              </button>
            </div>

            {/* Certification - Dropdown Button (Movies Only) */}
            {filters.mediaType === 'movie' || filters.mediaType === 'all' ? (
              <div className="relative md:col-span-1 lg:col-span-2">
                <label className="block text-white mb-2 text-xs md:text-sm font-semibold">Certification</label>
                <button
                  type="button"
                    onClick={() => {
                      setShowCertificationDropdown(!showCertificationDropdown);
                      setShowGenreDropdown(false);
                      setShowYearDropdown(false);
                      setShowRatingDropdown(false);
                      setShowActorDropdown(false);
                    }}
                  className={`w-full px-3 py-2.5 md:px-4 md:py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors flex items-center justify-between text-sm md:text-base h-[42px] ${
                    filters.certification ? 'ring-2 ring-red-600' : ''
                  }`}
                >
                  <span className="truncate">
                    {filters.certification 
                      ? availableCertifications.find(c => c.certification === filters.certification)?.certification || filters.certification
                      : 'Any Rating'}
                  </span>
                  <i className={`fas fa-chevron-${showCertificationDropdown ? 'up' : 'down'} ml-2 flex-shrink-0`}></i>
                </button>
              </div>
            ) : null}

            {/* Actors - Search and Select */}
            <div className="relative md:col-span-2 lg:col-span-3">
              <label className="block text-white mb-2 text-xs md:text-sm font-semibold">Actors</label>
              <div className="relative">
                <input
                  type="text"
                  value={actorSearchQuery}
                  onChange={(e) => handleActorSearch(e.target.value)}
                  onFocus={() => setShowActorDropdown(true)}
                  placeholder="Search for actors..."
                  className={`w-full px-3 py-2.5 md:px-4 md:py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 text-sm md:text-base h-[42px] ${
                    filters.actors.length > 0 ? 'ring-2 ring-red-600' : ''
                  }`}
                />
                {searchingActors && (
                  <div className="absolute right-3 top-2.5">
                    <i className="fas fa-spinner fa-spin text-gray-400"></i>
                  </div>
                )}
              </div>
              
              {/* Actor Search Results Dropdown */}
              {showActorDropdown && actorSearchResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-gray-800 rounded border border-gray-700 shadow-lg">
                  {actorSearchResults.map(actor => (
                    <button
                      key={actor.id}
                      type="button"
                      onClick={() => {
                        addActor(actor);
                        setShowActorDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-3"
                    >
                      {actor.profile_path && (
                        <img
                          src={getImageUrl(actor.profile_path, 'w92')}
                          alt={actor.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <span className="text-white block">{actor.name}</span>
                        {actor.known_for_department && (
                          <span className="text-gray-400 text-xs">{actor.known_for_department}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Selected Actors */}
              {selectedActors.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedActors.map(actor => (
                    <div
                      key={actor.id}
                      className="bg-red-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
                    >
                      {actor.profile_path && (
                        <img
                          src={getImageUrl(actor.profile_path, 'w92')}
                          alt={actor.name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      )}
                      <span>{actor.name}</span>
                      <button
                        type="button"
                        onClick={() => removeActor(actor.id)}
                        className="ml-1 hover:text-red-200"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sort By - Dropdown on the Right */}
            <div className="md:col-span-1 lg:col-span-3">
              <label className="block text-white mb-2 text-xs md:text-sm font-semibold">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="w-full px-3 py-2.5 md:px-4 md:py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 text-sm md:text-base h-[42px]"
              >
                <option value="popularity.desc">Popularity (Default)</option>
                <option value="rating.desc">Rating (Highest)</option>
                <option value="rating.asc">Rating (Lowest)</option>
                <option value="year.desc">Year (Newest)</option>
                <option value="year.asc">Year (Oldest)</option>
                <option value="title.asc">Title (A-Z)</option>
                <option value="title.desc">Title (Z-A)</option>
              </select>
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div className="mt-3 md:mt-4">
              <button
                onClick={clearFilters}
                className="px-4 py-2.5 md:py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors text-sm md:text-base"
              >
                <i className="fas fa-times mr-2"></i>
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close actor dropdown */}
      {showActorDropdown && actorSearchResults.length > 0 && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowActorDropdown(false)}
        ></div>
      )}

      {/* Genre Mega Menu - Full Width Below Filters */}
      {showGenreDropdown && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={() => setShowGenreDropdown(false)}
          ></div>
          <div className="max-w-6xl mx-auto mb-6 relative z-50">
            <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
              <div className="p-4 md:p-6 border-b border-gray-700 flex justify-between items-center">
                <span className="text-white font-semibold text-base md:text-lg">Select Genres</span>
                <div className="flex items-center gap-3">
                  {filters.genres.length > 0 && (
                    <>
                      <span className="text-gray-400 text-sm">
                        {filters.genres.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={() => handleFilterChange('genres', [])}
                        className="text-red-400 text-sm hover:text-red-300 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
                      >
                        Clear All
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowGenreDropdown(false)}
                    className="text-gray-400 hover:text-white transition-colors p-2"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>
              </div>
              <div className="p-4 md:p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
                  {availableGenres.map(genre => {
                    const isSelected = filters.genres.includes(genre.id);
                    return (
                      <button
                        key={genre.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            handleFilterChange('genres', filters.genres.filter(id => id !== genre.id));
                          } else {
                            handleFilterChange('genres', [...filters.genres, genre.id]);
                          }
                        }}
                        className={`px-3 py-2.5 md:px-4 md:py-3 rounded transition-all text-sm md:text-base font-medium ${
                          isSelected
                            ? 'bg-red-600 text-white ring-2 ring-red-400'
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                      >
                        {genre.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Year Range Mega Menu */}
      {showYearDropdown && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={() => setShowYearDropdown(false)}
          ></div>
          <div className="max-w-6xl mx-auto mb-6 relative z-50">
            <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
              <div className="p-4 md:p-6 border-b border-gray-700 flex justify-between items-center">
                <span className="text-white font-semibold text-base md:text-lg">Select Year Range</span>
                <div className="flex items-center gap-3">
                  {(filters.startYear || filters.endYear) && (
                    <button
                      type="button"
                      onClick={() => {
                        handleFilterChange('startYear', '');
                        handleFilterChange('endYear', '');
                      }}
                      className="text-red-400 text-sm hover:text-red-300 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowYearDropdown(false)}
                    className="text-gray-400 hover:text-white transition-colors p-2"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>
              </div>
              <div className="p-4 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Start Year */}
                  <div>
                    <label className="block text-white mb-3 text-sm font-semibold">Start Year</label>
                    <input
                      type="number"
                      value={filters.startYear || ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? '' : parseInt(e.target.value);
                        if (value === '' || (!isNaN(value) && value >= 1900 && value <= new Date().getFullYear() + 1)) {
                          handleFilterChange('startYear', value);
                        }
                      }}
                      placeholder="From year (e.g., 2020)"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600 text-base"
                    />
                    <p className="text-gray-400 text-xs mt-2">Leave empty for no start limit</p>
                  </div>
                  
                  {/* End Year */}
                  <div>
                    <label className="block text-white mb-3 text-sm font-semibold">End Year</label>
                    <input
                      type="number"
                      value={filters.endYear || ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? '' : parseInt(e.target.value);
                        if (value === '' || (!isNaN(value) && value >= 1900 && value <= new Date().getFullYear() + 1)) {
                          handleFilterChange('endYear', value);
                        }
                      }}
                      placeholder="To year (e.g., 2023)"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600 text-base"
                    />
                    <p className="text-gray-400 text-xs mt-2">Leave empty for no end limit</p>
                  </div>
                </div>
                <div className="text-center text-gray-400 text-sm">
                  {filters.startYear && filters.endYear && filters.startYear === filters.endYear
                    ? `Selected: ${filters.startYear}`
                    : filters.startYear && filters.endYear
                    ? `Range: ${filters.startYear} - ${filters.endYear}`
                    : filters.startYear
                    ? `From: ${filters.startYear}`
                    : filters.endYear
                    ? `Until: ${filters.endYear}`
                    : 'Enter start and/or end year'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rating Mega Menu */}
      {showRatingDropdown && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={() => setShowRatingDropdown(false)}
          ></div>
          <div className="max-w-6xl mx-auto mb-6 relative z-50">
            <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
              <div className="p-4 md:p-6 border-b border-gray-700 flex justify-between items-center">
                <span className="text-white font-semibold text-base md:text-lg">Select Minimum Rating</span>
                <div className="flex items-center gap-3">
                  {filters.minRating !== '' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleFilterChange('minRating', '');
                      }}
                      className="text-red-400 text-sm hover:text-red-300 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowRatingDropdown(false)}
                    className="text-gray-400 hover:text-white transition-colors p-2"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>
              </div>
              <div className="p-4 md:p-6">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-11 gap-2 md:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      handleFilterChange('minRating', '');
                    }}
                    className={`px-4 py-3 md:px-6 md:py-4 rounded transition-all text-sm md:text-base font-medium ${
                      filters.minRating === ''
                        ? 'bg-red-600 text-white ring-2 ring-red-400'
                        : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    Any
                  </button>
                  {[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(rating => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => {
                        handleFilterChange('minRating', rating);
                      }}
                      className={`px-4 py-3 md:px-6 md:py-4 rounded transition-all text-sm md:text-base font-medium ${
                        filters.minRating === rating
                          ? 'bg-red-600 text-white ring-2 ring-red-400'
                          : 'bg-gray-700 text-white hover:bg-gray-600'
                      }`}
                    >
                      {rating}+
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Certification Mega Menu */}
      {showCertificationDropdown && (filters.mediaType === 'movie' || filters.mediaType === 'all') && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={() => setShowCertificationDropdown(false)}
          ></div>
          <div className="max-w-6xl mx-auto mb-6 relative z-50">
            <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
              <div className="p-4 md:p-6 border-b border-gray-700 flex justify-between items-center">
                <span className="text-white font-semibold text-base md:text-lg">Select Movie Certification</span>
                <div className="flex items-center gap-3">
                  {filters.certification !== '' && (
                    <button
                      type="button"
                      onClick={() => {
                        handleFilterChange('certification', '');
                      }}
                      className="text-red-400 text-sm hover:text-red-300 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCertificationDropdown(false)}
                    className="text-gray-400 hover:text-white transition-colors p-2"
                  >
                    <i className="fas fa-times text-lg"></i>
                  </button>
                </div>
              </div>
              <div className="p-4 md:p-6">
                {loadingCertifications ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading certifications...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-11 gap-2 md:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        handleFilterChange('certification', '');
                      }}
                      className={`px-4 py-3 md:px-6 md:py-4 rounded transition-all text-sm md:text-base font-medium ${
                        filters.certification === ''
                          ? 'bg-red-600 text-white ring-2 ring-red-400'
                          : 'bg-gray-700 text-white hover:bg-gray-600'
                      }`}
                    >
                      Any
                    </button>
                    {availableCertifications.map(cert => (
                      <button
                        key={cert.certification}
                        type="button"
                        onClick={() => {
                          handleFilterChange('certification', cert.certification);
                        }}
                        className={`px-4 py-3 md:px-6 md:py-4 rounded transition-all text-sm md:text-base font-medium ${
                          filters.certification === cert.certification
                            ? 'bg-red-600 text-white ring-2 ring-red-400'
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                        title={cert.meaning}
                      >
                        {cert.certification}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Results */}
      {!isLoading && hasSearched && (
        <div className="max-w-6xl mx-auto">
          {showStreams ? (
            // Direct torrent search results (independent of TMDB)
            <>
              <h2 className="text-2xl font-bold text-white mb-6">
                Torrent Search Results {query.trim() && `for "${query}"`}
                {directTorrentResults.length > 0 && ` (${directTorrentResults.length})`}
              </h2>
              {loadingDirectTorrents ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
                  <p className="text-white">Searching torrents...</p>
                </div>
              ) : directTorrentResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {directTorrentResults.map((stream, index) => (
                    <div
                      key={index}
                      className="bg-gray-800 rounded-lg overflow-hidden p-4"
                    >
                      <div className="flex flex-col">
                        <h3 className="text-white text-sm font-medium mb-2 line-clamp-2">
                          {stream.title}
                        </h3>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          {stream.quality && (
                            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                              {stream.quality}
                            </span>
                          )}
                          {stream.size && (
                            <span className="text-xs text-gray-400">
                              {stream.size}
                            </span>
                          )}
                          {stream.seeders > 0 && (
                            <span className="text-xs text-green-400">
                              {stream.seeders} seeds
                            </span>
                          )}
                          {stream.leechers > 0 && (
                            <span className="text-xs text-gray-400">
                              {stream.leechers} leech
                            </span>
                          )}
                        </div>
                        <a
                          href={stream.magnet ? createUrl(`/watch-torrent?title=${encodeURIComponent(stream.title || '')}&magnet=${encodeURIComponent(stream.magnet)}`) : '#'}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors text-center"
                          onClick={(e) => {
                            if (!stream.magnet) {
                              e.preventDefault();
                              alert('No magnet link available for this stream.');
                            }
                          }}
                        >
                          <i className="fas fa-play mr-1"></i>
                          Watch
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="max-w-3xl mx-auto">
                    <i className="fas fa-magnet text-6xl text-red-600 mb-6"></i>
                    <h3 className="text-2xl font-bold text-white mb-4">Manual Magnet Link Entry</h3>
                    <p className="text-gray-400 text-lg mb-6">
                      Automatic torrent search is unavailable due to browser privacy restrictions and CORS limitations.
                      <br />
                      <span className="text-white font-medium">You can still watch torrents by adding magnet links manually.</span>
                    </p>
                    
                    <div className="bg-gray-800 rounded-lg p-6 mb-6">
                      <h4 className="text-white font-semibold mb-4 text-lg">
                        <i className="fas fa-list-ol mr-2 text-red-500"></i>
                        How to use:
                      </h4>
                      <ol className="text-left text-gray-300 space-y-3 mb-6">
                        <li className="flex items-start">
                          <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0 mt-0.5">1</span>
                          <span>Click the button below to open the torrent player</span>
                        </li>
                        <li className="flex items-start">
                          <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0 mt-0.5">2</span>
                          <span>Find a magnet link from a torrent site (1337x, The Pirate Bay, YTS, etc.)</span>
                        </li>
                        <li className="flex items-start">
                          <span className="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 flex-shrink-0 mt-0.5">3</span>
                          <span>Paste the magnet link into the player and start streaming</span>
                        </li>
                      </ol>
                      
                      <div className="flex flex-wrap gap-3 justify-center mb-4">
                        <a
                          href="https://1337x.to"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors text-sm"
                        >
                          <i className="fas fa-external-link-alt mr-2"></i>
                          1337x
                        </a>
                        <a
                          href="https://thepiratebay.org"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors text-sm"
                        >
                          <i className="fas fa-external-link-alt mr-2"></i>
                          The Pirate Bay
                        </a>
                        <a
                          href="https://yts.mx"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors text-sm"
                        >
                          <i className="fas fa-external-link-alt mr-2"></i>
                          YTS
                        </a>
                      </div>
                    </div>
                    
                    <a
                      href={createUrl(`/watch-torrent?title=${encodeURIComponent(query.trim())}`)}
                      className="inline-block bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg transition-colors font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-transform"
                    >
                      <i className="fas fa-magnet mr-2"></i>
                      Open Torrent Player
                    </a>
                    
                    <p className="text-gray-500 text-sm mt-4">
                      Search query: <span className="text-gray-400 font-mono">"{query.trim()}"</span>
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : filteredResults.length > 0 ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-6">
                {searchMode === 'discover' ? 'Discover Results' : 'Search Results'} ({filteredResults.length}
                {searchMode === 'search' && hasActiveFilters && allResults.length !== filteredResults.length && 
                  ` of ${allResults.length}`})
              </h2>
              <div className="grid grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-4">
                  {filteredResults.map((item) => {
                    const title = getTitle(item);
                    const year = getDate(item);
                    const posterUrl = item.poster_path 
                      ? getImageUrl(item.poster_path, 'w500')
                      : '/images/placeholder-poster.jpg';
                    
                    // Determine media type - use item.media_type or infer from title/name
                    // Filter out 'person' type and ensure we have 'movie' or 'tv'
                    let mediaType: 'movie' | 'tv';
                    if (item.media_type === 'movie' || item.media_type === 'tv') {
                      mediaType = item.media_type;
                    } else {
                      // Infer from title/name (movies have title, TV shows have name)
                      mediaType = item.title ? 'movie' : 'tv';
                    }

                    return (
                      <div key={`${mediaType}-${item.id}`} className="group">
                        <a
                          href={createUrl(`/details?type=${mediaType}&id=${item.id}`)}
                          className="block"
                        >
                          <div className="bg-gray-800 rounded-lg overflow-hidden transition-transform duration-300 group-hover:scale-105 group-hover:shadow-xl">
                            <div className="relative">
                              <img
                                src={posterUrl}
                                alt={title}
                                className="w-full aspect-[2/3] object-cover"
                              />
                              <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold uppercase z-10">
                                {mediaType}
                              </div>
                              <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                                <div className="bg-black bg-opacity-70 text-yellow-400 px-2 py-1 rounded text-sm font-semibold">
                                  {item.vote_average.toFixed(1)}
                                </div>
                                <div onClick={(e) => e.preventDefault()}>
                                  <WatchlistButton
                                    movieId={item.id}
                                    mediaType={mediaType}
                                    title={title || ''}
                                    posterPath={item.poster_path}
                                  />
                                </div>
                              </div>
                            </div>
                            
                            <div className="p-4">
                              <h3 className="font-semibold text-white mb-2 line-clamp-2" title={title}>
                                {title}
                              </h3>
                              <p className="text-gray-400 text-sm mb-2">
                                {year && `${year} • `}{item.media_type === 'tv' ? 'TV Show' : 'Movie'}
                              </p>
                              {item.overview && (
                                <p className="text-gray-300 text-sm line-clamp-3">
                                  {item.overview}
                                </p>
                              )}
                            </div>
                          </div>
                        </a>
                      </div>
                    );
                  })}
                </div>
            </>
          ) : (
            <div className="text-center py-12">
              <i className="fas fa-search text-4xl text-gray-600 mb-4"></i>
              <h2 className="text-xl font-bold text-white mb-2">
                {allResults.length > 0 ? 'No results match your filters' : 'No results found'}
              </h2>
              <p className="text-gray-400 mb-4">
                {allResults.length > 0 
                  ? 'Try adjusting your filters or clearing them to see all results.'
                  : 'Try searching with different keywords or check your spelling.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!hasSearched && !isLoading && (
        <div className="text-center py-12">
          <i className="fas fa-film text-6xl text-gray-600 mb-6"></i>
          <h2 className="text-2xl font-bold text-white mb-4">Discover Movies & TV Shows</h2>
          <p className="text-gray-400 text-lg mb-4">
            Search by name or use filters above to discover content that matches your preferences.
          </p>
          {hasActiveFilters && (
            <p className="text-blue-400 text-sm">
              <i className="fas fa-info-circle mr-2"></i>
              You have active filters. Click "Discover" to browse content matching your criteria.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
