# MicroTools Hub

A collection of free, privacy-focused online tools for productivity, built with HTML, CSS, and vanilla JavaScript. Runs entirely in the browser with no backend.

## Tools Included
- **Word Counter**: Analyze text length, word count, sentences, paragraphs, and reading time.
- **Text Case Converter**: Transform text between UPPERCASE, lowercase, Title Case, camelCase, and more.
- **JSON Formatter & Validator**: Pretty-print, minify, and validate JSON data.
- **URL Slug Generator**: Turn any title into a clean, SEO-friendly URL slug.

## Features
- **Dark mode toggle** with system preference detection and saved selection.
- Responsive and accessible design that works on mobile and desktop.
- Separate SEO-friendly URL for each tool.
- All processing is local to your browser — your data never leaves your device.

## Project Structure
```
public/               # All deployable files
  index.html          # Homepage
  word-counter/       # Word Counter tool
  text-converter/     # Text Case Converter tool
  json-formatter/     # JSON Formatter & Validator tool
  slug-generator/     # URL Slug Generator tool
  css/styles.css      # Shared styles (light + dark themes)
  js/                 # Tool scripts and shared theme logic
  robots.txt
  sitemap.xml
AGENTS.md             # Project rules
README.md             # This file
```

## Deployment on Cloudflare Pages

1. Connect your GitHub repository to Cloudflare Pages.
2. Use the following build settings:
   - **Framework preset**: None
   - **Build command**: `exit 0`
   - **Build output directory**: `public`
   - **Root directory**: (Leave blank)
3. Deploy!
4. After the first deploy, update the domain in `public/robots.txt` and `public/sitemap.xml` to your live URL.

## Privacy
All processing happens locally in your browser. Your data never leaves your device. There are no external API calls, no analytics, and no tracking.
