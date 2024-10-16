const apiKey = '6f2345080ac02f962901b6baa3723f58';
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2ZjIzNDUwODBhYzAyZjk2MjkwMWI2YmFhMzcyM2Y1OCIsInN1YiI6IjY1NmFhZDExZjBmNTBlZDEwNWIzNTM0YyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Z-oU6dL94w36cr2WWJ8P7lR4-5qskfqFYXj82I3kGng';

// Global flag to control cursor-based navigation
let cursorNavigationEnabled = false;

// Fetch content for a specific category
async function fetchContent(endpoint, containerId, title) {
    const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        let contentSection = document.getElementById(containerId).closest('.content-section');
        if (!contentSection) {
            contentSection = document.createElement('div');
            contentSection.className = 'content-section';
            document.getElementById('home').appendChild(contentSection);
        }
        
        const titleElement = contentSection.querySelector('h2') || document.createElement('h2');
        titleElement.textContent = title;
        if (!titleElement.parentNode) {
            contentSection.insertBefore(titleElement, contentSection.firstChild);
        }
        
        let contentRow = document.getElementById(containerId);
        if (!contentRow) {
            contentRow = document.createElement('div');
            contentRow.className = 'content-row';
            contentRow.id = containerId;
            contentSection.appendChild(contentRow);
        }
        
        displayMovies(data.results.slice(0, 20), containerId);
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
    }
}

// Display movies in the specified container
function displayMovies(moviesData, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    moviesData.forEach(movie => {
        const movieDiv = createMovieElement(movie);
        container.appendChild(movieDiv);
    });
}

