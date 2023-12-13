

    
const apiKey = '6f2345080ac02f962901b6baa3723f58';
const accessToken = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2ZjIzNDUwODBhYzAyZjk2MjkwMWI2YmFhMzcyM2Y1OCIsInN1YiI6IjY1NmFhZDExZjBmNTBlZDEwNWIzNTM0YyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.Z-oU6dL94w36cr2WWJ8P7lR4-5qskfqFYXj82I3kGng';

function fetchMedia(searchQuery, mediaType) {
console.log('Fetching:', mediaType);
const apiUrl = `https://api.themoviedb.org/3/search/${mediaType === 'movie' ? 'movie' : 'tv'}`;
const options = {
method: 'GET',
headers: {
  accept: 'application/json',
  Authorization: `Bearer ${accessToken}`,
},
};

fetch(`${apiUrl}?api_key=${apiKey}&query=${searchQuery}`, options)
.then(response => {
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
})
.then(data => {
  console.log('TMDb API response:', data);
  displayMovies(data.results, mediaType); // Pass mediaType to displayMovies
})
.catch(error => console.error('Error fetching data:', error));
}

async function getImdbId(tmdbId, mediaType) {
const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
const externalIdsUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${apiKey}`;
const options = {
method: 'GET',
headers: {
  accept: 'application/json',
  Authorization: `Bearer ${accessToken}`,
},
};

try {
const response = await fetch(externalIdsUrl, options);

if (!response.ok) {
  if (response.status === 404) {
    console.log(`External IDs not found for ${endpoint} ${tmdbId}`);
    return null;
  }
  throw new Error(`HTTP error! Status: ${response.status}`);
}

const data = await response.json();
console.log('External IDs response:', data);

const imdbId = data.imdb_id || null;
if (!imdbId) {
  console.log(`IMDb ID not found for ${endpoint} ${tmdbId}`);
}

return imdbId;
} catch (error) {
console.error('Error fetching IMDb ID:', error);
return null;
}
}

let currentIndex = 0;

async function displayMovies(moviesData) {
const mediaType = document.getElementById('media-type').value;

const moviesContainer = document.getElementById('movies-container');
moviesContainer.innerHTML = '';

const numColumns = 5;
let currentRow = document.createElement('div');
currentRow.className = 'movie-row';

for (let i = 0; i < moviesData.length; i++) {
const movie = moviesData[i];

const movieDiv = document.createElement('div');
movieDiv.className = 'movie';
movieDiv.tabIndex = 0; // Make the movie div focusable

if (movie.poster_path) {
  const image = document.createElement('img');
  image.src = `https://image.tmdb.org/t/p/w500/${movie.poster_path}`;
  image.alt = `${movie.title} Poster`;
  image.className = 'movie-poster'; // Add this line to assign a class
  movieDiv.appendChild(image);
}

movieDiv.addEventListener('click', async () => {
  const imdbId = await getImdbId(movie.id, mediaType);
  openImdbLink(imdbId, movie.id, mediaType);
});

movieDiv.addEventListener('keydown', async (event) => {
  switch (event.key) {
    case 'Enter':
      const imdbId = await getImdbId(movie.id, mediaType);
      openImdbLink(imdbId, movie.id, mediaType);
      break;
  }
});

// Prepend the movie div to the current row instead of appending
currentRow.appendChild(movieDiv);

// Append the movie div to the current row
currentRow.appendChild(movieDiv);

// Append the current row to the container
moviesContainer.appendChild(currentRow);

// Create a new row for the next iteration
currentRow = document.createElement('div');
currentRow.className = 'movie-row';

}

currentIndex = 0; // Reset currentIndex when displaying new movies
updateFocus();

function navigate(direction) {
const moviesContainer = document.getElementById('movies-container');
const numColumns = 5;
const numRows = Math.ceil(moviesContainer.children.length / numColumns);

switch (direction) {
case 'up':
  currentIndex = Math.max(0, currentIndex - numColumns);
  break;
case 'down':
  currentIndex = Math.min(moviesContainer.children.length - 1, currentIndex + numColumns);
  break;
case 'left':
  currentIndex = (currentIndex - 1 + moviesContainer.children.length) % moviesContainer.children.length;
  break;
case 'right':
  currentIndex = (currentIndex + 1) % moviesContainer.children.length;
  break;
}

updateFocus();
}

