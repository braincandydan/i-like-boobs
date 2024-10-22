const apiKey = '6f2345080ac02f962901b6baa3723f58';
let currentFocus = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired on details page');
    const urlParams = new URLSearchParams(window.location.search);
    const mediaType = urlParams.get('type');
    const id = urlParams.get('id');

    console.log('URL parameters:', window.location.search);
    console.log('Media Type:', mediaType);
    console.log('ID:', id);

    if (mediaType && id) {
        fetchDetails(mediaType, id);
    } else {
        console.error('Missing media type or ID');
        document.getElementById('details-container').innerHTML = '<p>Error: Missing media type or ID</p>';
    }

    // Add keyboard navigation
    document.addEventListener('keydown', handleKeyNavigation);
});

async function fetchDetails(mediaType, id) {
    console.log('Fetching details for:', mediaType, id);
    const url = `https://api.themoviedb.org/3/${mediaType}/${id}?api_key=${apiKey}&append_to_response=credits,videos,external_ids`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Fetched data:', data);
        displayDetails(data, mediaType);
    } catch (error) {
        console.error('Error fetching details:', error);
        document.getElementById('details-container').innerHTML = `<p>Error fetching details: ${error.message}</p>`;
    }
}

function displayDetails(item, mediaType) {
    console.log('Displaying details for:', item.title || item.name);
    const container = document.getElementById('details-container');
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date;
    const overview = item.overview;
    const posterPath = item.poster_path;
    const voteAverage = item.vote_average;
    const director = item.credits.crew.find(person => person.job === 'Director');
    const cast = item.credits.cast.slice(0, 16);
    const trailer = item.videos.results.find(video => video.type === 'Trailer');
    const imdbId = item.external_ids.imdb_id;

    let html = `
        <div class="details-grid">
            <div class="details-left">
                <div class="details-poster">
                    <img src="https://image.tmdb.org/t/p/w500${posterPath}" alt="${title} Poster" tabindex="0" onerror="this.src='placeholder.jpg'">
                </div>
                <div class="details-info">
                    <h1 tabindex="0">${title}</h1>
                    <p tabindex="0"><strong>Release:</strong> ${releaseDate}</p>
                    <p tabindex="0"><strong>Rating:</strong> ${voteAverage}/10</p>
                    <div class="watch-options">
                        <a href="https://vidsrc.xyz/embed/${mediaType}?imdb=${imdbId}" target="_blank" class="watch-link" tabindex="0">Watch ${mediaType === 'tv' ? 'Show' : 'Movie'}</a>
                        ${trailer ? `<a href="https://www.youtube.com/watch?v=${trailer.key}" target="_blank" class="watch-link" tabindex="0">Watch Trailer</a>` : ''}
                        <a href="index.html" class="back-link" tabindex="0">Back to Main Page</a>
                    </div>
                </div>
            </div>
            <div class="details-right">
                <div class="section-container">
                    <h2 class="section-header" tabindex="0">Overview</h2>
                    <p tabindex="0">${overview}</p>
                </div>
                <div class="section-container">
                    <h2 class="section-header" tabindex="0">Cast & Crew</h2>
                    <div class="cast-grid">
                        ${director ? `
                            <div class="cast-member" tabindex="0">
                                <img src="https://image.tmdb.org/t/p/w185${director.profile_path}" alt="${director.name}" onerror="this.src='placeholder.jpg'">
                                <div class="cast-member-info">
                                    <a href="person.html?id=${director.id}" class="person-link">${director.name}</a>
                                    <p>Director</p>
                                </div>
                            </div>
                        ` : ''}
                        ${cast.map(actor => `
                            <div class="cast-member" tabindex="0">
                                <img src="https://image.tmdb.org/t/p/w185${actor.profile_path}" alt="${actor.name}" onerror="this.src='placeholder.jpg'">
                                <div class="cast-member-info">
                                    <a href="person.html?id=${actor.id}" class="person-link">${actor.name}</a>
                                    <p>${actor.character}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    console.log('Details displayed');

    // Initialize navigation after content is loaded
    initializeNavigation();
}

function initializeNavigation() {
    currentFocus = null;
    const focusableElements = document.querySelectorAll('a[tabindex="0"], .cast-member[tabindex="0"]');
    if (focusableElements.length > 0) {
        currentFocus = focusableElements[0];
        currentFocus.focus();
    }
}

function setInitialFocus() {
    const firstFocusableElement = document.querySelector('a[tabindex="0"]');
    if (firstFocusableElement) {
        firstFocusableElement.focus();
        currentFocus = firstFocusableElement;
    }
}

function handleKeyNavigation(event) {
    const focusableElements = document.querySelectorAll('a[tabindex="0"], .cast-member[tabindex="0"]');
    const focusArray = Array.from(focusableElements);

    if (!currentFocus || !focusArray.includes(currentFocus)) {
        initializeNavigation();
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
            currentFocus = findVerticalElement(focusArray, currentIndex, -1);
            break;
        case 40: // Down arrow
            event.preventDefault();
            currentFocus = findVerticalElement(focusArray, currentIndex, 1);
            break;
        case 13: // Enter
            event.preventDefault();
            if (currentFocus.classList.contains('cast-member')) {
                const link = currentFocus.querySelector('.person-link');
                if (link) {
                    link.click();
                }
            } else {
                currentFocus.click();
            }
            return;
        case 10009: // Back button (for Fire TV)
            event.preventDefault();
            window.history.back();
            return;
    }

    currentFocus.focus();
    ensureElementIsVisible(currentFocus);
}

function ensureElementIsVisible(element) {
    const rect = element.getBoundingClientRect();
    const isInViewport = (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );

    if (!isInViewport) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

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

        if ((direction > 0 && y <= currentY) || (direction < 0 && y >= currentY)) continue;

        const verticalDistance = Math.abs(y - currentY);
        const horizontalDistance = Math.abs(centerX - currentCenterX);

        const distance = verticalDistance * 1000 + horizontalDistance;

        if (distance < closestDistance) {
            closestDistance = distance;
            closestElement = elements[i];
        }
    }

    return closestElement || elements[currentIndex];
}

async function fetchPersonWorks(personId, personName) {
    const url = `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${apiKey}&language=en-US`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Sort by popularity (descending)
        const works = data.cast.concat(data.crew).sort((a, b) => b.popularity - a.popularity);

        displayPersonWorks(works, personName);
    } catch (error) {
        console.error('Error fetching person works:', error);
    }
}

function displayPersonWorks(works, personName) {
    const container = document.getElementById('details-container');
    let html = `
        <h2>Works featuring ${personName}</h2>
        <div class="works-grid">
    `;

    works.slice(0, 20).forEach(work => {
        const title = work.title || work.name;
        const posterPath = work.poster_path ? `https://image.tmdb.org/t/p/w200${work.poster_path}` : 'path_to_placeholder_image.jpg';
        html += `
            <div class="work-item">
                <img src="${posterPath}" alt="${title} Poster">
                <p>${title}</p>
            </div>
        `;
    });

    html += `
        </div>
        <button id="back-button">Back to Details</button>
    `;

    container.innerHTML = html;

    // Add event listener to back button
    document.getElementById('back-button').addEventListener('click', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const mediaType = urlParams.get('type');
        const id = urlParams.get('id');
        fetchDetails(mediaType, id);
    });
}

function navigateToPerson(personId) {
    console.log('Navigating to person. ID:', personId);
    window.location.href = `person.html?id=${personId}`;
}