function createMovieElement(movie) {
    const movieDiv = document.createElement('div');
    movieDiv.className = 'movie';
    movieDiv.tabIndex = 0;  // Make sure this line is present
    movieDiv.movieData = movie;

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
    const id = movie.id;
    
    // Navigate to the details page
    window.location.href = `details.html?type=${mediaType}&id=${id}`;
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
  const director = movie.credits.crew.find(person => person.job === 'Director');
  const cast = movie.credits.cast.slice(0, 5); // Get top 5 cast members
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

  const truncatedOverview = overview.length > 200 ? overview.substring(0, 200) + '...' : overview;

  const castLinks = cast.map(actor => 
      `<a href="#" class="actor-link" data-actor-id="${actor.id}">${actor.name}</a>`
  ).join(', ');

  modalContent.innerHTML = `
      <span class="close">&times;</span>
      <div class="modal-grid">
          <div class="modal-info">
              <h2>${title}</h2>
              <p><strong>Release Date:</strong> ${releaseDate}</p>
              <p><strong>Director:</strong> <a href="#" class="director-link" data-director-id="${director ? director.id : ''}">${director ? director.name : 'N/A'}</a></p>
              <p><strong>Cast:</strong> ${castLinks}</p>
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

  // Add click event listener to director's name
  const directorLink = document.querySelector('.director-link');
  if (directorLink) {
      directorLink.addEventListener('click', (event) => {
          event.preventDefault();
          const directorId = event.target.dataset.directorId;
          if (directorId) {
              searchPersonWorks(directorId, event.target.textContent, 'Director');
          }
      });
  }

  // Add click event listeners to actors' names
  document.querySelectorAll('.actor-link').forEach(link => {
      link.addEventListener('click', (event) => {
          event.preventDefault();
          const actorId = event.target.dataset.actorId;
          if (actorId) {
              searchPersonWorks(actorId, event.target.textContent, 'Actor');
          }
      });
  });
}
// Search for movies or TV shows
async function searchMedia(query, mediaType) {
    const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(query)}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        displayMovies(data.results, 'search-results-content');
        document.getElementById('search-results').style.display = 'block';
        document.getElementById('home').style.display = 'none';
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

// Navigation-related code
let currentFocus = null;

function initializeNavigation() {
    const firstFocusableElement = document.querySelector('.movie, button, input, select, #search-toggle, nav ul li a');
    if (firstFocusableElement) {
        firstFocusableElement.focus();
        currentFocus = firstFocusableElement;
    }
    document.addEventListener('keydown', handleKeyNavigation);
}

function handleKeyNavigation(event) {
    // Don't interfere with typing in the search input
    if (document.activeElement.id === 'search-input') {
        return;
    }

    const focusableElements = document.querySelectorAll('h1, nav ul li a, #search-toggle, #search-input, #media-type, #search-form button, .movie');
    const focusArray = Array.from(focusableElements);

    if (!currentFocus) {
        currentFocus = focusArray[0];
        currentFocus.focus();
        return;
    }

    const currentIndex = focusArray.indexOf(currentFocus);

    switch(event.keyCode) {
        case 37: // Left arrow
            event.preventDefault();
            if (currentIndex > 0) {
                currentFocus = focusArray[currentIndex - 1];
            }
            break;
        case 39: // Right arrow
            event.preventDefault();
            if (currentIndex < focusArray.length - 1) {
                currentFocus = focusArray[currentIndex + 1];
            }
            break;
        case 38: // Up arrow
            event.preventDefault();
            currentFocus = findVerticalElement(focusArray, currentIndex, -1) || currentFocus;
            break;
        case 40: // Down arrow
            event.preventDefault();
            currentFocus = findVerticalElement(focusArray, currentIndex, 1) || currentFocus;
            break;
        case 13: // Enter
            if (currentFocus.tagName === 'A' || currentFocus.tagName === 'BUTTON') {
                currentFocus.click();
            } else if (currentFocus.classList.contains('movie')) {
                showMovieDetails(currentFocus.movieData);
            }
            event.preventDefault();
            return;
    }

    currentFocus.focus();
    ensureElementIsVisible(currentFocus);
}

// Add this function to handle the Fire TV Back button globally
function handleFireTVBack(event) {
    if (event.keyCode === 10008) {
        if (window.history.length > 1) {
            window.history.back();
        }
        event.preventDefault();
    }
}

// Add this new function to find the next vertical element
function findVerticalElement(elements, currentIndex, direction) {
    const currentRect = elements[currentIndex].getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentY = currentRect.top + (direction > 0 ? currentRect.height : 0);

    let closestElement = null;
    let closestDistance = Infinity;

    for (let i = 0; i < elements.length; i++) {
        if (i === currentIndex) continue;

        const rect = elements[i].getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const y = rect.top + (direction < 0 ? rect.height : 0);

        // Check if the element is in the correct direction (above or below)
        if ((direction > 0 && y <= currentY) || (direction < 0 && y >= currentY)) continue;

        const verticalDistance = Math.abs(y - currentY);
        const horizontalDistance = Math.abs(centerX - currentCenterX);

        // Prioritize vertical alignment, then horizontal proximity
        const distance = verticalDistance * 1000 + horizontalDistance;

        if (distance < closestDistance) {
            closestDistance = distance;
            closestElement = elements[i];
        }
    }

    return closestElement || elements[currentIndex];
}

function ensureElementIsVisible(element) {
    const container = element.closest('.content-row');
    if (container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        if (elementRect.right > containerRect.right) {
            container.scrollLeft += elementRect.right - containerRect.right + 20; // 20px extra for padding
        } else if (elementRect.left < containerRect.left) {
            container.scrollLeft -= containerRect.left - elementRect.left + 20; // 20px extra for padding
        }
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load initial content
    fetchContent('movie/popular', 'featured-content', 'Featured Hi');
    fetchContent('trending/all/day', 'trending-content', 'Trending Now');
    fetchContent('movie/popular', 'popular-movies', 'Popular Movies');
    fetchContent('tv/popular', 'popular-tv', 'Popular TV Shows');

    // Search form event listener
    document.getElementById('search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const query = document.getElementById('search-input').value;
        const mediaType = document.getElementById('media-type').value;
        if (query.trim() !== '') {
            searchMedia(query, mediaType);
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

    const searchToggle = document.getElementById('search-toggle');
    const searchForm = document.getElementById('search-form');

    // Ensure search form is closed by default
    searchForm.classList.remove('active');

    searchToggle.addEventListener('click', () => {
      searchForm.classList.toggle('active');
      if (searchForm.classList.contains('active')) {
        document.getElementById('search-input').focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (!searchForm.contains(event.target) && !searchToggle.contains(event.target)) {
        searchForm.classList.remove('active');
      }
    });

    // Initialize navigation
    initializeNavigation();

    // Initialize search input
    initializeSearchInput();

    // Add this to your DOMContentLoaded event listener
    document.addEventListener('keydown', handleFireTVBack);

    // Add mousemove event listener for all devices, but it won't do anything unless enabled
    document.addEventListener('mousemove', handleMouseMove);
});

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
            const mediaType = document.getElementById('media-type').value;
            console.log('Search submitted:', query, 'Media type:', mediaType);
            if (query.trim() !== '') {
                searchMedia(query, mediaType);
            } else {
                clearSearch();
            }
        });
    } else {
        console.error('Search form not found');
    }
}

async function searchDirectorWorks(directorId, directorName) {
  const url = `https://api.themoviedb.org/3/person/${directorId}/combined_credits?api_key=${apiKey}&language=en-US`;
  try {
      const response = await fetch(url);
      const data = await response.json();
      
      // Filter to include only movies and TV shows where the person was a director
      const directedWorks = data.crew.filter(work => work.job === 'Director');
      
      // Sort by popularity (descending)
      directedWorks.sort((a, b) => b.popularity - a.popularity);

      // Close the modal
      document.getElementById('movie-modal').style.display = 'none';

      // Display the results
      displayDirectorWorks(directedWorks, directorName);
  } catch (error) {
      console.error('Error fetching director works:', error);
  }
}