function updateFocus() {
const moviesContainer = document.getElementById('movies-container');
const movieDivs = moviesContainer.querySelectorAll('.movie');

movieDivs.forEach((movieDiv, index) => {
if (index === currentIndex) {
  movieDiv.classList.add('focused');
  movieDiv.focus();
} else {
  movieDiv.classList.remove('focused');
}
});
}
}

// Add an event listener to the document for arrow key navigation
document.addEventListener('keydown', (event) => {
switch (event.key) {
case 'ArrowUp':
  navigate('up');
  break;
case 'ArrowDown':
  navigate('down');
  break;
case 'ArrowLeft':
  navigate('left');
  break;
case 'ArrowRight':
  navigate('right');
  break;
}
});





async function getCastInfo(movieId, mediaType) {
const creditsUrl = `https://api.themoviedb.org/3/${mediaType}/${movieId}/credits?api_key=${apiKey}`;
const options = {
method: 'GET',
headers: {
  accept: 'application/json',
  Authorization: `Bearer ${accessToken}`,
},
};

return fetch(creditsUrl, options)
.then(response => {
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
})
.then(data => {
  const cast = data.cast.slice(0, 3).map(actor => actor.name);
  return cast;
})
.catch(error => {
  console.error('Error fetching cast info:', error);
  return [];
});
}

async function getDirectorInfo(movieId, mediaType) {
const creditsUrl = `https://api.themoviedb.org/3/${mediaType}/${movieId}/credits?api_key=${apiKey}`;
const options = {
method: 'GET',
headers: {
  accept: 'application/json',
  Authorization: `Bearer ${accessToken}`,
},
};

return fetch(creditsUrl, options)
.then(response => {
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
})
.then(data => {
  const director = data.crew.find(member => member.job === 'Director');
  return director ? director.name : null;
})
.catch(error => {
  console.error('Error fetching director info:', error);
  return null;
});
}

async function getGenres(genreIds) {
const genresUrl = `https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}`;
const options = {
method: 'GET',
headers: {
  accept: 'application/json',
  Authorization: `Bearer ${accessToken}`,
},
};

return fetch(genresUrl, options)
.then(response => {
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
})
.then(data => {
  const genreNames = genreIds.map(id => {
    const genre = data.genres.find(genre => genre.id === id);
    return genre ? genre.name : null;
  });
  return genreNames.filter(name => name !== null);
})
.catch(error => {
  console.error('Error fetching genre info:', error);
  return [];
});
}

function openImdbLink(imdbId, tmdbId, mediaType) {
const baseUrl = 'https://vidsrc.xyz/embed/';
const typeUrl = mediaType === 'movie' ? 'movie' : 'tv';

const queryParams = new URLSearchParams();
if (imdbId) {
queryParams.append('imdb', imdbId);
} else if (tmdbId) {
queryParams.append('tmdb', tmdbId);
}

const url = `${baseUrl}${typeUrl}?${queryParams.toString()}`;
console.log('Watch Link:', url);

// Open the URL in a new tab or window
window.open(url, '_blank');
}

async function getImdbId(tmdbId, mediaType) {
const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
const externalIdsUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}/external_ids?api_key=${apiKey}`;
const options = {
method: 'GET',
headers: {
  accept: 'application/json',
  Authorization: `Bearer ${accessToken}`,
},
};

return fetch(externalIdsUrl, options)
.then(response => {
  if (!response.ok) {
    if (response.status === 404) {
      return null; // IMDb ID not found
    }
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  return response.json();
})
.then(data => {
  console.log('External IDs response:', data);
  return data.imdb_id;
})
.catch(error => {
  console.error('Error fetching IMDb ID:', error);
  return null;
});
}


async function fetchAndDisplay(baseURL, page) {
const url = `${baseURL}/page-${page}.json`;

try {
const response = await fetch(url);
const data = await response.json();

if (data && data.result) {
  displayMovies(data.result);
} else {
  console.error('Invalid data structure:', data);
}
} catch (error) {
console.error('Error fetching data:', error);
}
}


