// public/js/json-formatter.js
(function () {
    'use strict';

    const input = document.getElementById('json-input');
    const output = document.getElementById('json-output');
    const outputGroup = document.getElementById('output-group');
    const status = document.getElementById('status');
    const formatBtn = document.getElementById('format-btn');
    const minifyBtn = document.getElementById('minify-btn');
    const validateBtn = document.getElementById('validate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const clearBtn = document.getElementById('clear-btn');

    function showStatus(message, isError) {
        status.textContent = message;
        status.className = isError ? 'error' : 'success';
    }

    function parseOrFail() {
        const raw = input.value.trim();
        if (raw === '') {
            throw new Error('Please enter some JSON first.');
        }
        return JSON.parse(raw);
    }

    formatBtn.addEventListener('click', function () {
        try {
            const parsed = parseOrFail();
            output.value = JSON.stringify(parsed, null, 2);
            outputGroup.style.display = 'block';
            showStatus('JSON is valid and formatted.', false);
        } catch (err) {
            showStatus('Invalid JSON: ' + err.message, true);
        }
    });

    minifyBtn.addEventListener('click', function () {
        try {
            const parsed = parseOrFail();
            output.value = JSON.stringify(parsed);
            outputGroup.style.display = 'block';
            showStatus('JSON is valid and minified.', false);
        } catch (err) {
            showStatus('Invalid JSON: ' + err.message, true);
        }
    });

    validateBtn.addEventListener('click', function () {
        try {
            parseOrFail();
            showStatus('Valid JSON.', false);
        } catch (err) {
            showStatus('Invalid JSON: ' + err.message, true);
        }
    });

    copyBtn.addEventListener('click', function () {
        if (output.value === '') {
            showStatus('Nothing to copy. Format or minify first.', true);
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(output.value).then(function () {
                showStatus('Result copied to clipboard.', false);
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
        outputGroup.style.display = 'none';
        status.textContent = '';
        input.focus();
    });
})();
