const apiKey = '6f2345080ac02f962901b6baa3723f58';
let currentFocus = null;

document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const mediaType = document.getElementById('media-type');
    const searchResultsContent = document.getElementById('search-results-content');

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value;
        const type = mediaType.value;
        if (query.trim() !== '') {
            searchMedia(query, type);
        }
    });

    // Check if there's a search query in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('query');
    const typeParam = urlParams.get('type');
    if (queryParam) {
        searchInput.value = queryParam;
        if (typeParam) {
            mediaType.value = typeParam;
        }
        searchMedia(queryParam, typeParam || 'multi');
    }

    // Add these lines to reinstate the cursor hiding and snapping functionality
    disableMousePointer();
    enableMouseInteractions();
    initializeNavigation();
});

async function searchMedia(query, mediaType) {
    const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(query)}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        displaySearchResults(data.results);
    } catch (error) {
        console.error('Error searching:', error);
    }
}

function displaySearchResults(results) {
    const searchResultsContent = document.getElementById('search-results-content');
    searchResultsContent.innerHTML = '';
    if (results.length === 0) {
        searchResultsContent.innerHTML = '<p>No results found.</p>';
    } else {
        results.forEach(result => {
            const movieElement = createMovieElement(result);
            searchResultsContent.appendChild(movieElement);
        });
    }
}

function createMovieElement(movie) {
    const movieDiv = document.createElement('div');
    movieDiv.className = 'movie';
    movieDiv.tabIndex = 0;
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

function disableMousePointer() {
    document.body.style.cursor = 'none';
}

function enableMouseInteractions() {
    document.body.style.pointerEvents = 'auto';
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleMouseClick);
}

function handleMouseMove(event) {
    const focusableElements = document.querySelectorAll('.movie, button, input, select, #search-toggle, nav ul li a');
    const focusArray = Array.from(focusableElements);
    
    let closestElement = null;
    let closestDistance = Infinity;

    focusArray.forEach(element => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
        
        if (distance < closestDistance) {
            closestDistance = distance;
            closestElement = element;
        }
    });

    if (closestElement && closestElement !== currentFocus) {
        currentFocus = closestElement;
        currentFocus.focus();
        ensureElementIsVisible(currentFocus);
        
        // Move the mouse cursor to the center of the focused element
        const rect = currentFocus.getBoundingClientRect();
        const centerX = Math.round(rect.left + rect.width / 2);
        const centerY = Math.round(rect.top + rect.height / 2);
        
        // Use requestAnimationFrame to smooth out the cursor movement
        requestAnimationFrame(() => {
            window.moveTo(window.screenX + centerX - event.clientX, window.screenY + centerY - event.clientY);
        });
    }
}

function handleMouseClick(event) {
    if (currentFocus) {
        if (currentFocus.tagName === 'A' || currentFocus.tagName === 'BUTTON') {
            currentFocus.click();
        } else if (currentFocus.classList.contains('movie')) {
            showMovieDetails(currentFocus.movieData);
        }
        event.preventDefault();
    }
}

function initializeNavigation() {
    const firstFocusableElement = document.querySelector('#search-input, #media-type, #search-form button, .movie');
    if (firstFocusableElement) {
        firstFocusableElement.focus();
        currentFocus = firstFocusableElement;
    }
    document.addEventListener('keydown', handleKeyNavigation);
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

function showMovieDetails(movie) {
    // Implement this function to show movie details
    console.log('Showing details for:', movie.title || movie.name);
    // You can implement a modal or navigate to a details page here
}