function displayDirectorWorks(works, directorName) {
  // Clear existing content
  const mainContent = document.querySelector('main');
  mainContent.innerHTML = '';

  // Create a new section for director's works
  const directorSection = document.createElement('section');
  directorSection.innerHTML = `<h2>Works directed by ${directorName}</h2>`;
  
  // Create a container for the works
  const worksContainer = document.createElement('div');
  worksContainer.className = 'content-row';

  // Display up to 20 works
  works.slice(0, 20).forEach(work => {
      const workElement = createMovieElement(work);
      worksContainer.appendChild(workElement);
  });

  directorSection.appendChild(worksContainer);
  mainContent.appendChild(directorSection);

  // Scroll to the top of the page
  window.scrollTo(0, 0);
}
async function searchPersonWorks(personId, personName, role) {
    const url = `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${apiKey}&language=en-US`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        let works;
        if (role === 'Director') {
            works = data.crew.filter(work => work.job === 'Director');
        } else {
            works = data.cast;
        }
        
        // Sort by popularity (descending)
        works.sort((a, b) => b.popularity - a.popularity);

        // Close the modal
        document.getElementById('movie-modal').style.display = 'none';

        // Display the results
        displayPersonWorks(works, personName, role);
    } catch (error) {
        console.error(`Error fetching ${role.toLowerCase()} works:`, error);
    }
}

function displayPersonWorks(works, personName, role) {
    // Clear existing content
    const mainContent = document.querySelector('main');
    mainContent.innerHTML = '';

    // Create a new section for person's works
    const personSection = document.createElement('section');
    personSection.innerHTML = `<h2>Works ${role === 'Director' ? 'directed' : 'featuring'} ${personName}</h2>`;
    
    // Create a container for the works
    const worksContainer = document.createElement('div');
    worksContainer.className = 'content-row';

    // Display up to 20 works
    works.slice(0, 20).forEach(work => {
        const workElement = createMovieElement(work);
        worksContainer.appendChild(workElement);
    });

    personSection.appendChild(worksContainer);
    mainContent.appendChild(personSection);

    // Scroll to the top of the page
    window.scrollTo(0, 0);
}

// Make showMovieDetails available globally
window.showMovieDetails = showMovieDetails;

// Function to handle mouse movement (now disabled by default)
function handleMouseMove(event) {
    if (!cursorNavigationEnabled) return;

    const currentTime = Date.now();
    // Ignore rapid movements (adjust the time threshold as needed)
    if (currentTime - lastMoveTime < 100) return;

    const newPosition = [event.clientX, event.clientY];
    const movement = [
        newPosition[0] - cursorPosition[0],
        newPosition[1] - cursorPosition[1]
    ];

    // Determine the primary direction of movement
    if (Math.abs(movement[0]) > Math.abs(movement[1])) {
        // Horizontal movement
        if (movement[0] > 0) {
            navigateDirection('right');
        } else {
            navigateDirection('left');
        }
    } else {
        // Vertical movement
        if (movement[1] > 0) {
            navigateDirection('down');
        } else {
            navigateDirection('up');
        }
    }

    // Update cursor position and last move time
    cursorPosition = newPosition;
    lastMoveTime = currentTime;
}

// Function to navigate in a given direction
function navigateDirection(direction) {
    const focusableElements = getFocusableElements();
    const currentIndex = focusableElements.indexOf(document.activeElement);
    let nextIndex;

    switch (direction) {
        case 'left':
            nextIndex = Math.max(0, currentIndex - 1);
            break;
        case 'right':
            nextIndex = Math.min(focusableElements.length - 1, currentIndex + 1);
            break;
        case 'up':
            nextIndex = findVerticalElement(focusableElements, currentIndex, -1);
            break;
        case 'down':
            nextIndex = findVerticalElement(focusableElements, currentIndex, 1);
            break;
    }

    if (nextIndex !== undefined && nextIndex !== currentIndex) {
        focusableElements[nextIndex].focus();
        ensureElementIsVisible(focusableElements[nextIndex]);
    }
}

