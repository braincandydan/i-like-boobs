const apiKey = '6f2345080ac02f962901b6baa3723f58';
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2ZjIzNDUwODBhYzAyZjk2MjkwMWI2YmFhMzcyM2Y1OCIsInN1YiI6IjY1NmFhZDExZjBmNTBlZDEwNWIzNTM0YyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Z-oU6dL94w36cr2WWJ8P7lR4-5qskfqFYXj82I3kGng';

// Fetch content for a specific category
async function fetchContent(endpoint, containerId) {
    const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        displayMovies(data.results.slice(0, 10), containerId);
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
    }
}

// Display movies in the specified container
function displayMovies(moviesData, containerId, category) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const moviesToShow = moviesData.slice(0, 4);

  moviesToShow.forEach(movie => {
      const movieDiv = createMovieElement(movie);
      container.appendChild(movieDiv);
  });

  // Add "See All" button
  const seeAllButton = document.createElement('button');
  seeAllButton.textContent = 'See All';
  seeAllButton.className = 'see-all-button';
  seeAllButton.addEventListener('click', () => handleSeeAll(category));
  container.appendChild(seeAllButton);
}

function createMovieElement(movie) {
  const movieDiv = document.createElement('div');
  movieDiv.className = 'movie';
  movieDiv.tabIndex = 0;

  if (movie.poster_path) {
      const image = document.createElement('img');
      image.src = `https://image.tmdb.org/t/p/w500/${movie.poster_path}`;
      image.alt = `${movie.title || movie.name} Poster`;
      image.className = 'movie-poster';
      movieDiv.appendChild(image);
  }

  movieDiv.addEventListener('click', () => showMovieDetails(movie));
  movieDiv.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
          showMovieDetails(movie);
      }
  });

  return movieDiv;
}

function handleSeeAll(category) {
  // Use the existing searchMedia function to show all movies in the category
  searchMedia(category, 'movie');
}

// Show movie details in modal
async function showMovieDetails(movie) {
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    const movieDetails = await getMovieDetails(movie.id, mediaType);
    const imdbId = await getImdbId(movie.id, mediaType);
    
    if (movieDetails) {
        displayMovieDetails(movieDetails, imdbId, mediaType);
        document.getElementById('movie-modal').style.display = 'block';
    }
}

// Get IMDB ID
async function getImdbId(tmdbId, mediaType) {
    const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
    const externalIdsUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${apiKey}`;
    try {
        const response = await fetch(externalIdsUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        return data.imdb_id || null;
    } catch (error) {
        console.error('Error fetching IMDb ID:', error);
        return null;
    }
}

// Get movie details
async function getMovieDetails(tmdbId, mediaType) {
    const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
    const detailsUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${apiKey}&append_to_response=credits,videos`;
    try {
        const response = await fetch(detailsUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching movie details:', error);
        return null;
    }
}

// Display movie details in modal
function displayMovieDetails(movie, imdbId, mediaType) {
  const modalContent = document.getElementById('movie-details');
  const title = movie.title || movie.name;
  const releaseDate = movie.release_date || movie.first_air_date;
  const overview = movie.overview;
  const voteAverage = movie.vote_average;
  const director = movie.credits.crew.find(person => person.job === 'Director')?.name || 'N/A';
  const cast = movie.credits.cast.slice(0, 3).map(actor => actor.name).join(', '); // Limit to top 3 cast members
  const trailer = movie.videos.results.find(video => video.type === 'Trailer');

  let trailerHtml = '';
  let trailerLink = '';
  if (trailer) {
      trailerLink = `https://www.youtube.com/watch?v=${trailer.key}`;
      trailerHtml = `
          <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${trailer.key}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
      `;
  }

  let watchLink = imdbId 
      ? `https://vidsrc.xyz/embed/${mediaType}?imdb=${imdbId}`
      : `https://vidsrc.xyz/embed/${mediaType}?tmdb=${movie.id}`;

  // Truncate overview if it's too long
  const truncatedOverview = overview.length > 200 ? overview.substring(0, 200) + '...' : overview;

  modalContent.innerHTML = `
      <span class="close">&times;</span>
      <div class="modal-grid">
          <div class="modal-info">
              <h2>${title}</h2>
              <p><strong>Release Date:</strong> ${releaseDate}</p>
              <p><strong>Director:</strong> ${director}</p>
              <p><strong>Cast:</strong> ${cast}</p>
              <p><strong>Rating:</strong> ${voteAverage}/10</p>
              <h3>Overview</h3>
              <p>${truncatedOverview}</p>
              <div class="watch-options">
                  <a href="${watchLink}" target="_blank" class="watch-link">Watch Full ${mediaType === 'tv' ? 'Show' : 'Movie'}</a>
                  ${trailer ? `<a href="${trailerLink}" target="_blank" class="watch-link trailer-link">Watch Trailer</a>` : ''}
              </div>
          </div>
          <div class="modal-media">
              ${trailerHtml}
          </div>
      </div>
  `;

  // Reattach close button event listener
  document.querySelector('.close').addEventListener('click', () => {
      document.getElementById('movie-modal').style.display = 'none';
  });
}

// Search for movies or TV shows
async function searchMedia(query, mediaType) {
    const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(query)}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        hideAllSections();
        displayMovies(data.results, 'search-results-content');
        document.getElementById('search-results').style.display = 'block';
    } catch (error) {
        console.error('Error searching:', error);
    }
}

