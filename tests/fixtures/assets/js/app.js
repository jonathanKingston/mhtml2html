// app.js - Main application entry point
import { StatsCard, DataList } from './components.js';
import { formatDate, debounce } from './utils.js';

// Initialize the application
export function initApp() {
    console.log('App initialized at:', formatDate(new Date()));

    // Initialize stats cards
    document.querySelectorAll('[data-stats-card]').forEach((el) => {
        const config = JSON.parse(el.dataset.statsCard);
        new StatsCard(el, config);
    });

    // Initialize data lists
    document.querySelectorAll('[data-data-list]').forEach((el) => {
        const items = JSON.parse(el.dataset.dataList);
        new DataList(el, items);
    });

    // Setup search with debounce
    const searchInput = document.querySelector('[data-search]');
    if (searchInput) {
        const handleSearch = debounce((value) => {
            console.log('Search:', value);
            document.querySelector('.search-status').textContent = value
                ? `Searching for "${value}"...`
                : 'Type to search';
        }, 300);

        searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    }

    return { StatsCard, DataList };
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
