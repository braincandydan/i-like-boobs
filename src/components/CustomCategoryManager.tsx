import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, type CustomSection, type HomepageSection } from '../lib/supabase';
import { $user } from '../stores/auth';
import { useStore } from '@nanostores/react';
import { fetchFromTMDB, tmdbEndpoints, getImageUrl } from '../lib/tmdb';

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

export default function CustomCategoryManager() {
  const user = useStore($user);
  const [categories, setCategories] = useState<CustomSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Category creation state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  
  // Movie search state
  const [selectedCategory, setSelectedCategory] = useState<CustomSection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingMovieId, setAddingMovieId] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    if (!isSupabaseConfigured() || !user) return;

    try {
      const { data, error } = await supabase!
        .from('custom_sections')
        .select('*')
        .eq('type', 'manual')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCategories((data as CustomSection[]) || []);
    } catch (error: any) {
      console.error('Error loading categories:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to load categories' });
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async () => {
    if (!isSupabaseConfigured() || !user || !newCategoryTitle.trim()) {
      setMessage({ type: 'error', text: 'Please enter a category title' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Create custom section
      const { data: sectionData, error: sectionError } = await supabase!
        .from('custom_sections')
        .insert({
          user_id: user.id,
          title: newCategoryTitle.trim(),
          description: newCategoryDescription.trim() || null,
          type: 'manual',
          movies: [],
          enabled: true,
          order_index: categories.length,
        })
        .select()
        .single();

      if (sectionError) throw sectionError;

      // Create homepage section entry so it appears in CategoryManager
      const homepageSectionData = {
        section_key: sectionData.id,
        title: newCategoryTitle.trim(),
        section_type: 'custom' as const,
        custom_section_id: sectionData.id,
        order_index: 999, // Will be reordered later
        enabled: true,
      };
      
      console.log('Creating homepage section entry:', homepageSectionData);
      
      const { data: homepageData, error: homepageError } = await supabase!
        .from('homepage_sections')
        .insert(homepageSectionData)
        .select()
        .single();

      if (homepageError) {
        console.error('Error creating homepage section:', homepageError);
        console.error('Full error details:', JSON.stringify(homepageError, null, 2));
        setMessage({ 
          type: 'error', 
          text: `Category created but couldn't add to homepage. Error: ${homepageError.message}. Check console for details.` 
        });
      } else {
        console.log('Homepage section created successfully:', homepageData);
        setMessage({ 
          type: 'success', 
          text: 'Category created successfully! It should now appear in the "Homepage Categories" tab for reordering.' 
        });
      }
      setNewCategoryTitle('');
      setNewCategoryDescription('');
      setShowCreateForm(false);
      await loadCategories();
    } catch (error: any) {
      console.error('Error creating category:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to create category' });
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

      // Filter to only movies and TV shows
      const results = (data.results || []).filter(
        (item: any) => item.media_type === 'movie' || item.media_type === 'tv'
      ) as Movie[];

      setSearchResults(results.slice(0, 20)); // Limit to 20 results
    } catch (error: any) {
      console.error('Error searching movies:', error);
      setMessage({ type: 'error', text: 'Failed to search movies' });
    } finally {
      setSearching(false);
    }
  };

  const addMovieToCategory = async (category: CustomSection, movie: Movie, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!isSupabaseConfigured()) {
      setMessage({ type: 'error', text: 'Supabase is not configured' });
      return;
    }

    if (!user) {
      setMessage({ type: 'error', text: 'You must be logged in to add movies' });
      return;
    }

    const movieKey = `${movie.id}-${movie.media_type}`;
    setAddingMovieId(movieKey);
    console.log('Adding movie to category:', { categoryId: category.id, movie: movie.title || movie.name });

    try {
      const currentMovies = Array.isArray(category.movies) ? category.movies : [];
      
      // Check if movie already exists
      const alreadyExists = currentMovies.some((m: any) => m.id === movie.id && m.media_type === movie.media_type);
      if (alreadyExists) {
        setMessage({ type: 'error', text: 'This movie is already in the category' });
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

      console.log('Updating category with movies:', updatedMovies.length);

      const { data, error } = await supabase!
        .from('custom_sections')
        .update({ 
          movies: updatedMovies,
          updated_at: new Date().toISOString(),
        })
        .eq('id', category.id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Update successful:', data);

      setMessage({ type: 'success', text: `"${movieData.title}" added to category!` });
      
      // Update selected category state immediately
      const updatedCategory = {
        ...category,
        movies: updatedMovies,
      } as CustomSection;
      setSelectedCategory(updatedCategory);
      
      // Reload categories to sync
      await loadCategories();
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error adding movie:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to add movie. Check console for details.' 
      });
    } finally {
      setAddingMovieId(null);
    }
  };

  const removeMovieFromCategory = async (category: CustomSection, movieId: number, mediaType: 'movie' | 'tv') => {
    if (!isSupabaseConfigured() || !user) return;

    try {
      const currentMovies = Array.isArray(category.movies) ? category.movies : [];
      const updatedMovies = currentMovies.filter(
        (m: any) => !(m.id === movieId && m.media_type === mediaType)
      );

      const { error } = await supabase!
        .from('custom_sections')
        .update({ 
          movies: updatedMovies,
          updated_at: new Date().toISOString(),
        })
        .eq('id', category.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Movie removed from category!' });
      await loadCategories();
      
      // Update selected category
      setSelectedCategory({
        ...category,
        movies: updatedMovies,
      } as CustomSection);
    } catch (error: any) {
      console.error('Error removing movie:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to remove movie' });
    }
  };

  const deleteCategory = async (category: CustomSection) => {
    if (!isSupabaseConfigured() || !user) return;
    if (!confirm(`Are you sure you want to delete "${category.title}"? This action cannot be undone.`)) return;

    try {
      // Delete homepage section first
      const { error: homepageError } = await supabase!
        .from('homepage_sections')
        .delete()
        .eq('custom_section_id', category.id);

      if (homepageError) console.error('Error deleting homepage section:', homepageError);

      // Delete custom section
      const { error } = await supabase!
        .from('custom_sections')
        .delete()
        .eq('id', category.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Category deleted successfully!' });
      await loadCategories();
      
      if (selectedCategory?.id === category.id) {
        setSelectedCategory(null);
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (error: any) {
      console.error('Error deleting category:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to delete category' });
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchMovies(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

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

      {/* Create Category Form */}
      {showCreateForm && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold text-white mb-4">Create New Category</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category Title *
              </label>
              <input
                type="text"
                value={newCategoryTitle}
                onChange={(e) => setNewCategoryTitle(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                placeholder="e.g., Action Movies, Sci-Fi Classics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                rows={3}
                placeholder="Brief description of this category"
              />
            </div>
            <div className="flex space-x-4">
              <button
                onClick={createCategory}
                disabled={saving || !newCategoryTitle.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Creating...' : 'Create Category'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewCategoryTitle('');
                  setNewCategoryDescription('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Custom Categories</h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-primary"
          >
            <i className="fas fa-plus mr-2"></i>
            {showCreateForm ? 'Cancel' : 'Create Category'}
          </button>
        </div>

        {categories.length === 0 && !showCreateForm && (
          <div className="text-center py-12 text-gray-400">
            <i className="fas fa-folder-open text-4xl mb-4"></i>
            <p>No custom categories yet. Create one to get started!</p>
          </div>
        )}

        <div className="space-y-4">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">{category.title}</h3>
                  {category.description && (
                    <p className="text-gray-400 text-sm mt-1">{category.description}</p>
                  )}
                  <p className="text-gray-400 text-xs mt-2">
                    {Array.isArray(category.movies) ? category.movies.length : 0} movies
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedCategory(selectedCategory?.id === category.id ? null : category);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="btn-secondary text-sm"
                  >
                    <i className="fas fa-edit mr-2"></i>
                    {selectedCategory?.id === category.id ? 'Hide' : 'Manage'}
                  </button>
                  <button
                    onClick={() => deleteCategory(category)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
                  >
                    <i className="fas fa-trash mr-2"></i>
                    Delete
                  </button>
                </div>
              </div>

              {/* Movie Management for Selected Category */}
              {selectedCategory?.id === category.id && (
                <div className="mt-4 pt-4 border-t border-gray-600">
                  {/* Search Bar */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Search Movies & TV Shows
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                        placeholder="Search by title..."
                      />
                      {searching && (
                        <div className="flex items-center px-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-white font-semibold mb-3">Search Results</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {searchResults.map((movie) => {
                          const movieKey = `${movie.id}-${movie.media_type}`;
                          const isInCategory = Array.isArray(category.movies) && 
                            category.movies.some((m: any) => m.id === movie.id && m.media_type === movie.media_type);
                          const isAdding = addingMovieId === movieKey;
                          
                          return (
                            <div
                              key={movieKey}
                              className={`bg-gray-800 rounded-lg overflow-hidden transition-all relative group ${
                                isInCategory 
                                  ? 'ring-2 ring-green-500 opacity-75 cursor-not-allowed' 
                                  : isAdding
                                  ? 'ring-2 ring-blue-500 opacity-50 cursor-wait'
                                  : 'hover:bg-gray-700 hover:scale-105 cursor-pointer'
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isInCategory && !isAdding) {
                                  addMovieToCategory(category, movie, e);
                                }
                              }}
                              title={
                                isInCategory 
                                  ? 'Already in category' 
                                  : isAdding
                                  ? 'Adding...'
                                  : `Click to add "${movie.title || movie.name}"`
                              }
                            >
                              {movie.poster_path ? (
                                <img
                                  src={getImageUrl(movie.poster_path, 'w500')}
                                  alt={movie.title || movie.name}
                                  className="w-full aspect-[2/3] object-cover pointer-events-none"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full aspect-[2/3] bg-gray-700 flex items-center justify-center pointer-events-none">
                                  <i className="fas fa-image text-gray-500"></i>
                                </div>
                              )}
                              {isInCategory && (
                                <div className="absolute top-2 right-2 bg-green-600 rounded-full p-1">
                                  <i className="fas fa-check text-white text-xs"></i>
                                </div>
                              )}
                              {isAdding && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                </div>
                              )}
                              <div className="p-2 pointer-events-none">
                                <p className="text-white text-xs font-semibold truncate">
                                  {movie.title || movie.name}
                                </p>
                                <p className="text-gray-400 text-xs capitalize">
                                  {movie.media_type}
                                </p>
                              </div>
                              {!isInCategory && (
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center pointer-events-none">
                                  <div className="bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                    <i className="fas fa-plus mr-1"></i>
                                    Add
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category Movies */}
                  <div>
                    <h4 className="text-white font-semibold mb-3">Movies in Category</h4>
                    {Array.isArray(category.movies) && category.movies.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {category.movies.map((movie: any) => (
                          <div
                            key={`${movie.id}-${movie.media_type}`}
                            className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition-colors group relative"
                          >
                            {movie.poster_path ? (
                              <img
                                src={getImageUrl(movie.poster_path, 'w500')}
                                alt={movie.title}
                                className="w-full aspect-[2/3] object-cover"
                              />
                            ) : (
                              <div className="w-full aspect-[2/3] bg-gray-700 flex items-center justify-center">
                                <i className="fas fa-image text-gray-500"></i>
                              </div>
                            )}
                            <div className="p-2">
                              <p className="text-white text-xs font-semibold truncate">
                                {movie.title}
                              </p>
                              <p className="text-gray-400 text-xs capitalize">
                                {movie.media_type}
                              </p>
                            </div>
                            <button
                              onClick={() => removeMovieFromCategory(category, movie.id, movie.media_type)}
                              className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <i className="fas fa-times text-xs"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-center py-8">
                        No movies in this category yet. Search and add movies above!
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

