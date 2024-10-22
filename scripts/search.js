const apiKey = '6f2345080ac02f962901b6baa3723f58';

document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const mediaType = document.getElementById('media-type');
    const genreList = document.getElementById('genre-list');

    console.log('Genre list element:', genreList); // Debug log

    // Check for genre parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const genreId = urlParams.get('genre');

    console.log('Genre ID from URL:', genreId);

    if (genreId) {
        // If genre is specified, perform search immediately
        console.log('Performing genre search with ID:', genreId);
        searchMedia('', 'movie', genreId);
    }

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value;
        const type = mediaType.value;
        searchMedia(query, type);
    });

    // Fetch and display genres
    console.log('Fetching genres...'); // Debug log
    fetchGenres('movie').then(genres => {
        console.log('Genres fetched:', genres); // Debug log
        displayGenres(genres);
    }).catch(error => {
        console.error('Error fetching genres:', error); // Debug log
    });
});

async function fetchGenres(type) {
    const url = `https://api.themoviedb.org/3/genre/${type}/list?api_key=${apiKey}&language=en-US`;
    console.log('Fetching genres from URL:', url); // Debug log
    const response = await fetch(url);
    const data = await response.json();
    return data.genres;
}

function displayGenres(genres) {
    const genreList = document.getElementById('genre-list');
    console.log('Displaying genres:', genres); // Debug log
    
    if (!genreList) {
        console.error('Genre list element not found!');
        return;
    }

    genres.forEach(genre => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = genre.name;
        a.dataset.genreId = genre.id;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            searchMedia('', 'movie', genre.id);
        });
        li.appendChild(a);
        genreList.appendChild(li);
    });
}

async function searchMedia(query, mediaType, genreId = '') {
    console.log('searchMedia called with:', query, mediaType, genreId);
    let url;
    
    if (genreId) {
        url = `https://api.themoviedb.org/3/discover/${mediaType}?api_key=${apiKey}&with_genres=${genreId}`;
    } else {
        url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${apiKey}&query=${encodeURIComponent(query)}`;
    }
    
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

function displaySearchResults(results) {
    console.log('Displaying search results:', results);
    const container = document.getElementById('search-results-content');
    container.innerHTML = '';

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

// Add this function if it's not already present
function showMovieDetails(movie) {
    const mediaType = movie.media_type || (movie.first_air_date ? 'tv' : 'movie');
    window.location.href = `details.html?type=${mediaType}&id=${movie.id}`;
}
