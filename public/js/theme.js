// public/js/theme.js
// Shared dark mode toggle with localStorage persistence.
(function () {
    'use strict';

    const root = document.documentElement;

    function current() {
        return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    function apply(theme) {
        root.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('theme', theme);
        } catch (e) { /* storage unavailable */ }

        const btn = document.getElementById('theme-toggle');
        if (btn) {
            btn.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
            btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
        }
    }

    // Initialize from the value the inline head script already applied.
    apply(current());

    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.addEventListener('click', function () {
            apply(current() === 'dark' ? 'light' : 'dark');
        });
    }
})();
