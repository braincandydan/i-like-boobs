// Check if device is Fire TV
function isFireTV() {
    const userAgent = navigator.userAgent.toLowerCase();
    return (
        userAgent.includes('silk') && 
        (userAgent.includes('tv') || userAgent.includes('android'))
    );
}

document.addEventListener('DOMContentLoaded', () => {
    // Only initialize TV navigation if on Fire TV
    if (!isFireTV()) {
        // Remove TV-specific styles if not on Fire TV
        document.documentElement.classList.remove('tv-mode');
        return;
    }

    // Add TV mode class to enable TV-specific styles
    document.documentElement.classList.add('tv-mode');
    
    // Initialize first focusable element
    const firstFocusable = document.querySelector('.nav-item');
    if (firstFocusable) firstFocusable.focus();

    // Handle D-pad navigation
    document.addEventListener('keydown', (e) => {
        // Only prevent default for arrow keys and enter
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
            e.preventDefault();
        }
        
        const currentElement = document.activeElement;
        
        switch (e.key) {
            case 'ArrowUp':
                navigateVertically(currentElement, 'up');
                break;
            case 'ArrowDown':
                navigateVertically(currentElement, 'down');
                break;
            case 'ArrowLeft':
                navigateHorizontally(currentElement, 'left');
                break;
            case 'ArrowRight':
                navigateHorizontally(currentElement, 'right');
                break;
            case 'Enter':
                handleEnter(currentElement);
                break;
            case 'Backspace':
                // Handle back button on remote
                if (window.history.length > 1) {
                    window.history.back();
                }
                break;
        }
    });

    // Focus trap - keep focus within the page
    document.addEventListener('focusout', (e) => {
        if (!e.relatedTarget) {
            const firstFocusable = document.querySelector('.nav-item');
            if (firstFocusable) firstFocusable.focus();
        }
    });
});

// Update the navigation functions to be more TV-friendly
function findNextFocusableElement(current, direction) {
    const searchResults = document.getElementById('search-results-content');
    let focusableElements;
    
    if (searchResults && searchResults.contains(current)) {
        // If we're in search results, only consider elements within it
        focusableElements = Array.from(searchResults.querySelectorAll('.content-item[tabindex="0"]'));
    } else {
        // Otherwise use all focusable elements
        focusableElements = Array.from(document.querySelectorAll('a[href], button, input, select, [tabindex="0"]'));
    }
    
    const currentIndex = focusableElements.indexOf(current);
    
    switch (direction) {
        case 'up': {
            return focusableElements[currentIndex - 1] || current;
        }
        case 'down': {
            return focusableElements[currentIndex + 1] || current;
        }
        case 'left': {
            return focusableElements[currentIndex - 1] || current;
        }
        case 'right': {
            return focusableElements[currentIndex + 1] || current;
        }
    }
}

function navigateVertically(element, direction) {
    const nextElement = findNextFocusableElement(element, direction);
    if (nextElement) {
        nextElement.focus();
        ensureElementVisible(nextElement);
        
        // Auto-scroll the search results container if we're on the search page
        const searchResults = document.getElementById('search-results-content');
        if (searchResults && searchResults.contains(nextElement)) {
            const containerRect = searchResults.getBoundingClientRect();
            const elementRect = nextElement.getBoundingClientRect();
            
            if (direction === 'down' && elementRect.bottom > containerRect.bottom) {
                searchResults.scrollBy({
                    top: elementRect.height,
                    behavior: 'smooth'
                });
            } else if (direction === 'up' && elementRect.top < containerRect.top) {
                searchResults.scrollBy({
                    top: -elementRect.height,
                    behavior: 'smooth'
                });
            }
        }
    }
}

function navigateHorizontally(element, direction) {
    const nextElement = findNextFocusableElement(element, direction);
    if (nextElement) {
        nextElement.focus();
        ensureElementVisible(nextElement);
    }
}

function ensureElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const isInViewport = (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
    );

    if (!isInViewport) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
        });
    }
}

function handleEnter(element) {
    if (element.tagName === 'A') {
        element.click();
    } else if (element.classList.contains('content-item')) {
        // Trigger click event on the element
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        element.dispatchEvent(clickEvent);
    } else if (element.tagName === 'SELECT') {
        element.click();
    }
}

// Ensure all dynamically added content is properly focusable
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            mutation.addedNodes.forEach((node) => {
                if (node.classList && node.classList.contains('content-item')) {
                    node.setAttribute('tabindex', '0');
                    // Add keyboard event listeners
                    node.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            handleEnter(node);
                        }
                    });
                }
            });
        }
    });
});

// Observe content containers for new items
document.querySelectorAll('.content-row').forEach((container) => {
    observer.observe(container, { childList: true, subtree: true });
}); 