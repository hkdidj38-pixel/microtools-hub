// public/js/word-counter.js
(function () {
    'use strict';

    const input = document.getElementById('text-input');
    const wordCount = document.getElementById('word-count');
    const charCount = document.getElementById('char-count');
    const charNoSpaces = document.getElementById('char-no-spaces');
    const sentenceCount = document.getElementById('sentence-count');
    const paragraphCount = document.getElementById('paragraph-count');
    const readingTime = document.getElementById('reading-time');
    const clearBtn = document.getElementById('clear-btn');

    function updateStats() {
        const text = input.value;

        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        const chars = text.length;
        const charsNoSpace = text.replace(/\s/g, '').length;

        const sentences = text.trim() === '' ? 0 : (text.match(/[.!?]+/g) || []).length;
        const paragraphs = text.trim() === '' ? 0 : text.split(/\n\s*\n/).filter(function (p) {
            return p.trim() !== '';
        }).length;

        // Average reading speed: 200 words per minute
        const minutes = Math.ceil(words / 200);

        wordCount.textContent = words;
        charCount.textContent = chars;
        charNoSpaces.textContent = charsNoSpace;
        sentenceCount.textContent = sentences;
        paragraphCount.textContent = paragraphs;
        readingTime.textContent = minutes;
    }

    input.addEventListener('input', updateStats);

    clearBtn.addEventListener('click', function () {
        input.value = '';
        updateStats();
        input.focus();
    });

    updateStats();
})();
