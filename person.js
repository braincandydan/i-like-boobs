const apiKey = '6f2345080ac02f962901b6baa3723f58';
const worksPerPage = 12;
let currentPage = 1;
let allWorks = [];
let currentFocus = null;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const personId = urlParams.get('id');

    if (personId) {
        fetchPersonDetails(personId);
    } else {
        console.error('Missing person ID');
    }

    // Add keyboard navigation
    document.addEventListener('keydown', handleKeyNavigation);
});

function initializeNavigation() {
    setInitialFocus();
}

async function fetchPersonDetails(personId) {
    const url = `https://api.themoviedb.org/3/person/${personId}?api_key=${apiKey}&append_to_response=combined_credits`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        displayPersonDetails(data);
        allWorks = data.combined_credits.cast.concat(data.combined_credits.crew)
            .sort((a, b) => b.popularity - a.popularity);
        displayWorks();
    } catch (error) {
        console.error('Error fetching person details:', error);
    }
}

function displayPersonDetails(person) {
    const container = document.getElementById('person-container');

    let html = `
        <div class="person-details">
            <img src="https://image.tmdb.org/t/p/w342${person.profile_path}" alt="${person.name}" tabindex="0">
            <h1 tabindex="0">${person.name}</h1>
            <a href="javascript:history.back()" class="back-link" tabindex="0">Go Back</a>
        </div>
        <div class="works-container">
            <h2 tabindex="0">Known For</h2>
            <div class="works-grid"></div>
            <div class="pagination">
                <button id="prev-page" tabindex="0">Previous</button>
                <button id="next-page" tabindex="0">Next</button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    document.getElementById('prev-page').addEventListener('click', () => changePage(-1));
    document.getElementById('next-page').addEventListener('click', () => changePage(1));

    displayWorks();
}

function displayWorks() {
    const worksGrid = document.querySelector('.works-grid');
    const startIndex = (currentPage - 1) * worksPerPage;
    const endIndex = startIndex + worksPerPage;
    const worksToDisplay = allWorks.slice(startIndex, endIndex);

    let html = '';
    worksToDisplay.forEach(work => {
        html += `
            <a href="details.html?type=${work.media_type}&id=${work.id}" class="work-item" tabindex="0">
                <img src="https://image.tmdb.org/t/p/w200${work.poster_path}" alt="${work.title || work.name}" onerror="this.src='placeholder.jpg'" tabindex="0">
                <p tabindex="0">${work.title || work.name}</p>
            </a>
        `;
    });

    worksGrid.innerHTML = html;
    updatePaginationButtons();
    initializeNavigation();
}

function changePage(direction) {
    currentPage += direction;
    displayWorks();
    setInitialFocus();
}

function updatePaginationButtons() {
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');

    prevButton.style.display = currentPage > 1 ? 'inline-block' : 'none';
    nextButton.style.display = currentPage * worksPerPage < allWorks.length ? 'inline-block' : 'none';

    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage * worksPerPage >= allWorks.length;
}

function setInitialFocus() {
    const firstFocusableElement = document.querySelector('a, button');
    if (firstFocusableElement) {
        firstFocusableElement.focus();
        currentFocus = firstFocusableElement;
    }
}

function handleKeyNavigation(event) {
    const focusableElements = document.querySelectorAll('a[tabindex="0"], button:not([disabled])[tabindex="0"], input[type="text"][tabindex="0"]');
    const focusArray = Array.from(focusableElements);

    if (!currentFocus || !focusArray.includes(currentFocus)) {
        setInitialFocus();
        return;
    }

    const currentIndex = focusArray.indexOf(currentFocus);

    switch(event.keyCode) {
        case 37: // Left arrow (keyboard and Fire TV)
            event.preventDefault();
            if (currentIndex > 0) {
                currentFocus = focusArray[currentIndex - 1];
            }
            break;
        case 39: // Right arrow (keyboard and Fire TV)
            event.preventDefault();
            if (currentIndex < focusArray.length - 1) {
                currentFocus = focusArray[currentIndex + 1];
            }
            break;
        case 38: // Up arrow (keyboard and Fire TV)
            event.preventDefault();
            currentFocus = findVerticalElement(focusArray, currentIndex, -1);
            break;
        case 40: // Down arrow (keyboard and Fire TV)
            event.preventDefault();
            currentFocus = findVerticalElement(focusArray, currentIndex, 1);
            break;
        case 13: // Enter (keyboard and Fire TV Select)
            event.preventDefault();
            if (currentFocus.id === 'prev-page') {
                changePage(-1);
            } else if (currentFocus.id === 'next-page') {
                changePage(1);
            } else {
                currentFocus.click();
            }
            return;
        case 10008: // Fire TV Back button
            event.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            }
            return;
    }

    currentFocus.focus();
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

// Initialize navigation when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeNavigation);
