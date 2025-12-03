import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { supabase, isSupabaseConfigured, type HomepageSection, type CustomSection, type TMDBFilters } from '../lib/supabase';
import { DEFAULT_HOMEPAGE_SECTIONS } from '../lib/supabase';
import { $user } from '../stores/auth';
import { 
  fetchFromTMDB, 
  tmdbEndpoints, 
  getImageUrl, 
  fetchGenres,
  discoverWithFilters,
  sortByOptions,
  tvSortByOptions,
  searchKeywords,
  searchCompanies
} from '../lib/tmdb';

interface Movie {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  media_type: 'movie' | 'tv';
}

const PAGE_OPTIONS = ['homepage', 'movies', 'tv-shows'] as const;
type PageOption = typeof PAGE_OPTIONS[number];

export default function CategoryManager() {
  const user = useStore($user);
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Category creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [categoryType, setCategoryType] = useState<'manual' | 'auto'>('manual');
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  // Page visibility and ordering state
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingFilters, setEditingFilters] = useState<string | null>(null);

  // Movie management state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingMovieId, setAddingMovieId] = useState<string | null>(null);
  const [customSectionData, setCustomSectionData] = useState<Record<string, CustomSection>>({});

  // TMDB filter state for auto-generated categories
  const [tmdbFilters, setTmdbFilters] = useState<TMDBFilters>({
    media_type: 'movie',
    sort_by: 'popularity.desc'
  });
  const [availableGenres, setAvailableGenres] = useState<{ id: number; name: string }[]>([]);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [companySearchResults, setCompanySearchResults] = useState<{ id: number; name: string; logo_path?: string }[]>([]);
  const [searchingCompanies, setSearchingCompanies] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<{ id: number; name: string; logo_path?: string }[]>([]);
  const [filterPreview, setFilterPreview] = useState<Movie[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [activePage, setActivePage] = useState<PageOption | 'all'>('all');

  useEffect(() => {
    loadSections();
    loadGenres();
  }, []);

  const loadGenres = async (type: 'movie' | 'tv' = 'movie') => {
    const genres = await fetchGenres(type);
    setAvailableGenres(genres);
  };

  const loadFiltersForEditing = async (section: HomepageSection) => {
    if (!section.config?.tmdb_filters) return;
    
    const filters = { ...section.config.tmdb_filters };
    setTmdbFilters(filters);
    
    // Load genres for the media type
    if (filters.media_type) {
      await loadGenres(filters.media_type);
    }
    
    // Reset company selection (user will need to re-select if they want to edit)
    // This is because we only store company IDs, not full company objects
    setSelectedCompanies([]);
    setCompanySearchQuery('');
    setCompanySearchResults([]);
    
    setEditingFilters(section.id);
  };

  const saveFilters = async (sectionId: string) => {
    if (!tmdbFilters.media_type) {
      setMessage({ type: 'error', text: 'Please select a media type' });
      return;
    }

    setSaving(true);
    try {
      const section = sections.find(s => s.id === sectionId);
      if (!section) return;

      const newConfig = {
        ...section.config,
        tmdb_filters: tmdbFilters
      };

      await updateSectionConfig(sectionId, newConfig);
      setMessage({ type: 'success', text: 'Filters updated successfully!' });
      setEditingFilters(null);
      await loadSections(); // Reload to get fresh data
    } catch (error: any) {
      console.error('Error saving filters:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save filters' });
    } finally {
      setSaving(false);
    }
  };

  const loadSections = async () => {
    if (!isSupabaseConfigured()) {
      setMessage({ type: 'error', text: 'Supabase is not configured' });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase!
        .from('homepage_sections')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) {
        // Check for schema cache error
        if (error.message?.includes('custom_section_id') || error.message?.includes('schema cache')) {
          setSchemaError('Schema cache issue detected. Please refresh the schema.');
          console.error('Schema cache error:', error);
        }
        throw error;
      }

      if (!data || data.length === 0) {
        await initializeDefaultSections();
        await loadSections();
        return;
      }

      // Ensure all sections have config with default values
      const sectionsWithConfig = data.map(section => ({
        ...section,
        config: section.config || {
          visible_on: ['homepage'],
          page_order: { homepage: section.order_index }
        }
      }));

      setSections(sectionsWithConfig as HomepageSection[]);
      setSchemaError(null);

      // Load custom section details
      const customSections = sectionsWithConfig.filter(s => s.section_type === 'custom' && s.custom_section_id);
      if (customSections.length > 0) {
        const { data: customData } = await supabase!
          .from('custom_sections')
          .select('*')
          .in('id', customSections.map(s => s.custom_section_id!));

        if (customData) {
          const customMap: Record<string, CustomSection> = {};
          customData.forEach(cs => {
            customMap[cs.id] = cs as CustomSection;
          });
          setCustomSectionData(customMap);
        }
      }
    } catch (error: any) {
      console.error('Error loading sections:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to load sections' });
    } finally {
      setLoading(false);
    }
  };

  const refreshSchemaCache = async () => {
    try {
      // Try to query the schema to refresh cache
      await supabase!.from('homepage_sections').select('custom_section_id').limit(1);
      setSchemaError(null);
      setMessage({ type: 'success', text: 'Schema cache refreshed. Please try again.' });
      await loadSections();
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Failed to refresh schema. Please check Supabase dashboard or run the migration SQL.' });
    }
  };

  const initializeDefaultSections = async () => {
    if (!isSupabaseConfigured()) return;

    try {
      const defaultSections = DEFAULT_HOMEPAGE_SECTIONS.map((section, index) => ({
        section_key: section.section_key,
        title: section.title,
        section_type: section.section_type,
        order_index: index,
        enabled: true,
        config: {
          visible_on: ['homepage'],
          page_order: { homepage: index }
        }
      }));

      const { error } = await supabase!
        .from('homepage_sections')
        .insert(defaultSections);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error initializing default sections:', error);
      throw error;
    }
  };

  const updateSectionConfig = async (sectionId: string, updates: Partial<HomepageSection['config']>) => {
    if (!isSupabaseConfigured()) return;

    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const currentConfig = section.config || { visible_on: ['homepage'], page_order: {} };
    const newConfig = {
      ...currentConfig,
      ...updates
    };

    try {
      const { error } = await supabase!
        .from('homepage_sections')
        .update({ config: newConfig })
        .eq('id', sectionId);

      if (error) throw error;

      // Update local state immediately for responsiveness
      setSections(sections.map(s => 
        s.id === sectionId ? { ...s, config: newConfig } : s
      ));

      // Note: Don't show message here as it might be called multiple times
      // The caller should handle messaging
    } catch (error: any) {
      console.error('Error updating config:', error);
      throw error; // Re-throw so caller can handle
    }
  };

  const togglePageVisibility = async (sectionId: string, page: PageOption) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const currentConfig = section.config || { visible_on: ['homepage'], page_order: {} };
    const visibleOn = currentConfig.visible_on || ['homepage'];
    const pageOrder = currentConfig.page_order || {};

    const isVisible = visibleOn.includes(page);
    const newVisibleOn = isVisible
      ? visibleOn.filter(p => p !== page)
      : [...visibleOn, page];

    // If removing from all pages, add back to homepage
    if (newVisibleOn.length === 0) {
      newVisibleOn.push('homepage');
    }

    // Update page order for newly visible pages
    if (!isVisible && !pageOrder[page]) {
      const maxOrder = Math.max(...Object.values(pageOrder), -1);
      pageOrder[page] = maxOrder + 1;
    }

    await updateSectionConfig(sectionId, {
      visible_on: newVisibleOn,
      page_order: pageOrder
    });
  };

  const updatePageOrder = async (sectionId: string, page: PageOption, direction: 'up' | 'down') => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    setSaving(true);
    try {
      const currentConfig = section.config || { visible_on: ['homepage'], page_order: {} };
      const pageOrder = currentConfig.page_order || {};

      // Get all sections visible on this page, sorted by order
      const visibleOnPage = sections
        .filter(s => {
          const config = s.config || { visible_on: ['homepage'] };
          return (config.visible_on || []).includes(page);
        })
        .sort((a, b) => {
          const aOrder = (a.config?.page_order || {})[page] ?? a.order_index;
          const bOrder = (b.config?.page_order || {})[page] ?? b.order_index;
          return aOrder - bOrder;
        });

      const currentIndex = visibleOnPage.findIndex(s => s.id === sectionId);
      if (currentIndex === -1) return;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= visibleOnPage.length) {
        setSaving(false);
        return;
      }

      // Swap orders
      const tempOrder = pageOrder[page] ?? section.order_index;
      const swapSection = visibleOnPage[newIndex];
      const swapOrder = (swapSection.config?.page_order || {})[page] ?? swapSection.order_index;

      const newPageOrder = {
        ...pageOrder,
        [page]: swapOrder
      };

      const swapPageOrder = {
        ...(swapSection.config?.page_order || {}),
        [page]: tempOrder
      };

      // Update both sections in parallel
      await Promise.all([
        updateSectionConfig(sectionId, { page_order: newPageOrder }),
        updateSectionConfig(swapSection.id, { page_order: swapPageOrder })
      ]);

      // Update local state immediately
      setSections(sections.map(s => {
        if (s.id === sectionId) {
          return { ...s, config: { ...(s.config || {}), page_order: newPageOrder } };
        }
        if (s.id === swapSection.id) {
          return { ...s, config: { ...(s.config || {}), page_order: swapPageOrder } };
        }
        return s;
      }));

      setMessage({ type: 'success', text: 'Order updated successfully!' });
      setTimeout(() => setMessage(null), 2000);
    } catch (error: any) {
      console.error('Error updating page order:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update order' });
      // Reload on error to reset state
      await loadSections();
    } finally {
      setSaving(false);
    }
  };

  const handleCompanySearch = async (query: string) => {
    setCompanySearchQuery(query);
    if (!query.trim()) {
      setCompanySearchResults([]);
      return;
    }

    setSearchingCompanies(true);
    try {
      const results = await searchCompanies(query);
      setCompanySearchResults(results);
    } catch (error) {
      console.error('Error searching companies:', error);
      setCompanySearchResults([]);
    } finally {
      setSearchingCompanies(false);
    }
  };

  const addCompany = (company: { id: number; name: string; logo_path?: string }) => {
    if (!selectedCompanies.find(c => c.id === company.id)) {
      setSelectedCompanies([...selectedCompanies, company]);
      setTmdbFilters({
        ...tmdbFilters,
        with_companies: [...(tmdbFilters.with_companies || []), company.id]
      });
    }
    setCompanySearchQuery('');
    setCompanySearchResults([]);
  };

  const removeCompany = (companyId: number) => {
    setSelectedCompanies(selectedCompanies.filter(c => c.id !== companyId));
    setTmdbFilters({
      ...tmdbFilters,
      with_companies: (tmdbFilters.with_companies || []).filter(id => id !== companyId)
    });
  };

  const previewFilters = async () => {
    if (!tmdbFilters.media_type) {
      setMessage({ type: 'error', text: 'Please select a media type' });
      return;
    }

    setLoadingPreview(true);
    try {
      const results = await discoverWithFilters(tmdbFilters.media_type, tmdbFilters, 12);
      setFilterPreview(results);
      if (results.length === 0) {
        setMessage({ type: 'error', text: 'No results found with these filters. Try adjusting your criteria.' });
      }
    } catch (error: any) {
      console.error('Error previewing filters:', error);
      setMessage({ type: 'error', text: 'Failed to preview filters' });
    } finally {
      setLoadingPreview(false);
    }
  };

  const createCustomCategory = async () => {
    if (!isSupabaseConfigured() || !user || !newCategoryTitle.trim()) {
      setMessage({ type: 'error', text: 'Please enter a category title' });
      return;
    }

    if (!user.id) {
      setMessage({ type: 'error', text: 'User not logged in. Please refresh and try again.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      let sectionData;
      let config: HomepageSection['config'] = {
        visible_on: ['homepage'],
        page_order: { homepage: sections.length }
      };

      if (categoryType === 'auto' && tmdbFilters.media_type) {
        // Auto-generated category with TMDB filters
        const results = await discoverWithFilters(tmdbFilters.media_type, tmdbFilters, 20);
        
        if (results.length === 0) {
          throw new Error('No results found with the selected filters. Please adjust your criteria.');
        }

        // Create custom section with auto-generated movies
        const movies = results.map((movie: any) => ({
          id: movie.id,
          title: movie.title || movie.name,
          poster_path: movie.poster_path || null,
          backdrop_path: movie.backdrop_path || null,
          overview: movie.overview || null,
          release_date: movie.release_date || movie.first_air_date || null,
          media_type: movie.media_type || tmdbFilters.media_type,
        }));

        const { data: autoSectionData, error: autoError } = await supabase!
          .from('custom_sections')
          .insert({
            user_id: user.id,
            title: newCategoryTitle.trim(),
            description: newCategoryDescription.trim() || null,
            type: 'manual',
            movies: movies,
            enabled: true,
            order_index: sections.length,
          })
          .select()
          .single();

        if (autoError) throw autoError;
        sectionData = autoSectionData;

        // Store filters in config for auto-refresh
        config.tmdb_filters = tmdbFilters;
      } else {
        // Manual category
        console.log('Creating manual custom section...');
        const { data: manualSectionData, error: manualError } = await supabase!
          .from('custom_sections')
          .insert({
            user_id: user.id,
            title: newCategoryTitle.trim(),
            description: newCategoryDescription.trim() || null,
            type: 'manual',
            movies: [],
            enabled: true,
            order_index: sections.length,
          })
          .select()
          .single();

        if (manualError) {
          console.error('Error creating custom section:', manualError);
          throw new Error(`Failed to create custom section: ${manualError.message}`);
        }
        console.log('Custom section created:', manualSectionData);
        sectionData = manualSectionData;
      }

      // Create homepage section entry with config
      const homepageSectionData = {
        section_key: sectionData.id,
        title: newCategoryTitle.trim(),
        section_type: 'custom' as const,
        custom_section_id: sectionData.id,
        order_index: sections.length,
        enabled: true,
        config: config
      };

      console.log('Creating homepage section:', homepageSectionData);

      const { data: homepageData, error: homepageError } = await supabase!
        .from('homepage_sections')
        .insert(homepageSectionData)
        .select()
        .single();

      if (homepageError) {
        console.error('Error creating homepage section:', homepageError);
        console.error('Full error details:', JSON.stringify(homepageError, null, 2));
        
        // Try to clean up custom_section if homepage section creation fails
        try {
          await supabase!.from('custom_sections').delete().eq('id', sectionData.id);
        } catch (cleanupError) {
          console.error('Error cleaning up custom section:', cleanupError);
        }
        
        if (homepageError.message?.includes('custom_section_id') || homepageError.message?.includes('schema cache')) {
          setSchemaError('Schema cache issue. Please run the migration SQL to add the custom_section_id column.');
          throw new Error('Schema issue: custom_section_id column not found. Please check the migration.');
        }
        throw new Error(`Failed to add to homepage: ${homepageError.message}`);
      }

      console.log('Homepage section created successfully:', homepageData);

      setMessage({ type: 'success', text: 'Custom category created successfully!' });
      setNewCategoryTitle('');
      setNewCategoryDescription('');
      setShowCreateForm(false);
      setCategoryType('manual');
      setTmdbFilters({ media_type: 'movie', sort_by: 'popularity.desc' });
      setSelectedCompanies([]);
      setCompanySearchQuery('');
      setCompanySearchResults([]);
      setFilterPreview([]);
      await loadSections();
    } catch (error: any) {
      console.error('Error creating category:', error);
      console.error('Full error:', JSON.stringify(error, null, 2));
      const errorMsg = error.message || 'Failed to create category';
      setMessage({ 
        type: 'error', 
        text: `${errorMsg}. Open browser console (F12) for details. If it's a schema error, run the migration SQL.` 
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteSection = async (section: HomepageSection) => {
    const sectionType = section.section_type === 'custom' ? 'Custom category' : 'Built-in section';
    if (!confirm(`Are you sure you want to delete "${section.title}"? This ${sectionType.toLowerCase()} will be permanently removed.`)) {
      return;
    }

    setSaving(true);
    try {
      if (section.section_type === 'custom' && section.custom_section_id) {
        // Delete custom section first
        await supabase!.from('custom_sections').delete().eq('id', section.custom_section_id);
      }

      // Delete from homepage_sections
      const { error } = await supabase!
        .from('homepage_sections')
        .delete()
        .eq('id', section.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Section deleted successfully' });
      await loadSections();
    } catch (error: any) {
      console.error('Error deleting section:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to delete section' });
    } finally {
      setSaving(false);
    }
  };

  const updateBuiltinSection = async (section: HomepageSection, updates: { title?: string; config?: HomepageSection['config'] }) => {
    if (!isSupabaseConfigured()) return;

    setSaving(true);
    try {
      const updateData: any = {};
      if (updates.title) updateData.title = updates.title;
      if (updates.config) updateData.config = updates.config;

      const { error } = await supabase!
        .from('homepage_sections')
        .update(updateData)
        .eq('id', section.id);

      if (error) throw error;

      setSections(sections.map(s => 
        s.id === section.id ? { ...s, ...updateData } : s
      ));

      setEditingSection(null);
      setMessage({ type: 'success', text: 'Section updated successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error updating section:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update section' });
    } finally {
      setSaving(false);
    }
  };

  const searchMovies = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const data = await fetchFromTMDB(tmdbEndpoints.search, {
        query: query.trim(),
      });

      const results = (data.results || []).filter(
        (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
      ) as Movie[];

      setSearchResults(results.slice(0, 20));
    } catch (error: any) {
      console.error('Error searching movies:', error);
      setMessage({ type: 'error', text: 'Failed to search movies' });
    } finally {
      setSearching(false);
    }
  };

  const addMovieToCategory = async (section: HomepageSection, movie: Movie) => {
    if (!isSupabaseConfigured() || !user || !section.custom_section_id) return;

    const movieKey = `${movie.id}-${movie.media_type}`;
    setAddingMovieId(movieKey);

    try {
      const customSection = customSectionData[section.custom_section_id];
      if (!customSection) {
        throw new Error('Custom section not found');
      }

      const currentMovies = Array.isArray(customSection.movies) ? customSection.movies : [];
      const alreadyExists = currentMovies.some((m: any) => m.id === movie.id && m.media_type === movie.media_type);
      
      if (alreadyExists) {
        setMessage({ type: 'error', text: 'This movie is already in the category' });
        setAddingMovieId(null);
        return;
      }

      const movieData = {
        id: movie.id,
        title: movie.title || movie.name,
        poster_path: movie.poster_path || null,
        backdrop_path: movie.backdrop_path || null,
        overview: movie.overview || null,
        release_date: movie.release_date || movie.first_air_date || null,
        media_type: movie.media_type,
      };

      const updatedMovies = [...currentMovies, movieData];

      const { error } = await supabase!
        .from('custom_sections')
        .update({ movies: updatedMovies })
        .eq('id', section.custom_section_id);

      if (error) throw error;

      setCustomSectionData({
        ...customSectionData,
        [section.custom_section_id]: {
          ...customSection,
          movies: updatedMovies,
        },
      });

      setMessage({ type: 'success', text: 'Movie added successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error adding movie:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to add movie' });
    } finally {
      setAddingMovieId(null);
    }
  };

  const removeMovieFromCategory = async (section: HomepageSection, movieId: number, mediaType: string) => {
    if (!isSupabaseConfigured() || !section.custom_section_id) return;

    setSaving(true);
    try {
      const customSection = customSectionData[section.custom_section_id];
      if (!customSection) {
        throw new Error('Custom section not found');
      }

      const currentMovies = Array.isArray(customSection.movies) ? customSection.movies : [];
      const updatedMovies = currentMovies.filter(
        (m: any) => !(m.id === movieId && m.media_type === mediaType)
      );

      const { error } = await supabase!
        .from('custom_sections')
        .update({ movies: updatedMovies })
        .eq('id', section.custom_section_id);

      if (error) throw error;

      setCustomSectionData({
        ...customSectionData,
        [section.custom_section_id]: {
          ...customSection,
          movies: updatedMovies,
        },
      });

      setMessage({ type: 'success', text: 'Movie removed successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error removing movie:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to remove movie' });
    } finally {
      setSaving(false);
    }
  };

  const moveSection = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= sections.length) return;

    const newSections = [...sections];
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];

    // Update order_index for all sections
    newSections.forEach((section, idx) => {
      section.order_index = idx;
    });

    // Update local state immediately for responsiveness
    setSections(newSections);

    // Save to database
    if (!isSupabaseConfigured()) return;

    try {
      // Update both swapped sections in parallel
      await Promise.all([
        supabase!.from('homepage_sections')
          .update({ order_index: newSections[index].order_index, updated_at: new Date().toISOString() })
          .eq('id', newSections[index].id),
        supabase!.from('homepage_sections')
          .update({ order_index: newSections[newIndex].order_index, updated_at: new Date().toISOString() })
          .eq('id', newSections[newIndex].id)
      ]);
    } catch (error: any) {
      console.error('Error saving order:', error);
      setMessage({ type: 'error', text: 'Failed to save order. Click "Save Order" to retry.' });
    }
  };

  const toggleEnabled = async (section: HomepageSection) => {
    if (!isSupabaseConfigured()) return;

    try {
      const { error } = await supabase!
        .from('homepage_sections')
        .update({ enabled: !section.enabled })
        .eq('id', section.id);

      if (error) throw error;

      setSections(sections.map(s => 
        s.id === section.id ? { ...s, enabled: !s.enabled } : s
      ));

      setMessage({ type: 'success', text: 'Section updated successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error toggling section:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update section' });
    }
  };

  const saveOrder = async () => {
    if (!isSupabaseConfigured()) return;

    setSaving(true);
    setMessage(null);

    try {
      const updates = sections.map((section, index) => ({
        id: section.id,
        order_index: index,
        updated_at: new Date().toISOString(),
      }));

      for (const update of updates) {
        const { error } = await supabase!
          .from('homepage_sections')
          .update({ order_index: update.order_index, updated_at: update.updated_at })
          .eq('id', update.id);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Category order saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving order:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save order' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const selectedCategory = selectedCategoryId 
    ? sections.find(s => s.id === selectedCategoryId && s.section_type === 'custom')
    : null;
  const selectedCustomData = selectedCategory && selectedCategory.custom_section_id
    ? customSectionData[selectedCategory.custom_section_id]
    : null;

  // Get sections visible on current page for ordering
  const getSectionsForPage = (page: PageOption) => {
    return sections
      .filter(s => {
        const config = s.config || { visible_on: ['homepage'] };
        return (config.visible_on || []).includes(page);
      })
      .sort((a, b) => {
        const aOrder = (a.config?.page_order || {})[page] ?? a.order_index;
        const bOrder = (b.config?.page_order || {})[page] ?? b.order_index;
        return aOrder - bOrder;
      });
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white`}
        >
          {message.text}
        </div>
      )}

      {schemaError && (
        <div className="p-4 rounded-lg bg-yellow-600 text-white">
          <div className="flex justify-between items-center">
            <div>
              <strong>Schema Cache Issue:</strong> {schemaError}
              <p className="text-sm mt-1">Run the migration SQL in Supabase to add the missing column.</p>
            </div>
            <button
              onClick={refreshSchemaCache}
              className="btn-secondary text-sm ml-4"
            >
              <i className="fas fa-sync mr-2"></i>
              Refresh Schema
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Manage Categories</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="btn-secondary"
            >
              <i className="fas fa-plus mr-2"></i>
              {showCreateForm ? 'Cancel' : 'Create Category'}
            </button>
            <button
              onClick={saveOrder}
              disabled={saving}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Saving...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2"></i>
                  Save Order
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-gray-400 mb-6">
          Manage all categories (built-in and custom). Configure page visibility, ordering, and filters.
        </p>

        {/* Create Category Form */}
        {showCreateForm && (
          <div className="mb-6 p-4 bg-gray-700 rounded-lg">
            <h3 className="text-xl font-bold text-white mb-4">Create New Category</h3>
            
            {/* Category Type Tabs */}
            <div className="flex gap-2 mb-4 border-b border-gray-600">
              <button
                onClick={() => setCategoryType('manual')}
                className={`px-4 py-2 font-medium ${
                  categoryType === 'manual'
                    ? 'border-b-2 border-red-600 text-red-600'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Manual Category
              </button>
              <button
                onClick={() => {
                  setCategoryType('auto');
                  // Load genres when switching to auto
                  if (tmdbFilters.media_type) {
                    fetchGenres(tmdbFilters.media_type).then(setAvailableGenres);
                  }
                }}
                className={`px-4 py-2 font-medium ${
                  categoryType === 'auto'
                    ? 'border-b-2 border-red-600 text-red-600'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Auto-Generated (TMDB Filters)
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-white mb-2">Category Title *</label>
                <input
                  type="text"
                  value={newCategoryTitle}
                  onChange={(e) => setNewCategoryTitle(e.target.value)}
                  placeholder="e.g., Holiday Movies, Action Thrillers"
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>
              <div>
                <label className="block text-white mb-2">Description (optional)</label>
                <textarea
                  value={newCategoryDescription}
                  onChange={(e) => setNewCategoryDescription(e.target.value)}
                  placeholder="Describe this category..."
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

              {/* TMDB Filter Builder for Auto-Generated Categories */}
              {categoryType === 'auto' && (
                <div className="p-4 bg-gray-600 rounded-lg space-y-4">
                  <h4 className="text-white font-semibold">TMDB Filter Settings</h4>
                  
                  {/* Media Type */}
                  <div>
                    <label className="block text-white mb-2">Media Type *</label>
                    <select
                      value={tmdbFilters.media_type || 'movie'}
                      onChange={async (e) => {
                        const newType = e.target.value as 'movie' | 'tv';
                        setTmdbFilters({ ...tmdbFilters, media_type: newType });
                        const genres = await fetchGenres(newType);
                        setAvailableGenres(genres);
                      }}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                    >
                      <option value="movie">Movies</option>
                      <option value="tv">TV Shows</option>
                    </select>
                  </div>

                  {/* Genres */}
                  <div>
                    <label className="block text-white mb-2">Genres (optional)</label>
                    <select
                      multiple
                      value={tmdbFilters.with_genres?.map(String) || []}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, opt => parseInt(opt.value));
                        setTmdbFilters({ ...tmdbFilters, with_genres: selected });
                      }}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600 h-32"
                    >
                      {availableGenres.map(genre => (
                        <option key={genre.id} value={genre.id}>{genre.name}</option>
                      ))}
                    </select>
                    <p className="text-gray-400 text-xs mt-1">Hold Ctrl/Cmd to select multiple genres</p>
                  </div>

                  {/* Companies */}
                  <div>
                    <label className="block text-white mb-2">Production Companies (optional)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={companySearchQuery}
                        onChange={(e) => handleCompanySearch(e.target.value)}
                        placeholder="Search for companies..."
                        className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                      />
                      {searchingCompanies && (
                        <div className="absolute right-3 top-2.5">
                          <i className="fas fa-spinner fa-spin text-gray-400"></i>
                        </div>
                      )}
                    </div>
                    
                    {/* Search Results Dropdown */}
                    {companySearchResults.length > 0 && (
                      <div className="mt-2 max-h-48 overflow-y-auto bg-gray-800 rounded border border-gray-700">
                        {companySearchResults.map(company => (
                          <button
                            key={company.id}
                            type="button"
                            onClick={() => addCompany(company)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-3"
                          >
                            {company.logo_path && (
                              <img
                                src={getImageUrl(company.logo_path, 'w92')}
                                alt={company.name}
                                className="w-8 h-8 object-contain"
                              />
                            )}
                            <span className="text-white">{company.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Selected Companies */}
                    {selectedCompanies.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedCompanies.map(company => (
                          <div
                            key={company.id}
                            className="bg-red-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
                          >
                            {company.logo_path && (
                              <img
                                src={getImageUrl(company.logo_path, 'w92')}
                                alt={company.name}
                                className="w-5 h-5 object-contain"
                              />
                            )}
                            <span>{company.name}</span>
                            <button
                              type="button"
                              onClick={() => removeCompany(company.id)}
                              className="ml-1 hover:text-red-200"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Year Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white mb-2">
                        {tmdbFilters.media_type === 'movie' ? 'Release Year' : 'First Air Year'} (optional)
                      </label>
                      <input
                        type="number"
                        value={tmdbFilters.primary_release_year || tmdbFilters.first_air_date_year || ''}
                        onChange={(e) => {
                          const year = e.target.value ? parseInt(e.target.value) : undefined;
                          if (tmdbFilters.media_type === 'movie') {
                            setTmdbFilters({ ...tmdbFilters, primary_release_year: year });
                          } else {
                            setTmdbFilters({ ...tmdbFilters, first_air_date_year: year });
                          }
                        }}
                        placeholder="2023"
                        min="1900"
                        max={new Date().getFullYear() + 1}
                        className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                      />
                    </div>
                    <div>
                      <label className="block text-white mb-2">Rating Range (optional)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={tmdbFilters['vote_average.gte'] || ''}
                        onChange={(e) => {
                          const rating = e.target.value ? parseFloat(e.target.value) : undefined;
                          setTmdbFilters({ ...tmdbFilters, 'vote_average.gte': rating });
                        }}
                        placeholder="Min rating (0-10)"
                        className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                      />
                    </div>
                  </div>

                  {/* Sort By */}
                  <div>
                    <label className="block text-white mb-2">Sort By</label>
                    <select
                      value={tmdbFilters.sort_by || 'popularity.desc'}
                      onChange={(e) => setTmdbFilters({ ...tmdbFilters, sort_by: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                    >
                      {(tmdbFilters.media_type === 'tv' ? tvSortByOptions : sortByOptions).map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Preview Button */}
                  <div className="flex gap-2">
                    <button
                      onClick={previewFilters}
                      disabled={loadingPreview}
                      className="btn-secondary disabled:opacity-50"
                    >
                      {loadingPreview ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Loading...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-eye mr-2"></i>
                          Preview Results
                        </>
                      )}
                    </button>
                  </div>

                  {/* Preview Results */}
                  {filterPreview.length > 0 && (
                    <div className="mt-4">
                      <p className="text-white font-semibold mb-2">Preview ({filterPreview.length} results):</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-64 overflow-y-auto">
                        {filterPreview.map((movie: any) => (
                          <div key={`${movie.id}-${movie.media_type}`} className="bg-gray-800 rounded-lg overflow-hidden">
                            {movie.poster_path ? (
                              <img
                                src={getImageUrl(movie.poster_path, 'w500')}
                                alt={movie.title || movie.name}
                                className="w-full aspect-[2/3] object-cover"
                              />
                            ) : (
                              <div className="w-full aspect-[2/3] bg-gray-600 flex items-center justify-center">
                                <i className="fas fa-image text-gray-400"></i>
                              </div>
                            )}
                            <div className="p-2">
                              <p className="text-white text-xs font-semibold truncate">{movie.title || movie.name}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={createCustomCategory}
                disabled={saving || !newCategoryTitle.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Creating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i>
                    Create Category
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {sections.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Total sections: <strong className="text-white">{sections.length}</strong> 
              ({sections.filter(s => s.section_type === 'builtin').length} built-in, {sections.filter(s => s.section_type === 'custom').length} custom)
            </div>
            <button
              onClick={loadSections}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              <i className="fas fa-sync-alt mr-1"></i>
              Refresh
            </button>
          </div>
        )}

        {/* Page Visibility Tabs */}
        <div className="mb-4 flex gap-2 border-b border-gray-700">
          <button
            onClick={() => setActivePage('all')}
            className={`px-4 py-2 font-medium capitalize ${
              activePage === 'all'
                ? 'border-b-2 border-red-600 text-red-600'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All Sections (Global Order)
          </button>
          {PAGE_OPTIONS.map(page => (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              className={`px-4 py-2 font-medium capitalize ${
                activePage === page
                  ? 'border-b-2 border-red-600 text-red-600'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {page === 'tv-shows' ? 'TV Shows' : page}
            </button>
          ))}
        </div>

        {/* Sections List */}
        <div className="space-y-3">
          {(activePage === 'all' ? sections : getSectionsForPage(activePage)).map((section, index) => {
            const allSectionsForPage = activePage === 'all' ? sections : getSectionsForPage(activePage);
            const sectionIndex = allSectionsForPage.findIndex(s => s.id === section.id);
            
            return (
              <div key={section.id} className="bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between p-4 hover:bg-gray-600 transition-colors">
                  <div className="flex items-center space-x-4 flex-1">
                    {/* Ordering arrows */}
                    <div className="flex flex-col space-y-1">
                      <button
                        onClick={async () => {
                          if (activePage === 'all') {
                            // Global ordering - use moveSection
                            moveSection(sections.findIndex(s => s.id === section.id), 'up');
                          } else {
                            // Per-page ordering
                            await updatePageOrder(section.id, activePage, 'up');
                          }
                        }}
                        disabled={sectionIndex === 0}
                        className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        title={activePage === 'all' ? 'Move up (global order)' : `Move up on ${activePage}`}
                      >
                        <i className="fas fa-chevron-up"></i>
                      </button>
                      <button
                        onClick={async () => {
                          if (activePage === 'all') {
                            // Global ordering - use moveSection
                            moveSection(sections.findIndex(s => s.id === section.id), 'down');
                          } else {
                            // Per-page ordering
                            await updatePageOrder(section.id, activePage, 'down');
                          }
                        }}
                        disabled={sectionIndex === allSectionsForPage.length - 1}
                        className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        title={activePage === 'all' ? 'Move down (global order)' : `Move down on ${activePage}`}
                      >
                        <i className="fas fa-chevron-down"></i>
                      </button>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold text-lg">{section.title}</h3>
                        {section.section_type === 'custom' && (
                          <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded font-semibold">CUSTOM</span>
                        )}
                        {section.config?.tmdb_filters && (
                          <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded font-semibold">AUTO</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">
                        {section.section_type === 'builtin' 
                          ? 'Built-in Section' 
                          : selectedCustomData && section.id === selectedCategoryId
                            ? `${selectedCustomData.movies?.length || 0} movies`
                            : 'Custom Section'}
                      </p>
                      {/* Page visibility badges */}
                      <div className="flex gap-1 mt-1">
                        {(section.config?.visible_on || ['homepage']).map(page => (
                          <span key={page} className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">
                            {page === 'tv-shows' ? 'TV' : page}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    {/* Edit button for built-in sections */}
                    {section.section_type === 'builtin' && (
                      <button
                        onClick={() => setEditingSection(editingSection === section.id ? null : section.id)}
                        className="btn-secondary text-sm"
                      >
                        <i className="fas fa-edit mr-2"></i>
                        {editingSection === section.id ? 'Cancel' : 'Edit'}
                      </button>
                    )}
                    
                    {/* Manage Movies button for custom sections */}
                    {section.section_type === 'custom' && (
                      <button
                        onClick={() => setSelectedCategoryId(selectedCategoryId === section.id ? null : section.id)}
                        className="btn-secondary text-sm"
                      >
                        <i className="fas fa-edit mr-2"></i>
                        {selectedCategoryId === section.id ? 'Hide' : 'Manage'}
                      </button>
                    )}
                    
                    {/* Delete button (for all sections) */}
                    <button
                      onClick={() => deleteSection(section)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm"
                      disabled={saving}
                      title="Delete section"
                    >
                      <i className="fas fa-trash"></i>
                    </button>

                    <span className="text-gray-400">#{sectionIndex + 1}</span>
                    
                    {/* Enable/Disable toggle */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={() => toggleEnabled(section)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                  </div>
                </div>

                {/* Edit Panel for Built-in Sections */}
                {editingSection === section.id && section.section_type === 'builtin' && (
                  <div className="p-4 bg-gray-600 border-t border-gray-700 space-y-4">
                    <h4 className="text-white font-semibold">Edit "{section.title}"</h4>
                    
                    {/* Title Edit */}
                    <div>
                      <label className="block text-white mb-2">Title</label>
                      <input
                        type="text"
                        defaultValue={section.title}
                        onBlur={(e) => {
                          if (e.target.value !== section.title) {
                            updateBuiltinSection(section, { title: e.target.value });
                          }
                        }}
                        className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                      />
                    </div>

                    {/* Page Visibility Toggles */}
                    <div>
                      <label className="block text-white mb-2">Page Visibility</label>
                      <div className="flex gap-4">
                        {PAGE_OPTIONS.map(page => {
                          const isVisible = (section.config?.visible_on || ['homepage']).includes(page);
                          return (
                            <label key={page} className="flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isVisible}
                                onChange={() => togglePageVisibility(section.id, page)}
                                className="w-4 h-4 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500"
                              />
                              <span className="ml-2 text-white capitalize">
                                {page === 'tv-shows' ? 'TV Shows' : page}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* TMDB Filters for Built-in Sections */}
                    <div>
                      <label className="block text-white mb-2">TMDB Filters (Optional)</label>
                      {section.config?.tmdb_filters ? (
                        <div className="p-3 bg-gray-700 rounded">
                          <p className="text-green-400 text-sm mb-2">✓ Filters are configured</p>
                          <div className="text-sm text-gray-300 mb-2">
                            {section.config.tmdb_filters.media_type && (
                              <p>Type: {section.config.tmdb_filters.media_type}</p>
                            )}
                            {section.config.tmdb_filters.with_genres && section.config.tmdb_filters.with_genres.length > 0 && (
                              <p>Genres: {section.config.tmdb_filters.with_genres.length} selected</p>
                            )}
                          </div>
                          <button
                            onClick={async () => {
                              const newConfig = { ...section.config };
                              delete newConfig.tmdb_filters;
                              await updateSectionConfig(section.id, newConfig);
                              setMessage({ type: 'success', text: 'Filters removed. Section will use default behavior.' });
                            }}
                            className="btn-secondary text-sm"
                          >
                            <i className="fas fa-times mr-2"></i>
                            Remove Filters
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-700 rounded text-sm text-gray-400">
                          <p>To add filters to this section, create a new "Auto-Generated" category with the same title and delete this one.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Page Visibility Panel */}
                {editingSection !== section.id && (
                  <div className="px-4 pb-2">
                    <div className="flex gap-2 text-xs">
                      <span className="text-gray-400">Visible on:</span>
                      {PAGE_OPTIONS.map(page => {
                        const isVisible = (section.config?.visible_on || ['homepage']).includes(page);
                        return (
                          <button
                            key={page}
                            onClick={() => togglePageVisibility(section.id, page)}
                            className={`px-2 py-1 rounded ${
                              isVisible 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-600 text-gray-400 hover:bg-gray-500'
                            }`}
                          >
                            {page === 'tv-shows' ? 'TV Shows' : page}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Filter Editing for Custom Sections with TMDB Filters */}
                {section.section_type === 'custom' && section.config?.tmdb_filters && (
                  <div className="p-4 bg-gray-600 border-t border-gray-700">
                    {editingFilters === section.id ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-white font-semibold">Edit TMDB Filters</h4>
                          <button
                            onClick={() => {
                              setEditingFilters(null);
                              // Reset filters to original
                              if (section.config?.tmdb_filters) {
                                setTmdbFilters(section.config.tmdb_filters);
                              } else {
                                setTmdbFilters({ media_type: 'movie', sort_by: 'popularity.desc' });
                              }
                              setSelectedCompanies([]);
                              setCompanySearchQuery('');
                              setCompanySearchResults([]);
                            }}
                            className="text-gray-400 hover:text-white"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                        
                        {/* Media Type */}
                        <div>
                          <label className="block text-white mb-2">Media Type *</label>
                          <select
                            value={tmdbFilters.media_type || 'movie'}
                            onChange={async (e) => {
                              const newType = e.target.value as 'movie' | 'tv';
                              setTmdbFilters({ ...tmdbFilters, media_type: newType });
                              await loadGenres(newType);
                            }}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                          >
                            <option value="movie">Movies</option>
                            <option value="tv">TV Shows</option>
                          </select>
                        </div>

                        {/* Genres */}
                        <div>
                          <label className="block text-white mb-2">Genres (optional)</label>
                          <select
                            multiple
                            value={tmdbFilters.with_genres?.map(String) || []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions, opt => parseInt(opt.value));
                              setTmdbFilters({ ...tmdbFilters, with_genres: selected });
                            }}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600 h-32"
                          >
                            {availableGenres.map(genre => (
                              <option key={genre.id} value={genre.id}>{genre.name}</option>
                            ))}
                          </select>
                          <p className="text-gray-400 text-xs mt-1">Hold Ctrl/Cmd to select multiple genres</p>
                        </div>

                        {/* Companies */}
                        <div>
                          <label className="block text-white mb-2">Production Companies (optional)</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={companySearchQuery}
                              onChange={(e) => handleCompanySearch(e.target.value)}
                              placeholder="Search for companies..."
                              className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                            />
                            {searchingCompanies && (
                              <div className="absolute right-3 top-2.5">
                                <i className="fas fa-spinner fa-spin text-gray-400"></i>
                              </div>
                            )}
                          </div>
                          
                          {/* Search Results Dropdown */}
                          {companySearchResults.length > 0 && (
                            <div className="mt-2 max-h-48 overflow-y-auto bg-gray-800 rounded border border-gray-700">
                              {companySearchResults.map(company => (
                                <button
                                  key={company.id}
                                  type="button"
                                  onClick={() => addCompany(company)}
                                  className="w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-3"
                                >
                                  {company.logo_path && (
                                    <img
                                      src={getImageUrl(company.logo_path, 'w92')}
                                      alt={company.name}
                                      className="w-8 h-8 object-contain"
                                    />
                                  )}
                                  <span className="text-white">{company.name}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Selected Companies */}
                          {selectedCompanies.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {selectedCompanies.map(company => (
                                <div
                                  key={company.id}
                                  className="bg-red-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
                                >
                                  {company.logo_path && (
                                    <img
                                      src={getImageUrl(company.logo_path, 'w92')}
                                      alt={company.name}
                                      className="w-5 h-5 object-contain"
                                    />
                                  )}
                                  <span>{company.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeCompany(company.id)}
                                    className="ml-1 hover:text-red-200"
                                  >
                                    <i className="fas fa-times"></i>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Year Range */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-white mb-2">
                              {tmdbFilters.media_type === 'movie' ? 'Release Year' : 'First Air Year'} (optional)
                            </label>
                            <input
                              type="number"
                              value={tmdbFilters.primary_release_year || tmdbFilters.first_air_date_year || ''}
                              onChange={(e) => {
                                const year = e.target.value ? parseInt(e.target.value) : undefined;
                                if (tmdbFilters.media_type === 'movie') {
                                  setTmdbFilters({ ...tmdbFilters, primary_release_year: year });
                                } else {
                                  setTmdbFilters({ ...tmdbFilters, first_air_date_year: year });
                                }
                              }}
                              placeholder="2023"
                              min="1900"
                              max={new Date().getFullYear() + 1}
                              className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                            />
                          </div>
                          <div>
                            <label className="block text-white mb-2">Rating Range (optional)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              value={tmdbFilters['vote_average.gte'] || ''}
                              onChange={(e) => {
                                const rating = e.target.value ? parseFloat(e.target.value) : undefined;
                                setTmdbFilters({ ...tmdbFilters, 'vote_average.gte': rating });
                              }}
                              placeholder="Min rating (0-10)"
                              className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                            />
                          </div>
                        </div>

                        {/* Sort By */}
                        <div>
                          <label className="block text-white mb-2">Sort By</label>
                          <select
                            value={tmdbFilters.sort_by || 'popularity.desc'}
                            onChange={(e) => setTmdbFilters({ ...tmdbFilters, sort_by: e.target.value })}
                            className="w-full px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                          >
                            {(tmdbFilters.media_type === 'tv' ? tvSortByOptions : sortByOptions).map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveFilters(section.id)}
                            disabled={saving}
                            className="btn-primary disabled:opacity-50"
                          >
                            {saving ? (
                              <>
                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                Saving...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-save mr-2"></i>
                                Save Filters
                              </>
                            )}
                          </button>
                          <button
                            onClick={previewFilters}
                            disabled={loadingPreview}
                            className="btn-secondary disabled:opacity-50"
                          >
                            {loadingPreview ? (
                              <>
                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                Loading...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-eye mr-2"></i>
                                Preview
                              </>
                            )}
                          </button>
                        </div>

                        {/* Preview Results */}
                        {filterPreview.length > 0 && (
                          <div className="mt-4">
                            <p className="text-white font-semibold mb-2">Preview ({filterPreview.length} results):</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-64 overflow-y-auto">
                              {filterPreview.map((movie: any) => (
                                <div key={`${movie.id}-${movie.media_type}`} className="bg-gray-800 rounded-lg overflow-hidden">
                                  {movie.poster_path ? (
                                    <img
                                      src={getImageUrl(movie.poster_path, 'w500')}
                                      alt={movie.title || movie.name}
                                      className="w-full aspect-[2/3] object-cover"
                                    />
                                  ) : (
                                    <div className="w-full aspect-[2/3] bg-gray-600 flex items-center justify-center">
                                      <i className="fas fa-image text-gray-400"></i>
                                    </div>
                                  )}
                                  <div className="p-2">
                                    <p className="text-white text-xs font-semibold truncate">{movie.title || movie.name}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-700 rounded">
                        <p className="text-green-400 text-sm mb-2">✓ Auto-Generated Category</p>
                        <div className="text-sm text-gray-300 mb-2">
                          {section.config.tmdb_filters.media_type && (
                            <p>Type: {section.config.tmdb_filters.media_type}</p>
                          )}
                          {section.config.tmdb_filters.with_genres && section.config.tmdb_filters.with_genres.length > 0 && (
                            <p>Genres: {section.config.tmdb_filters.with_genres.length} selected</p>
                          )}
                          {section.config.tmdb_filters.with_companies && section.config.tmdb_filters.with_companies.length > 0 && (
                            <p>Companies: {section.config.tmdb_filters.with_companies.length} selected</p>
                          )}
                          {section.config.tmdb_filters.primary_release_year && (
                            <p>Year: {section.config.tmdb_filters.primary_release_year}</p>
                          )}
                          {section.config.tmdb_filters.first_air_date_year && (
                            <p>Year: {section.config.tmdb_filters.first_air_date_year}</p>
                          )}
                          {section.config.tmdb_filters['vote_average.gte'] && (
                            <p>Min Rating: {section.config.tmdb_filters['vote_average.gte']}</p>
                          )}
                        </div>
                        <button
                          onClick={() => loadFiltersForEditing(section)}
                          className="btn-secondary text-sm"
                        >
                          <i className="fas fa-edit mr-2"></i>
                          Edit Filters
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Movie Management for Custom Categories */}
                {selectedCategoryId === section.id && section.section_type === 'custom' && selectedCustomData && (
                  <div className="p-4 bg-gray-600 border-t border-gray-700">
                    <h4 className="text-white font-semibold mb-4">Manage Movies in "{section.title}"</h4>
                    
                    {/* Movie Search */}
                    <div className="mb-4">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (e.target.value.trim()) {
                              searchMovies(e.target.value);
                            } else {
                              setSearchResults([]);
                            }
                          }}
                          placeholder="Search movies or TV shows..."
                          className="flex-1 px-4 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
                        />
                        {searching && (
                          <div className="flex items-center text-gray-400">
                            <i className="fas fa-spinner fa-spin"></i>
                          </div>
                        )}
                      </div>

                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="mt-4">
                          <p className="text-gray-400 text-sm mb-2">Search Results:</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {searchResults.map((movie) => {
                              const movieKey = `${movie.id}-${movie.media_type}`;
                              const isInCategory = selectedCustomData.movies?.some(
                                (m: any) => m.id === movie.id && m.media_type === movie.media_type
                              );
                              const isAdding = addingMovieId === movieKey;

                              return (
                                <div
                                  key={movieKey}
                                  className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors cursor-pointer"
                                  onClick={() => !isAdding && !isInCategory && addMovieToCategory(section, movie)}
                                >
                                  {movie.poster_path ? (
                                    <img
                                      src={getImageUrl(movie.poster_path, 'w500')}
                                      alt={movie.title || movie.name}
                                      className="w-full aspect-[2/3] object-cover"
                                    />
                                  ) : (
                                    <div className="w-full aspect-[2/3] bg-gray-600 flex items-center justify-center">
                                      <i className="fas fa-image text-gray-400"></i>
                                    </div>
                                  )}
                                  <div className="p-2">
                                    <p className="text-white text-xs font-semibold truncate">
                                      {movie.title || movie.name}
                                    </p>
                                    {isAdding && (
                                      <p className="text-yellow-500 text-xs mt-1">
                                        <i className="fas fa-spinner fa-spin mr-1"></i>
                                        Adding...
                                      </p>
                                    )}
                                    {isInCategory && (
                                      <p className="text-green-500 text-xs mt-1">
                                        <i className="fas fa-check mr-1"></i>
                                        In category
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Movies in Category */}
                    <div>
                      <p className="text-gray-400 text-sm mb-2">
                        Movies in this category ({selectedCustomData.movies?.length || 0}):
                      </p>
                      {selectedCustomData.movies && selectedCustomData.movies.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                          {selectedCustomData.movies.map((movie: any) => (
                            <div key={`${movie.id}-${movie.media_type}`} className="bg-gray-800 rounded-lg overflow-hidden">
                              {movie.poster_path ? (
                                <img
                                  src={getImageUrl(movie.poster_path, 'w500')}
                                  alt={movie.title}
                                  className="w-full aspect-[2/3] object-cover"
                                />
                              ) : (
                                <div className="w-full aspect-[2/3] bg-gray-600 flex items-center justify-center">
                                  <i className="fas fa-image text-gray-400"></i>
                                </div>
                              )}
                              <div className="p-2">
                                <p className="text-white text-xs font-semibold truncate">{movie.title}</p>
                                <button
                                  onClick={() => removeMovieFromCategory(section, movie.id, movie.media_type)}
                                  className="text-red-500 text-xs mt-1 hover:text-red-400"
                                  disabled={saving}
                                >
                                  <i className="fas fa-trash mr-1"></i>
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No movies added yet. Search above to add movies.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {sections.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <i className="fas fa-inbox text-4xl mb-4"></i>
            <p>No sections found. Click "Initialize Default Sections" to get started.</p>
            <button
              onClick={async () => {
                await initializeDefaultSections();
                await loadSections();
              }}
              className="btn-primary mt-4"
            >
              Initialize Default Sections
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