// Hide all content sections except search results
function hideAllSections() {
    const sections = ['home', 'movies', 'tv-shows'];
    sections.forEach(section => {
        document.getElementById(section).style.display = 'none';
    });
}

// Show all content sections and hide search results
function showAllSections() {
    const sections = ['home', 'movies', 'tv-shows'];
    sections.forEach(section => {
        document.getElementById(section).style.display = 'block';
    });
    document.getElementById('search-results').style.display = 'none';
}

// Clear search and restore original view
function clearSearch() {
    document.getElementById('search-input').value = '';
    showAllSections();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Load initial content
  fetchContent('movie/popular', 'featured-content', 'Popular Movies');
  fetchContent('trending/all/day', 'trending-content', 'Trending');
  fetchContent('movie/top_rated', 'top-rated-content', 'Top Rated');
  fetchContent('tv/popular', 'popular-tv-content', 'Popular TV Shows');

    // Search form event listener
    document.getElementById('search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('search-input').value;
        const mediaType = document.getElementById('media-type').value;
        if (query.trim() !== '') {
            searchMedia(query, mediaType);
        } else {
            clearSearch();
        }
    });

    // Add clear search button
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear Search';
    clearButton.id = 'clear-search';
    clearButton.addEventListener('click', clearSearch);
    document.getElementById('search-form').appendChild(clearButton);

    // Modal close button
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('movie-modal').style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('movie-modal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

let currentFocus = null;

function handleKeyNavigation(event) {
    const focusableElements = document.querySelectorAll('.movie, button, input, select');
    const focusArray = Array.from(focusableElements);

    if (!currentFocus) {
        currentFocus = focusArray[0];
        currentFocus.focus();
        return;
    }

    const currentIndex = focusArray.indexOf(currentFocus);

    switch(event.key) {
        case 'ArrowRight':
            if (currentIndex < focusArray.length - 1) {
                currentFocus = focusArray[currentIndex + 1];
            }
            break;
        case 'ArrowLeft':
            if (currentIndex > 0) {
                currentFocus = focusArray[currentIndex - 1];
            }
            break;
        case 'ArrowUp':
            const upIndex = Math.max(0, currentIndex - 5);
            currentFocus = focusArray[upIndex];
            break;
        case 'ArrowDown':
            const downIndex = Math.min(focusArray.length - 1, currentIndex + 5);
            currentFocus = focusArray[downIndex];
            break;
    }

    currentFocus.focus();
    event.preventDefault();
}

// Add this function to your existing code
function initializeSearchInput() {
  const searchInput = document.getElementById('search-input');
  const searchForm = document.getElementById('search-form');

  if (searchInput) {
      // Ensure the input is enabled and focusable
      searchInput.disabled = false;
      searchInput.readOnly = false;

      // Add event listeners for debugging
      searchInput.addEventListener('focus', () => {
          console.log('Search input focused');
      });

      searchInput.addEventListener('blur', () => {
          console.log('Search input blurred');
      });

      searchInput.addEventListener('input', (event) => {
          console.log('Input event:', event.target.value);
      });

      // Prevent arrow key navigation from interfering with typing
      searchInput.addEventListener('keydown', (event) => {
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
              event.stopPropagation();
          }
      });
  } else {
      console.error('Search input not found');
  }

  if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const query = searchInput.value;
          console.log('Search submitted:', query);
          // Your existing search logic here
      });
  } else {
      console.error('Search form not found');
  }
}

// Modify your existing DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
  // Your existing code here...

  // Initialize search input
  initializeSearchInput();

  // Modify handleKeyNavigation function
  window.handleKeyNavigation = (event) => {
      // Don't interfere with typing in the search input
      if (document.activeElement.id === 'search-input') {
          return;
      }
      
      // Your existing handleKeyNavigation code here...
  };
});