// Function to get all focusable elements
function getFocusableElements() {
    return Array.from(document.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'));
}

// Function to enable/disable cursor-based navigation
function toggleCursorNavigation(enable) {
    cursorNavigationEnabled = enable;
}

// Update the existing handleKeyNavigation function
function handleKeyNavigation(event) {
    // Use keyboard navigation on all devices now
    switch(event.keyCode) {
        case 37: // Left arrow
        case 21: // KEYCODE_DPAD_LEFT
            navigateDirection('left');
            break;
        case 39: // Right arrow
        case 22: // KEYCODE_DPAD_RIGHT
            navigateDirection('right');
            break;
        case 38: // Up arrow
        case 19: // KEYCODE_DPAD_UP
            navigateDirection('up');
            break;
        case 40: // Down arrow
        case 20: // KEYCODE_DPAD_DOWN
            navigateDirection('down');
            break;
        case 13: // Enter
        case 66: // KEYCODE_BUTTON_A
            if (document.activeElement) {
                document.activeElement.click();
            }
            break;
    }

    event.preventDefault();
}

// Remove the isLikelyTV check from the keydown event listener
document.addEventListener('keydown', handleKeyNavigation);

// Remove or comment out the handleFireTVRemote function as it's no longer needed
// function handleFireTVRemote(event) { ... }

// Disable default focus outline
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        *:focus {
            outline: none !important;
        }
    `;
    document.head.appendChild(style);
});

// Prevent default behavior for mouse events
function preventDefaultForMouseEvents(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return; // Allow mouse events for input fields
    }
    e.preventDefault();
    e.stopPropagation();
}

// Add event listeners to prevent mouse interaction
['click', 'mousedown', 'mouseup', 'mousemove'].forEach(eventType => {
    document.addEventListener(eventType, preventDefaultForMouseEvents, { capture: true });
});

// Custom focus handler
function customFocusHandler(element) {
    if (element) {
        element.classList.add('custom-focus');
    }
}

// Custom blur handler
function customBlurHandler(element) {
    if (element) {
        element.classList.remove('custom-focus');
    }
}

// Update your CSS to include a custom focus style
const customFocusStyle = `
    .custom-focus {
        outline: 2px solid #007bff !important;
        outline-offset: 2px;
    }
`;
document.head.insertAdjacentHTML('beforeend', `<style>${customFocusStyle}</style>`);

// Modify your navigation function to use custom focus
function navigateDirection(direction) {
    const focusableElements = getFocusableElements();
    const currentIndex = focusableElements.indexOf(document.activeElement);
    let nextIndex;

    // ... (rest of the navigation logic)

    if (nextIndex !== undefined && nextIndex !== currentIndex) {
        customBlurHandler(document.activeElement);
        customFocusHandler(focusableElements[nextIndex]);
        focusableElements[nextIndex].focus();
        ensureElementIsVisible(focusableElements[nextIndex]);
    }
}

// Update handleKeyNavigation to include Enter key functionality
function handleKeyNavigation(event) {
    switch(event.keyCode) {
        case 37: // Left arrow
        case 21: // KEYCODE_DPAD_LEFT
            navigateDirection('left');
            break;
        case 39: // Right arrow
        case 22: // KEYCODE_DPAD_RIGHT
            navigateDirection('right');
            break;
        case 38: // Up arrow
        case 19: // KEYCODE_DPAD_UP
            navigateDirection('up');
            break;
        case 40: // Down arrow
        case 20: // KEYCODE_DPAD_DOWN
            navigateDirection('down');
            break;
        case 13: // Enter
        case 66: // KEYCODE_BUTTON_A
            if (document.activeElement) {
                document.activeElement.click();
            }
            break;
    }
    event.preventDefault();
}

document.addEventListener('keydown', handleKeyNavigation);

// Disable mouse interactions
function disableMouseInteractions(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return; // Allow mouse events for input fields
    }
    e.preventDefault();
    e.stopPropagation();
}

// Disable cursor
document.body.style.cursor = 'none';

// Prevent default behavior for mouse events
['click', 'mousedown', 'mouseup', 'mousemove', 'contextmenu'].forEach(eventType => {
    document.addEventListener(eventType, disableMouseInteractions, { capture: true });
});

// Prevent scrolling
document.body.style.overflow = 'hidden';

// Disable text selection
document.body.style.userSelect = 'none';

// Disable drag and drop
document.body.addEventListener('dragstart', (e) => e.preventDefault());

// Focus on the first focusable element when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const firstFocusableElement = document.querySelector('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusableElement) {
        firstFocusableElement.focus();
    }
});

// Handle keyboard navigation
function handleKeyNavigation(event) {
    switch(event.keyCode) {
        case 37: // Left arrow
        case 21: // KEYCODE_DPAD_LEFT
            navigateDirection('left');
            break;
        case 39: // Right arrow
        case 22: // KEYCODE_DPAD_RIGHT
            navigateDirection('right');
            break;
        case 38: // Up arrow
        case 19: // KEYCODE_DPAD_UP
            navigateDirection('up');
            break;
        case 40: // Down arrow
        case 20: // KEYCODE_DPAD_DOWN
            navigateDirection('down');
            break;
        case 13: // Enter
        case 66: // KEYCODE_BUTTON_A
            if (document.activeElement) {
                document.activeElement.click();
            }
            break;
    }
    event.preventDefault();
}

document.addEventListener('keydown', handleKeyNavigation);