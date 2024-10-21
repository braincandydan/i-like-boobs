const apiKey = '6f2345080ac02f962901b6baa3723f58';

document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const mediaType = document.getElementById('media-type');

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput.value;
        const type = mediaType.value;
        console.log('Search submitted:', query, type);
        if (query.trim() !== '') {
            searchMedia(query, type);
        } else {
            console.log('Empty search query');
            displayErrorMessage('Please enter a search query.');
        }
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

function displaySearchResults(results) {
    console.log('displaySearchResults called with:', results);
    const searchResultsContent = document.getElementById('search-results-content');
    searchResultsContent.innerHTML = '';
    
    results.forEach(result => {
        const movieElement = createMovieElement(result);
        searchResultsContent.appendChild(movieElement);
        console.log('Appended movie element:', result.title || result.name);
    });
}

function createMovieElement(movie) {
    const movieDiv = document.createElement('div');
    movieDiv.className = 'movie';

    let title = movie.title || movie.name || 'Unknown Title';
    let posterPath = movie.poster_path ? `https://image.tmdb.org/t/p/w500/${movie.poster_path}` : 'placeholder-image.jpg';

    movieDiv.innerHTML = `
        <img src="${posterPath}" alt="${title} Poster" class="movie-poster">
        <h3>${title}</h3>
        <p>${movie.release_date || movie.first_air_date || 'Unknown Date'}</p>
    `;

    return movieDiv;
}

function displayErrorMessage(message) {
    const searchResultsContent = document.getElementById('search-results-content');
    searchResultsContent.innerHTML = `<p class="error-message">${message}</p>`;
}
