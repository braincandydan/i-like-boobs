const apiKey = '6f2345080ac02f962901b6baa3723f58';

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
        searchResultsContent.innerHTML = '';
        results.forEach(result => {
            const movieElement = createMovieElement(result);
            searchResultsContent.appendChild(movieElement);
        });
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

    // Initialize navigation
    initializeNavigation();
});
