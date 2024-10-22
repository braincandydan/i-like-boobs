let currentFocus = null;

function initializeNavigation() {
    const firstFocusableElement = document.querySelector('.movie, button, input, select, #search-toggle, nav ul li a');
    if (firstFocusableElement) {
        firstFocusableElement.focus();
        currentFocus = firstFocusableElement;
    }
    document.addEventListener('keydown', handleKeyNavigation);
}

function handleKeyNavigation(event) {
    // Don't interfere with typing in the search input
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

    switch(event.key) {
        case 'ArrowRight':
            if (currentIndex < focusArray.length - 1) {
                currentFocus = focusArray[currentIndex + 1];
            }
            break;
        case 'ArrowLeft':
            if (currentIndex > 0) {
                currentFocus = focusArray[currentIndex - 1];
            }
            break;
        case 'ArrowUp':
            const upIndex = Math.max(0, currentIndex - 5);
            currentFocus = focusArray[upIndex];
            break;
        case 'ArrowDown':
            const downIndex = Math.min(focusArray.length - 1, currentIndex + 5);
            currentFocus = focusArray[downIndex];
            break;
        case 'Enter':
            if (currentFocus.tagName === 'A' || currentFocus.tagName === 'BUTTON') {
                currentFocus.click();
            } else if (currentFocus.classList.contains('movie')) {
                window.showMovieDetails(currentFocus.movieData);
            }
            event.preventDefault();
            return;
    }

    currentFocus.focus();
    event.preventDefault();
}

// Make handleKeyNavigation available globally
window.handleKeyNavigation = handleKeyNavigation;

// Initialize navigation when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeNavigation);
