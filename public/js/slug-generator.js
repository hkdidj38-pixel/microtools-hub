// public/js/slug-generator.js
(function () {
    'use strict';

    const input = document.getElementById('slug-input');
    const output = document.getElementById('slug-output');
    const separator = document.getElementById('separator');
    const maxLength = document.getElementById('max-length');
    const removeNumbers = document.getElementById('remove-numbers');
    const status = document.getElementById('status');
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const clearBtn = document.getElementById('clear-btn');

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function generateSlug(text, sep, max, dropNumbers) {
        let slug = text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // strip accents/diacritics
            .toLowerCase()
            .trim();

        if (dropNumbers) {
            slug = slug.replace(/[0-9]+/g, ' ');
        }

        // Replace any run of non-alphanumeric characters with the separator.
        slug = slug.replace(/[^a-z0-9]+/g, sep);

        // Collapse repeats and trim leading/trailing separators.
        const esc = escapeRegex(sep);
        slug = slug.replace(new RegExp(esc + '+', 'g'), sep);
        slug = slug.replace(new RegExp('^' + esc + '|' + esc + '$', 'g'), '');

        if (max > 0 && slug.length > max) {
            slug = slug.substring(0, max);
            slug = slug.replace(new RegExp(esc + '+$'), '');
        }

        return slug;
    }

    function showStatus(message, isError) {
        status.textContent = message;
        status.className = isError ? 'error' : 'success';
    }

    function run(reportEmpty = false) {
        const text = input.value;
        if (text.trim() === '') {
            output.value = '';
            status.textContent = '';
            if (reportEmpty) {
                showStatus('Enter some text to generate a slug.', true);
            }
            return;
        }
        const sep = separator.value === '_' ? '_' : '-';
        const max = parseInt(maxLength.value, 10) || 0;
        output.value = generateSlug(text, sep, max, removeNumbers.checked);
        showStatus('Slug generated locally.', false);
    }

    generateBtn.addEventListener('click', function () { run(true); });
    input.addEventListener('input', run);
    separator.addEventListener('change', run);
    maxLength.addEventListener('input', run);
    removeNumbers.addEventListener('change', run);

    copyBtn.addEventListener('click', function () {
        if (output.value === '') {
            showStatus('Nothing to copy. Generate a slug first.', true);
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(output.value).then(function () {
                showStatus('Copied to clipboard.', false);
            }).catch(function () {
                showStatus('Copy failed. Please select and copy manually.', true);
            });
        } else {
            output.select();
            showStatus('Press Ctrl+C (Cmd+C) to copy.', false);
        }
    });

    clearBtn.addEventListener('click', function () {
        input.value = '';
        output.value = '';
        status.textContent = '';
        input.focus();
    });

    run();
})();
