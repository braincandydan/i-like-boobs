const apiKey = '6f2345080ac02f962901b6baa3723f58';

let currentPage = 1;
const resultsPerPage = 10; // Adjust as needed
let totalResults = 0; // To keep track of total results
let currentQuery = ''; // Store the current search query
let currentMediaType = 'movie'; // Store the current media type
let currentGenreId = ''; // Store the current genre ID

document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const mediaType = document.getElementById('media-type');
    const genreList = document.getElementById('genre-list');

    // Fetch and display genres
    fetchGenres(currentMediaType).then(genres => {
        displayGenres(genres);
    }).catch(error => {
        console.error('Error fetching genres:', error);
    });

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        currentQuery = searchInput.value;
        currentMediaType = mediaType.value;
        currentGenreId = ''; // Reset genre ID on new search
        currentPage = 1; // Reset to the first page on new search
        searchMedia(currentQuery, currentMediaType, currentGenreId);
    });
});

async function fetchGenres(type) {
    const url = `https://api.themoviedb.org/3/genre/${type}/list?api_key=${apiKey}&language=en-US`;
    const response = await fetch(url);
    const data = await response.json();
    return data.genres;
}

function displayGenres(genres) {
    const genreList = document.getElementById('genre-list');
    genreList.innerHTML = ''; // Clear existing genres

    genres.forEach(genre => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = genre.name;
        a.dataset.genreId = genre.id;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            currentGenreId = genre.id; // Set the current genre ID
            currentQuery = ''; // Reset search query on genre change
            currentPage = 1; // Reset to the first page on genre change
            searchMedia(currentQuery, currentMediaType, currentGenreId);
        });
        li.appendChild(a);
        genreList.appendChild(li);
    });
}

async function searchMedia(query, mediaType, genreId = '') {
    let url;
    const pageParam = `&page=${currentPage}`;

    if (genreId) {
        url = `https://api.themoviedb.org/3/discover/${mediaType}?api_key=${apiKey}&with_genres=${genreId}${pageParam}`;
    } else {
        url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(query)}${pageParam}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        totalResults = data.total_results; // Get total results from API response

        if (data.results && data.results.length > 0) {
            displaySearchResults(data.results);
            updatePagination();
        } else {
            displayErrorMessage('No results found for your search.');
        }
    } catch (error) {
        console.error('Error in searchMedia:', error);
        displayErrorMessage('An error occurred while searching. Please try again.');
    }
}

function updatePagination() {
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');

    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage * resultsPerPage >= totalResults;

    prevButton.onclick = () => {
        currentPage--;
        searchMedia(currentQuery, currentMediaType, currentGenreId);
    };

    nextButton.onclick = () => {
        currentPage++;
        searchMedia(currentQuery, currentMediaType, currentGenreId);
    };
}

function displaySearchResults(results) {
    const container = document.getElementById('search-results-content');
    container.innerHTML = ''; // Clear previous results

    results.forEach(item => {
        const movieElement = createMovieElement(item);
        container.appendChild(movieElement);
    });
}

function createMovieElement(movie) {
    const movieDiv = document.createElement('div');
    movieDiv.className = 'movie';
    movieDiv.innerHTML = `
        <img src="https://image.tmdb.org/t/p/w200${movie.poster_path}" alt="${movie.title || movie.name}" onerror="this.src='placeholder.jpg'">
        <h3>${movie.title || movie.name}</h3>
    `;
    movieDiv.addEventListener('click', () => showMovieDetails(movie));
    return movieDiv;
}

function displayErrorMessage(message) {
    const container = document.getElementById('search-results-content');
    container.innerHTML = `<p class="error-message">${message}</p>`;
}

function showMovieDetails(movie) {
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    window.location.href = `details.html?type=${mediaType}&id=${movie.id}`;
}