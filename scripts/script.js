const apiKey = '6f2345080ac02f962901b6baa3723f58';
let isScrolling = false;
const scrollSpeed = 5;

// Define anchor points for snapping
const anchorPoints = [0, 200, 400, 600, 800]; // Example anchor points

// Fetch and display content for a specific category
async function fetchContent(endpoint, containerId, title) {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}`);
        const data = await response.json();
        displayMovies(data.results.slice(0, 20), containerId, title);
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
    }
}

// Display movies in the specified container
function displayMovies(moviesData, containerId, title) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const section = container.closest('.content-section') || createContentSection(containerId, title);
    const contentRow = section.querySelector('.content-row') || createContentRow(containerId);

    contentRow.innerHTML = '';
    moviesData.forEach(movie => {
        contentRow.appendChild(createMovieElement(movie));
    });
}

function createContentSection(containerId, title) {
    const section = document.createElement('div');
    section.className = 'content-section';
    section.innerHTML = `<h2>${title}</h2>`;
    document.getElementById('home').appendChild(section);
    return section;
}

function createContentRow(containerId) {
    const row = document.createElement('div');
    row.className = 'content-row';
    row.id = containerId;
    return row;
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
        if (event.key === 'Enter') showMovieDetails(movie);
    });

    return movieDiv;
}

// Show movie details (navigate to details page)
function showMovieDetails(movie) {
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    window.location.href = `details.html?type=${mediaType}&id=${movie.id}`;
}

// Handle snapping to anchor points
function handleSnapScroll(event) {
    document.querySelectorAll('.content-row').forEach(row => {
        const rect = row.getBoundingClientRect();
        if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
            const mouseX = event.clientX - rect.left;
            const rowWidth = rect.width;

            // Determine the closest anchor point
            let closestAnchor = anchorPoints[0];
            let minDistance = Math.abs(row.scrollLeft - closestAnchor);

            anchorPoints.forEach(anchor => {
                const distance = Math.abs(row.scrollLeft - anchor);
                if (distance < minDistance) {
                    closestAnchor = anchor;
                    minDistance = distance;
                }
            });

            // Snap to the closest anchor point
            row.scrollLeft = closestAnchor;
        }
    });
}

// Initialize the page
document.addEventListener('DOMContentLoaded', async () => {
    fetchContent('movie/now_playing', 'featured-content', 'Featured');
    fetchContent('movie/popular', 'popular-movies', 'Popular Movies');
    fetchContent('tv/popular', 'popular-tv', 'Popular TV Shows');
    fetchContent('trending/all/week', 'trending-content', 'Trending Now');

    document.addEventListener('mousemove', (event) => {
        handleSnapScroll(event);
    });

    // Add scroll zones to content rows
    document.querySelectorAll('.content-row').forEach(row => {
        ['left', 'right'].forEach(direction => {
            const zone = document.createElement('div');
            zone.className = `scroll-zone scroll-zone-${direction}`;
            zone.addEventListener('mouseenter', () => handleSnapScroll({
                clientX: direction === 'left' ? 0 : row.offsetWidth,
                clientY: row.getBoundingClientRect().top + 1
            }));
            row.appendChild(zone);
        });
    });

    // Fetch and populate genres
    const genres = await fetchGenres();
    populateGenreDropdown(genres);
});

async function fetchGenres() {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}`);
        const data = await response.json();
        return data.genres;
    } catch (error) {
        console.error('Error fetching genres:', error);
        return [];
    }
}

function populateGenreDropdown(genres) {
    const dropdown = document.getElementById('genre-dropdown');
    genres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre.id;
        option.textContent = genre.name;
        dropdown.appendChild(option);
    });

    // Add event listener for genre selection
    dropdown.addEventListener('change', (event) => {
        const selectedGenreId = event.target.value;
        if (selectedGenreId) {
            window.location.href = `search.html?genre=${selectedGenreId}`;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const mediaType = document.getElementById('media-type');

    // Check for genre parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const genreId = urlParams.get('genre');

    if (genreId) {
        // If genre is specified, perform search immediately
        searchMedia('', 'movie', genreId);
    }

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value;
        const type = mediaType.value;
        searchMedia(query, type);
    });
});

async function searchMedia(query, mediaType) {
    console.log('searchMedia called with:', query, mediaType);
    const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(query)}`;
    console.log('API URL:', url);
    
    try {
        console.log('Fetching data...');
        const response = await fetch(url);
        console.log('Response received:', response);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Data received:', data);
        
        if (data.results && data.results.length > 0) {
            console.log('Results found:', data.results.length);
            displaySearchResults(data.results);
        } else {
            console.log('No results found');
            displayErrorMessage('No results found for your search.');
        }
    } catch (error) {
        console.error('Error in searchMedia:', error);
        displayErrorMessage('An error occurred while searching. Please try again.');
    }
}
