const apiKey = '6f2345080ac02f962901b6baa3723f58';
let isScrolling = false;
const scrollSpeed = 5;
// Define anchor points for snapping
const anchorPoints = [0, 200, 400, 600, 800]; // Example anchor points

// Modified to include both Animation (16) and Family (10751) genres
async function fetchContent(endpoint, containerId, title) {
    try {
        // Adding both Animation and Family genres to the query
        const response = await fetch(
            `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&with_genres=16,10751&certification_country=US&certification.lte=PG`
        );
        const data = await response.json();
        
        // Filter results to ensure they match either Animation or Family genres
        const kidsContent = data.results.filter(item => {
            // Some items might have genre_ids already
            if (item.genre_ids) {
                return item.genre_ids.some(id => id === 16 || id === 10751);
            }
            return true; // If no genre_ids, keep it since we filtered in the API call
        });

        displayMovies(kidsContent.slice(0, 20), containerId, title);
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

function showMovieDetails(movie) {
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    window.location.href = `details.html?type=${mediaType}&id=${movie.id}`;
}

// Modified section titles to reflect kids content
document.addEventListener('DOMContentLoaded', async () => {
    fetchContent('movie/now_playing', 'featured-content', 'Featured Kids Movies');
    fetchContent('movie/popular', 'popular-movies', 'Popular Kids Movies');
    fetchContent('tv/popular', 'popular-tv', 'Popular Kids TV Shows');
    fetchContent('trending/all/week', 'trending-content', 'Trending Kids Content');
});