document.addEventListener('DOMContentLoaded', () => {
    // Initialize first focusable element
    const firstFocusable = document.querySelector('.nav-item');
    if (firstFocusable) firstFocusable.focus();

    // Handle D-pad navigation
    document.addEventListener('keydown', (e) => {
        const currentElement = document.activeElement;
        
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                navigateVertically(currentElement, 'up');
                break;
            case 'ArrowDown':
                e.preventDefault();
                navigateVertically(currentElement, 'down');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                navigateHorizontally(currentElement, 'left');
                break;
            case 'ArrowRight':
                e.preventDefault();
                navigateHorizontally(currentElement, 'right');
                break;
            case 'Enter':
                e.preventDefault();
                handleEnter(currentElement);
                break;
        }
    });
});

function navigateVertically(element, direction) {
    const grid = element.closest('.tv-grid');
    if (grid) {
        const items = Array.from(grid.querySelectorAll('.content-item'));
        const currentIndex = items.indexOf(element);
        const columns = Math.floor(grid.offsetWidth / items[0].offsetWidth);
        
        const targetIndex = direction === 'up' 
            ? currentIndex - columns 
            : currentIndex + columns;
            
        if (items[targetIndex]) {
            items[targetIndex].focus();
        } else if (direction === 'up' && currentIndex < columns) {
            // Move to header navigation when at top
            const navItems = document.querySelectorAll('.nav-item');
            navItems[navItems.length - 1].focus();
        }
    }
}

function navigateHorizontally(element, direction) {
    const grid = element.closest('.tv-grid');
    if (grid) {
        const items = Array.from(grid.querySelectorAll('.content-item'));
        const currentIndex = items.indexOf(element);
        const targetIndex = direction === 'left' 
            ? currentIndex - 1 
            : currentIndex + 1;
            
        if (items[targetIndex]) {
            items[targetIndex].focus();
        }
    } else if (element.classList.contains('nav-item')) {
        const navItems = Array.from(document.querySelectorAll('.nav-item'));
        const currentIndex = navItems.indexOf(element);
        const targetIndex = direction === 'left' 
            ? currentIndex - 1 
            : currentIndex + 1;
            
        if (navItems[targetIndex]) {
            navItems[targetIndex].focus();
        }
    }
}

function handleEnter(element) {
    if (element.tagName === 'A' || element.classList.contains('content-item')) {
        element.click();
    } else if (element.tagName === 'SELECT') {
        element.classList.contains('open') 
            ? element.classList.remove('open')
            : element.classList.add('open');
    }
}

// Add focus to newly loaded content items
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            mutation.addedNodes.forEach((node) => {
                if (node.classList && node.classList.contains('content-item')) {
                    node.setAttribute('tabindex', '0');
                }
            });
        }
    });
});

// Observe content containers for new items
document.querySelectorAll('.content-row').forEach((container) => {
    observer.observe(container, { childList: true, subtree: true });
}); 