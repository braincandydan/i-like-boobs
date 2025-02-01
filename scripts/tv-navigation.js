document.addEventListener('DOMContentLoaded', () => {
    // Prevent default mouse behavior
    document.addEventListener('mousemove', e => e.preventDefault());
    document.addEventListener('click', e => e.preventDefault());
    
    // Initialize first focusable element
    const firstFocusable = document.querySelector('.nav-item');
    if (firstFocusable) firstFocusable.focus();

    // Handle D-pad navigation
    document.addEventListener('keydown', (e) => {
        e.preventDefault(); // Prevent all default keyboard behavior
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
    const focusableElements = Array.from(document.querySelectorAll('a[href], button, input, select, [tabindex="0"]'));
    const currentIndex = focusableElements.indexOf(current);
    
    switch (direction) {
        case 'up': {
            // Find the nearest element above
            const currentRect = current.getBoundingClientRect();
            const aboveElements = focusableElements.filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.bottom <= currentRect.top;
            });
            return aboveElements[aboveElements.length - 1] || focusableElements[0];
        }
        case 'down': {
            // Find the nearest element below
            const currentRect = current.getBoundingClientRect();
            const belowElements = focusableElements.filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.top >= currentRect.bottom;
            });
            return belowElements[0] || focusableElements[focusableElements.length - 1];
        }
        case 'left':
            return focusableElements[currentIndex - 1] || focusableElements[focusableElements.length - 1];
        case 'right':
            return focusableElements[currentIndex + 1] || focusableElements[0];
    }
}

function navigateVertically(element, direction) {
    const nextElement = findNextFocusableElement(element, direction);
    if (nextElement) {
        nextElement.focus();
        ensureElementVisible(nextElement);
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
    if (element.tagName === 'A' || element.classList.contains('content-item')) {
        // Simulate a click with keyboard event
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
        });
        element.dispatchEvent(enterEvent);
    } else if (element.tagName === 'SELECT') {
        element.click(); // Open the select dropdown
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