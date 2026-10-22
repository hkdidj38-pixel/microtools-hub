// public/js/text-converter.js
(function () {
    'use strict';

    const input = document.getElementById('text-input');
    const status = document.getElementById('status');
    const copyBtn = document.getElementById('copy-btn');
    const clearBtn = document.getElementById('clear-btn');

    function toTitleCase(str) {
        return str.toLowerCase().replace(/\b\w/g, function (c) {
            return c.toUpperCase();
        });
    }

    function toSentenceCase(str) {
        const lower = str.toLowerCase();
        return lower.replace(/(^\s*\w|[.!?]\s+\w)/g, function (c) {
            return c.toUpperCase();
        });
    }

    function splitWords(str) {
        return str
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_\-]+/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
    }

    function toCamelCase(str) {
        const words = splitWords(str).map(function (word) { return word.toLowerCase(); });
        return words.map(function (w, i) {
            return i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1);
        }).join('');
    }

    function toPascalCase(str) {
        return splitWords(str).map(function (w) {
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        }).join('');
    }

    function toSnakeCase(str) {
        return splitWords(str).join('_').toLowerCase();
    }

    function toKebabCase(str) {
        return splitWords(str).join('-').toLowerCase();
    }

    function toToggleCase(str) {
        return str.split('').map(function (c) {
            return c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase();
        }).join('');
    }

    const converters = {
        upper: function (s) { return s.toUpperCase(); },
        lower: function (s) { return s.toLowerCase(); },
        title: toTitleCase,
        sentence: toSentenceCase,
        camel: toCamelCase,
        pascal: toPascalCase,
        snake: toSnakeCase,
        kebab: toKebabCase,
        toggle: toToggleCase
    };

    document.querySelectorAll('[data-case]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const type = btn.getAttribute('data-case');
            const fn = converters[type];
            if (fn) {
                input.value = fn(input.value);
                status.textContent = 'Converted to ' + btn.textContent.trim() + '.';
                status.className = 'success';
            }
        });
    });

    copyBtn.addEventListener('click', function () {
        if (input.value === '') {
            status.textContent = 'Nothing to copy.';
            status.className = 'error';
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(input.value).then(function () {
                status.textContent = 'Copied to clipboard.';
                status.className = 'success';
            }).catch(function () {
                status.textContent = 'Copy failed. Please select and copy manually.';
                status.className = 'error';
            });
        } else {
            input.select();
            status.textContent = 'Press Ctrl+C (Cmd+C) to copy.';
            status.className = 'success';
        }
    });

    clearBtn.addEventListener('click', function () {
        input.value = '';
        status.textContent = '';
        input.focus();
    });
})();
