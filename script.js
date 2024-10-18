const apiKey = '6f2345080ac02f962901b6baa3723f58';
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2ZjIzNDUwODBhYzAyZjk2MjkwMWI2YmFhMzcyM2Y1OCIsInN1YiI6IjY1NmFhZDExZjBmNTBlZDEwNWIzNTM0YyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Z-oU6dL94w36cr2WWJ8P7lR4-5qskfqFYXj82I3kGng';

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

// Add this new function to handle Fire TV remote inputs
function handleFireTVRemote(event) {
    let handled = false;

    switch (event.keyCode) {
        case 13: // KEYCODE_DPAD_CENTER
        case 66: // KEYCODE_BUTTON_A
            // Handle selections
            if (currentFocus) {
                if (currentFocus.tagName === 'A' || currentFocus.tagName === 'BUTTON') {
                    currentFocus.click();
                } else if (currentFocus.classList.contains('movie')) {
                    showMovieDetails(currentFocus.movieData);
                }
            }
            handled = true;
            break;
        case 21: // KEYCODE_DPAD_LEFT
            // Handle left action
            handleKeyNavigation({ keyCode: 37, preventDefault: () => {} });
            handled = true;
            break;
        case 22: // KEYCODE_DPAD_RIGHT
            // Handle right action
            handleKeyNavigation({ keyCode: 39, preventDefault: () => {} });
            handled = true;
            break;
        case 19: // KEYCODE_DPAD_UP
            // Handle up action
            handleKeyNavigation({ keyCode: 38, preventDefault: () => {} });
            handled = true;
            break;
        case 20: // KEYCODE_DPAD_DOWN
            // Handle down action
            handleKeyNavigation({ keyCode: 40, preventDefault: () => {} });
            handled = true;
            break;
        case 4: // KEYCODE_BACK
            // Handle back action
            if (window.history.length > 1) {
                window.history.back();
            }
            handled = true;
            break;
    }

    if (handled) {
        event.preventDefault();
    }

    return handled;
}

// Update the existing handleKeyNavigation function
function handleKeyNavigation(event) {
    if (document.activeElement.id === 'search-input') {
        return;
    }

    const focusableElements = document.querySelectorAll('.movie, button, input, select, #search-toggle, nav ul li a');
    const focusArray = Array.from(focusableElements);

    if (!currentFocus) {
        currentFocus = focusArray[0];
        currentFocus.focus();
        return;
    }

    const currentIndex = focusArray.indexOf(currentFocus);
    let newIndex = currentIndex;

    switch(event.keyCode) {
        case 37: // Left arrow
            event.preventDefault();
            newIndex = Math.max(0, currentIndex - 1);
            break;
        case 39: // Right arrow
            event.preventDefault();
            newIndex = Math.min(focusArray.length - 1, currentIndex + 1);
            break;
        case 38: // Up arrow
            event.preventDefault();
            newIndex = findAdjacentVerticalElement(focusArray, currentIndex, -1);
            break;
        case 40: // Down arrow
            event.preventDefault();
            newIndex = findAdjacentVerticalElement(focusArray, currentIndex, 1);
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

    if (newIndex !== currentIndex) {
        currentFocus = focusArray[newIndex];
        currentFocus.focus();
        ensureElementIsVisible(currentFocus);
    }
}

function findAdjacentVerticalElement(elements, currentIndex, direction) {
    // Calculate the new index based on direction
    let newIndex = currentIndex + direction;

    // Ensure the new index is within bounds
    if (newIndex < 0) {
        newIndex = 0; // Prevent going above the first element
    } else if (newIndex >= elements.length) {
        newIndex = elements.length - 1; // Prevent going below the last element
    }

    return newIndex; // Return the new index directly
}

function ensureElementIsVisible(element) {
    const container = element.closest('.content-row');
    if (container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        if (elementRect.right > containerRect.right) {
            container.scrollLeft += elementRect.right - containerRect.right + 20;
        } else if (elementRect.left < containerRect.left) {
            container.scrollLeft -= containerRect.left - elementRect.left + 20;
        }
    }
}

// Update the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...

    // Add event listener for Fire TV remote
    document.addEventListener('keydown', (event) => {
        if (!handleFireTVRemote(event)) {
            handleKeyNavigation(event);
        }
    });

    // ... rest of the existing code ...
});

// ... rest of the existing code ...

document.addEventListener('DOMContentLoaded', () => {
    let currentFocusIndex = 0;

    function updateFocus(index) {
        const focusableElements = document.querySelectorAll('.movie, button, input, select, #search-toggle, nav ul li a');
        if (index >= 0 && index < focusableElements.length) {
            focusableElements[currentFocusIndex].blur(); // Remove focus from the current element
            currentFocusIndex = index;
            focusableElements[currentFocusIndex].focus(); // Set focus to the new element
        }
    }

    function findAdjacentVerticalElement(elements, currentIndex, direction) {
        const currentElement = elements[currentIndex];
        const currentRect = currentElement.getBoundingClientRect();
        const currentCenterX = currentRect.left + currentRect.width / 2;

        let closestElement = null;
        let closestDistance = Infinity;

        for (let i = 0; i < elements.length; i++) {
            if (i === currentIndex) continue;

            const rect = elements[i].getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;

            // Check if the element is in the correct vertical direction
            if ((direction > 0 && rect.top <= currentRect.top) || (direction < 0 && rect.top >= currentRect.top)) continue;

            const verticalDistance = Math.abs(rect.top - currentRect.top);
            const horizontalDistance = Math.abs(centerX - currentCenterX);

            // Prioritize vertical distance, but consider horizontal distance as a tiebreaker
            const distance = verticalDistance * 1000 + horizontalDistance;

            if (distance < closestDistance) {
                closestDistance = distance;
                closestElement = i;
            }
        }

        return closestElement !== null ? closestElement : currentIndex;
    }

    document.addEventListener('keydown', (event) => {
        const focusableElements = document.querySelectorAll('.movie, button, input, select, #search-toggle, nav ul li a');
        switch (event.keyCode) {
            case 37: // Left arrow
                event.preventDefault();
                updateFocus(currentFocusIndex - 1);
                break;
            case 39: // Right arrow
                event.preventDefault();
                updateFocus(currentFocusIndex + 1);
                break;
            case 38: // Up arrow
                event.preventDefault();
                const upIndex = findAdjacentVerticalElement(focusableElements, currentFocusIndex, -1);
                updateFocus(upIndex);
                break;
            case 40: // Down arrow
                event.preventDefault();
                const downIndex = findAdjacentVerticalElement(focusableElements, currentFocusIndex, 1);
                updateFocus(downIndex);
                break;
            case 13: // Enter
                if (focusableElements[currentFocusIndex].tagName === 'A' || focusableElements[currentFocusIndex].tagName === 'BUTTON') {
                    focusableElements[currentFocusIndex].click();
                } else if (focusableElements[currentFocusIndex].classList.contains('movie')) {
                    showMovieDetails(focusableElements[currentFocusIndex].movieData);
                }
                event.preventDefault();
                break;
        }
    });

    // Initialize focus on the first focusable element
    updateFocus(0);
});